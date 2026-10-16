import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PhaseBadge } from "@/components/phase-badge";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import { Hint } from "@/components/hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchOrganizer, fetchOrganizerEventLedger, refundEvent, withdrawEvent, uploadPoster, escalatePayout, executePayout } from "@/lib/api";
import { friendlyChainError } from "@/lib/chain-errors";
import { explorerAddress, explorerTx, gatewayUrl } from "@/lib/explorer";
import type { LedgerRow, OrganizerEvent } from "@/lib/types";
import { checkInPct, formatAmount, paySymbol, shortAddr } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/organizer")({ component: OrganizerLayout });

function OrganizerLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/organizer") return <Outlet />;
  return <OrganizerHome />;
}

function OrganizerHome() {
  const { me, config } = useSession();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const chain = useChainRun();
  const symbol = paySymbol(config);
  const explorer = config?.explorerUrl ?? "";

  async function reload() {
    const data = await fetchOrganizer();
    setEvents(data.events);
  }

  useEffect(() => {
    if (me?.isOrganizer) void reload();
  }, [me?.isOrganizer]);

  if (!me) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Connect a wallet.</p>
      </AppShell>
    );
  }
  if (!me.isOrganizer) {
    return (
      <AppShell>
        <h1 className="font-display text-4xl italic">Organizer portal</h1>
        <p className="mt-3 max-w-lg text-sm text-muted">
          This wallet is not on the organizer list. Ask the platform admin to verify{" "}
          <span className="font-mono">{me.address}</span>.
        </p>
      </AppShell>
    );
  }

  const locked = events.reduce((s, e) => s + e.lockedCents, 0);
  const activeCount = events.filter((e) => e.phase === "active").length;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl italic">{me.organizerName}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/organizer/scan">Scan tickets</Link>
          </Button>
          <Button asChild>
            <Link to="/organizer/mint">New event</Link>
          </Button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Locked in vaults</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">{formatAmount(locked, symbol)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Active events</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Withdrawable ledger</p>
          <p className="mt-1 font-mono text-2xl tabular-nums">{formatAmount(me.spendableCents, symbol)}</p>
        </Card>
      </div>

      <ChainDialog {...chain} onClose={chain.close} />

      <h2 className="mt-10 flex items-center gap-2 font-display text-2xl italic">Your events <Hint>New events use a seven-day objection window after the show. One third or more opposition sends the request to Admin review. Older events keep their original support vote.</Hint></h2>
      <div className="mt-4 grid gap-3">
        {events.length === 0 ? (
          <Card className="p-5 text-sm text-muted">No shows yet. <Link to="/organizer/mint" className="underline">Create an event</Link></Card>
        ) : null}
        {events.map((ev) => (
          <OrganizerEventCard
            key={ev.id}
            ev={ev}
            explorer={explorer}
            symbol={symbol}
            onDone={() => void reload()}
            runChain={(title, labels, task) => chain.run({ title, labels, task: async (advance) => { await task(advance); return "The update is complete."; } })}
          />
        ))}
      </div>

    </AppShell>
  );
}

function readBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const i = raw.indexOf(",");
      resolve(i >= 0 ? raw.slice(i + 1) : raw);
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function OrganizerEventCard({
  ev,
  explorer,
  symbol,
  onDone,
  runChain,
}: {
  ev: OrganizerEvent;
  explorer: string;
  symbol: string;
  onDone: () => void;
  runChain: (title: string, labels: string[], task: (tick: (n: number) => void) => Promise<void>) => Promise<void>;
}) {
  const [materials, setMaterials] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const gov = ev.engineVersion >= 3;
  const opposition = ev.engineVersion >= 4;
  const open =
    ev.withdrawRequest === "pending" ||
    ev.withdrawRequest === "pending_vote" ||
    ev.withdrawRequest === "passed" ||
    ev.withdrawRequest === "escalated";
  const deadlinePassed = ev.proposalDeadline
    ? Date.now() >= new Date(ev.proposalDeadline).getTime()
    : false;
  const need = opposition ? Math.ceil(ev.proposalSold / 3) : Math.ceil((ev.proposalSold * 2) / 3);
  const ended = Date.now() >= new Date(ev.endsAt).getTime();

  async function requestWithdraw() {
    const labels = gov
      ? ["Open holder vote", "Wait one block", "Index proposal"]
      : ["Submit request", "Wait for admin"];
    try {
      await runChain("Request a payout", labels, async (tick) => {
        tick(0);
        const res = await withdrawEvent({ data: { eventId: ev.id } });
        tick(labels.length);
        const status = res.ref && typeof res.ref === "object" && "status" in res.ref ? String(res.ref.status) : "";
        if (status === "passed") toast.success("Vote passed. You can now withdraw.");
        else if (gov) toast.success("Holder vote opened.");
        else toast.success("Payout request sent for review.");
        onDone();
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    }
  }

  async function execute() {
    const labels = ["Execute withdraw", "Wait one block", "Index"];
    try {
      await runChain("Withdraw event funds", labels, async (tick) => {
        tick(1);
        await executePayout({ data: { eventId: ev.id } });
        tick(3);
        toast.success("Funds sent to your wallet.");
        onDone();
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    }
  }

  async function escalate() {
    const labels = ["Pin materials", "Escalate on-chain", "Index"];
    try {
      await runChain("Send payout for review", labels, async (tick) => {
        let uri = materials.trim();
        if (file) {
          const base64 = await readBase64(file);
          const pinned = await uploadPoster({ data: { filename: file.name, contentType: file.type || "application/octet-stream", base64 } });
          uri = pinned.uri;
        }
        if (!uri) throw new Error("Add a payout document first.");
        tick(1);
        await escalatePayout({ data: { eventId: ev.id, materialsUri: uri } });
        tick(3);
        toast.success("Sent to admin for review.");
        onDone();
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <PhaseBadge phase={ev.phase} />
            {ev.frozen ? <Badge tone="danger">Frozen</Badge> : null}
            {ev.withdrawn ? <Badge tone="ink">Withdrawn</Badge> : null}
            {ev.withdrawRequest === "pending" ? <Badge>Admin review</Badge> : null}
            {ev.withdrawRequest === "pending_vote" ? <Badge>Voting</Badge> : null}
            {ev.withdrawRequest === "passed" ? <Badge tone="sage">{opposition ? "Vote window passed" : "2/3 reached"}</Badge> : null}
            {ev.withdrawRequest === "escalated" ? <Badge tone="danger">Escalated</Badge> : null}
            {ev.engineVersion < 3 ? <Badge>Legacy payout</Badge> : null}
            {gov && !ev.collectionAddress ? <Badge tone="danger">No NFT — remint</Badge> : null}
            <Badge tone="sage">{checkInPct(ev.checkInRate)} checked in</Badge>
          </div>
          <h3 className="mt-1 font-display text-xl italic">{ev.name}</h3>
          <p className="text-sm text-muted">
            {ev.venue} · sold {ev.sold}/{ev.supply} · gate {ev.checkedIn}/{ev.sold || 0} · vault{" "}
            {formatAmount(ev.lockedCents, symbol)}
          </p>
          {ev.withdrawRequest === "pending_vote" || ev.withdrawRequest === "passed" || ev.withdrawRequest === "escalated" ? (
            <p className="mt-1 text-sm text-muted">
              {opposition ? "Opposed" : "Support"} {ev.proposalYes}/{ev.proposalSold}
              {ev.proposalSold > 0 ? opposition ? ` · admin review at ${need}+` : ` · need ${need}` : " · no holders"}
              {ev.proposalDeadline ? ` · deadline ${new Date(ev.proposalDeadline).toLocaleString()}` : ""}
            </p>
          ) : null}
          {ev.materialsUri ? (
            <p className="mt-1 font-mono text-xs">
              <a className="text-primary underline" href={gatewayUrl(ev.materialsUri)} target="_blank" rel="noreferrer">
                payout materials
              </a>
            </p>
          ) : null}
          <p className="mt-2 font-mono text-xs text-muted">
            {ev.vaultAddress ? (
              <a className="text-primary underline" href={explorerAddress(ev.vaultAddress, explorer)} target="_blank" rel="noreferrer">
                vault {shortAddr(ev.vaultAddress)}
              </a>
            ) : null}
            {ev.marketplaceAddress ? (
              <>
                {" · "}
                <a className="text-primary underline" href={explorerAddress(ev.marketplaceAddress, explorer)} target="_blank" rel="noreferrer">
                  market {shortAddr(ev.marketplaceAddress)}
                </a>
              </>
            ) : null}
            {ev.collectionAddress ? (
              <>
                {" · "}
                <a className="text-primary underline" href={explorerAddress(ev.collectionAddress, explorer)} target="_blank" rel="noreferrer">
                  collection {shortAddr(ev.collectionAddress)}
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={ended || ev.cancelled}
            onClick={async () => {
              const labels = ["Confirm event cancellation", "Refund ticket holders", "Save updates"];
              try {
                await runChain("Cancel event and refund tickets", labels, async (tick) => {
                  tick(1);
                  await refundEvent({ data: { eventId: ev.id } });
                  tick(3);
                  toast.success("Refunds sent to ticket holders.");
                  onDone();
                });
              } catch (e) {
                toast.error(friendlyChainError(e));
              }
            }}
          >
            Cancel & refund
          </Button>
          {!open && !ev.withdrawn ? (
            <Button disabled={!ended || ev.frozen || (gov && !ev.collectionAddress)} onClick={() => void requestWithdraw()}>
              {gov ? "Open holder vote" : "Request withdraw"}
            </Button>
          ) : null}
          {!ended && !ev.withdrawn ? <p className="basis-full text-right text-xs text-muted">Withdrawals unlock {new Date(ev.endsAt).toLocaleString()}.</p> : null}
          {(ev.withdrawRequest === "passed" || (opposition && ev.withdrawRequest === "pending_vote" && deadlinePassed && (ev.proposalSold === 0 || ev.proposalYes * 3 < ev.proposalSold))) && !ev.withdrawn ? (
            <Button disabled={ev.frozen} onClick={() => void execute()}>
              Execute withdraw
            </Button>
          ) : null}
        </div>
      </div>
      {gov && ev.withdrawRequest === "pending_vote" ? (
        <div className="mt-4 grid gap-2 border-t border-border pt-4">
          <p className="text-xs text-muted">
            {deadlinePassed
              ? opposition
                ? ev.proposalSold > 0 && ev.proposalYes * 3 >= ev.proposalSold
                  ? "The 7-day window ended with at least one third opposed. Upload payout materials for Admin review."
                  : "The 7-day window ended below the objection threshold. Withdraw the funds when ready."
                : "The vote missed 2/3. Upload payout materials for Admin review."
              : opposition ? "Ticket holders can oppose for 7 days. At one third or more, Admin reviews the payout." : "Voting is open. Escalate unlocks only after the deadline."}
          </p>
          <Input
            type="file"
            accept="image/*,.pdf,.txt"
            disabled={!deadlinePassed || (opposition && ev.proposalSold > 0 && ev.proposalYes * 3 < ev.proposalSold)}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Input
            placeholder="or paste ipfs://… materials URI"
            value={materials}
            disabled={!deadlinePassed || (opposition && ev.proposalSold > 0 && ev.proposalYes * 3 < ev.proposalSold)}
            onChange={(e) => setMaterials(e.target.value)}
          />
          <Button variant="outline" disabled={!deadlinePassed || ev.frozen || (opposition && (ev.proposalSold === 0 || ev.proposalYes * 3 < ev.proposalSold))} onClick={() => void escalate()}>
            Escalate to admin
          </Button>
        </div>
      ) : null}
      <details className="mt-4 border-t border-border pt-3" onToggle={(event) => {
        if (event.currentTarget.open && !ledgerLoaded) {
          setLedgerLoaded(true);
          void fetchOrganizerEventLedger({ data: { eventId: ev.id } }).then(setLedger).catch((error) => {
            setLedgerLoaded(false);
            toast.error(friendlyChainError(error));
          });
        }
      }}>
        <summary className="cursor-pointer text-sm font-medium">Event history <span className="text-muted">({ledger.length})</span></summary>
        {ledger.length === 0 ? <p className="pt-3 text-xs text-muted">No recorded activity yet.</p> : (
          <div className="mt-2 divide-y divide-border">
            {ledger.map((row) => <div key={row.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
              <span>{row.kind} · {new Date(row.createdAt).toLocaleString()}</span>
              <span className="font-mono text-muted">{formatAmount(row.amountCents, symbol)} · {row.onChain
                ? <a className="text-primary underline" href={explorerTx(row.ref, explorer)} target="_blank" rel="noreferrer">{row.ref.slice(0, 12)}…</a>
                : row.ref.slice(0, 18)}</span>
            </div>)}
          </div>
        )}
      </details>
    </Card>
  );
}
