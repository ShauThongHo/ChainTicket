import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  History,
  Lock,
  Plus,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PhaseBadge } from "@/components/phase-badge";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import { Hint } from "@/components/hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  escalatePayout,
  executePayout,
  fetchOrganizer,
  fetchOrganizerEventLedger,
  refundEvent,
  uploadPoster,
  withdrawEvent,
} from "@/lib/api";
import { friendlyChainError } from "@/lib/chain-errors";
import { explorerAddress, explorerTx, gatewayUrl } from "@/lib/explorer";
import type { LedgerRow, OrganizerEvent } from "@/lib/types";
import { checkInPct, formatAmount, paySymbol, shortAddr } from "@/lib/utils";

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
        <div className="rounded-2xl border border-dashed border-border bg-bg-elevated p-12 text-center my-8">
          <Building2 className="size-12 text-muted mx-auto mb-3 stroke-[1.2]" />
          <h2 className="font-display text-2xl font-bold">Connect Organizer Wallet</h2>
          <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
            Please connect your wallet with authorized organizer credentials to manage shows and vault funds.
          </p>
        </div>
      </AppShell>
    );
  }

  if (!me.isOrganizer) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-danger/30 bg-danger/5 p-8 text-center my-8 max-w-xl mx-auto">
          <ShieldAlert className="size-10 text-danger mx-auto mb-3" />
          <h1 className="font-display text-2xl font-bold text-fg">Organizer License Required</h1>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Wallet address <code className="font-mono text-fg bg-mist px-1.5 py-0.5 rounded text-xs">{me.address}</code> is not currently on the platform approved organizer whitelist.
          </p>
          <p className="mt-2 text-xs text-muted">
            Contact the platform governance administrator to grant organizer publishing privileges.
          </p>
        </div>
      </AppShell>
    );
  }

  const locked = events.reduce((s, e) => s + e.lockedCents, 0);
  const activeCount = events.filter((e) => e.phase === "active").length;

  return (
    <AppShell>
      {/* ORGANIZER PORTAL HERO */}
      <div className="mb-6 border-b border-border pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-fg">
            {me.organizerName || "Organizer"}
          </h1>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 shadow-2xs">
              <Link to="/organizer/scan">
                <QrCode className="size-3.5" />
                <span>Scanner</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 shadow-xs font-semibold">
              <Link to="/organizer/mint">
                <Plus className="size-4" />
                <span>Mint Show</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 bg-bg-elevated border-border">
            <div className="flex items-center justify-between text-muted text-xs font-medium uppercase tracking-wider">
              <span>Vault Locked</span>
              <Lock className="size-4 text-primary" />
            </div>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-fg">
              {formatAmount(locked, symbol)}
            </p>
          </Card>

          <Card className="p-4 bg-bg-elevated border-border">
            <div className="flex items-center justify-between text-muted text-xs font-medium uppercase tracking-wider">
              <span>Active Shows</span>
              <Calendar className="size-4 text-sage" />
            </div>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-fg">{activeCount}</p>
          </Card>

          <Card className="p-4 bg-bg-elevated border-border">
            <div className="flex items-center justify-between text-muted text-xs font-medium uppercase tracking-wider">
              <span>Spendable</span>
              <Wallet className="size-4 text-primary" />
            </div>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-fg">
              {formatAmount(me.spendableCents, symbol)}
            </p>
          </Card>
        </div>
      </div>

      <ChainDialog {...chain} onClose={chain.close} />

      {/* EVENTS MANAGEMENT TABLE */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold tracking-tight text-fg">Shows</h2>
        <span className="font-mono text-xs text-muted">{events.length}</span>
      </div>

      <div className="grid gap-3">
        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-bg-elevated p-10 text-center">
            <Ticket className="size-8 text-muted mx-auto mb-2 stroke-[1.5]" />
            <h3 className="font-display text-base font-bold">No events created yet</h3>
            <Button asChild size="sm" className="mt-3">
              <Link to="/organizer/mint">Mint Show →</Link>
            </Button>
          </div>
        ) : null}

        {events.map((ev) => (
          <OrganizerEventCard
            key={ev.id}
            ev={ev}
            explorer={explorer}
            symbol={symbol}
            onDone={() => void reload()}
            runChain={(title, labels, task) =>
              chain.run({
                title,
                labels,
                task: async (advance) => {
                  await task(advance);
                  return "On-chain transaction confirmed and synced.";
                },
              })
            }
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
  const { config } = useSession();
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
      ? ["Open holder vote", "Wait for block receipt", "Index proposal in ledger"]
      : ["Submit request", "Wait for admin"];
    try {
      await runChain("Request vault payout", labels, async (tick) => {
        tick(0);
        const res = await withdrawEvent({ data: { eventId: ev.id } });
        tick(labels.length);
        const status =
          res.ref && typeof res.ref === "object" && "status" in res.ref ? String(res.ref.status) : "";
        if (status === "passed") toast.success("Vote passed. Payout ready for execution.");
        else if (gov) toast.success("7-Day ticket holder objection window opened.");
        else toast.success("Payout request submitted for audit.");
        onDone();
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    }
  }

  async function execute() {
    const labels = ["Execute withdraw", "Wait for block receipt", "Sync vault ledger"];
    try {
      await runChain("Withdraw event funds", labels, async (tick) => {
        tick(1);
        await executePayout({ data: { eventId: ev.id } });
        tick(3);
        toast.success("Vault funds successfully transferred to your wallet.");
        onDone();
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    }
  }

  async function escalate() {
    const labels = ["Pin evidence to IPFS", "Escalate on-chain", "Sync review status"];
    try {
      await runChain("Escalate payout to Admin review", labels, async (tick) => {
        let uri = materials.trim();
        if (file) {
          const base64 = await readBase64(file);
          const pinned = await uploadPoster({
            data: { filename: file.name, contentType: file.type || "application/octet-stream", base64 },
          });
          uri = pinned.uri;
        }
        if (!uri) throw new Error("Please attach or enter IPFS proof document.");
        tick(1);
        await escalatePayout({ data: { eventId: ev.id, materialsUri: uri } });
        tick(3);
        toast.success("Sent to Platform Administrator review queue.");
        onDone();
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    }
  }

  return (
    <Card className="rounded-2xl border border-border bg-bg-elevated p-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          {/* BADGES LINE */}
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={ev.phase} />
            {ev.frozen ? <Badge tone="danger">Trading Paused</Badge> : null}
            {ev.withdrawn ? <Badge tone="ink">Vault Withdrawn</Badge> : null}
            {ev.withdrawRequest === "pending" ? <Badge>Admin Review</Badge> : null}
            {ev.withdrawRequest === "pending_vote" ? <Badge tone="sage">7-Day Objection Window</Badge> : null}
            {ev.withdrawRequest === "passed" ? (
              <Badge tone="sage">{opposition ? "Objection Window Passed" : "2/3 Quorum Reached"}</Badge>
            ) : null}
            {ev.withdrawRequest === "escalated" ? <Badge tone="danger">Escalated to Admin</Badge> : null}
            <Badge tone="sage" className="font-mono text-[11px]">
              Gate Check-in: {checkInPct(ev.checkInRate)}
            </Badge>
          </div>

          {/* EVENT NAME & SUMMARY */}
          <h3 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-fg">{ev.name}</h3>
          <p className="mt-1 text-xs text-muted font-mono">
            {ev.venue} · Passes: {ev.sold} / {ev.supply} sold · Gate Checked In: {ev.checkedIn} / {ev.sold || 0}
          </p>
          <p className="mt-1 font-mono text-xs text-primary font-semibold">
            Vault Balance: {formatAmount(ev.lockedCents, symbol)}
          </p>

          {/* GOVERNANCE OBJECTION STATUS */}
          {ev.withdrawRequest === "pending_vote" ||
          ev.withdrawRequest === "passed" ||
          ev.withdrawRequest === "escalated" ? (
            <div className="mt-2.5 rounded-lg border border-border bg-mist/30 px-3 py-1.5 text-xs font-mono text-muted">
              <span>{opposition ? "Objection Tally" : "Support Tally"}: </span>
              <strong className="text-fg font-bold">
                {ev.proposalYes} / {ev.proposalSold}
              </strong>
              {ev.proposalSold > 0
                ? opposition
                  ? ` · Escalation threshold: ${need}+ objections`
                  : ` · Quorum required: ${need}`
                : " · No passes sold"}
              {ev.proposalDeadline ? ` · Window Deadline: ${new Date(ev.proposalDeadline).toLocaleString()}` : ""}
            </div>
          ) : null}

          {/* CONTRACT LINK PILLS */}
          <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-muted">
            {ev.vaultAddress ? (
              <a
                className="inline-flex items-center gap-1 text-primary hover:underline"
                href={explorerAddress(ev.vaultAddress, explorer)}
                target="_blank"
                rel="noreferrer"
              >
                <span>Vault {shortAddr(ev.vaultAddress)}</span>
                <ExternalLink className="size-3" />
              </a>
            ) : null}
            {ev.marketplaceAddress ? (
              <a
                className="inline-flex items-center gap-1 text-primary hover:underline"
                href={explorerAddress(ev.marketplaceAddress, explorer)}
                target="_blank"
                rel="noreferrer"
              >
                <span>Market {shortAddr(ev.marketplaceAddress)}</span>
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        </div>

        {/* ORGANIZER ACTION BUTTONS GROUP */}
        <div className="flex flex-wrap items-center gap-2">
          {/* CANCEL & REFUND BUTTON */}
          <Button
            variant="outline"
            size="sm"
            disabled={ended || ev.cancelled}
            onClick={async () => {
              const labels = [
                "Confirm cancellation intent",
                "Refund ticket holders on-chain",
                "Mark event cancelled in database",
              ];
              try {
                await runChain("Cancel event & refund all holders", labels, async (tick) => {
                  tick(1);
                  await refundEvent({ data: { eventId: ev.id } });
                  tick(3);
                  toast.success("Full refund successfully broadcast to ticket holders.");
                  onDone();
                });
              } catch (e) {
                toast.error(friendlyChainError(e));
              }
            }}
          >
            Cancel & Refund
          </Button>

          {/* OPEN HOLDER VOTE / REQUEST WITHDRAW */}
          {!open && !ev.withdrawn ? (
            <Button
              size="sm"
              disabled={!ended || ev.frozen || (gov && !ev.collectionAddress)}
              onClick={() => void requestWithdraw()}
              className="font-semibold shadow-xs"
            >
              {gov ? "Open Holder Vote" : "Request Withdraw"}
            </Button>
          ) : null}

          {/* EXECUTE WITHDRAW */}
          {(ev.withdrawRequest === "passed" ||
            (opposition &&
              ev.withdrawRequest === "pending_vote" &&
              deadlinePassed &&
              (ev.proposalSold === 0 || ev.proposalYes * 3 < ev.proposalSold))) &&
          !ev.withdrawn ? (
            <Button
              size="sm"
              disabled={ev.frozen}
              onClick={() => void execute()}
              className="font-bold bg-success text-paper hover:bg-success/90 shadow-xs"
            >
              Execute Withdraw
            </Button>
          ) : null}
        </div>
      </div>

      {!ended && !ev.withdrawn ? (
        <p className="mt-2 text-right font-mono text-[11px] text-muted">
          Withdrawals unlock upon event conclusion: {new Date(ev.endsAt).toLocaleString()}.
        </p>
      ) : null}

      {/* ESCALATE EVIDENCE FORM */}
      {gov && ev.withdrawRequest === "pending_vote" ? (
        <div className="mt-4 rounded-xl border border-border bg-mist/20 p-4">
          <p className="text-xs text-muted mb-2 leading-relaxed">
            {deadlinePassed
              ? opposition
                ? ev.proposalSold > 0 && ev.proposalYes * 3 >= ev.proposalSold
                  ? "The 7-day objection window ended with over 1/3 opposed. Upload performance documentation to request Platform Admin arbitration."
                  : "The 7-day objection window ended safely below threshold. You may now execute payout."
                : "The vote missed quorum threshold. Upload documentation for Admin review."
              : opposition
                ? "Ticket holders may file objections for 7 days. At 1/3 opposition, dispute triggers Admin arbitration."
                : "Voting window is open. Escalation unlocks after deadline."}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept="image/*,.pdf,.txt"
              className="text-xs max-w-xs"
              disabled={
                !deadlinePassed ||
                (opposition && ev.proposalSold > 0 && ev.proposalYes * 3 < ev.proposalSold)
              }
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Input
              placeholder="or paste ipfs://… evidence CID"
              value={materials}
              className="text-xs max-w-xs"
              disabled={
                !deadlinePassed ||
                (opposition && ev.proposalSold > 0 && ev.proposalYes * 3 < ev.proposalSold)
              }
              onChange={(e) => setMaterials(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={
                !deadlinePassed ||
                ev.frozen ||
                (opposition && (ev.proposalSold === 0 || ev.proposalYes * 3 < ev.proposalSold))
              }
              onClick={() => void escalate()}
            >
              Escalate to Admin
            </Button>
          </div>
        </div>
      ) : null}

      {/* EVENT FINANCIAL LEDGER DETAILS */}
      <details
        className="mt-4 border-t border-border/60 pt-3"
        onToggle={(event) => {
          if (event.currentTarget.open && !ledgerLoaded) {
            setLedgerLoaded(true);
            void fetchOrganizerEventLedger({ data: { eventId: ev.id } })
              .then(setLedger)
              .catch((error) => {
                setLedgerLoaded(false);
                toast.error(friendlyChainError(error));
              });
          }
        }}
      >
        <summary className="cursor-pointer font-mono text-xs font-semibold text-primary hover:underline flex items-center gap-1.5">
          <History className="size-3.5" />
          <span>Financial Activity Ledger ({ledger.length})</span>
        </summary>
        {ledger.length === 0 ? (
          <p className="pt-2 font-mono text-xs text-muted">No transactions recorded yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-border/60 font-mono text-xs">
            {ledger.map((row) => (
              <div key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-fg font-medium">
                  {row.kind} · {new Date(row.createdAt).toLocaleString()}
                </span>
                <span className="text-muted">
                  {formatAmount(row.amountCents, symbol)} ·{" "}
                  {row.onChain ? (
                    <a
                      className="text-primary underline"
                      href={explorerTx(row.ref, explorer)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      tx {row.ref.slice(0, 10)}…
                    </a>
                  ) : (
                    row.ref.slice(0, 14)
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </details>
    </Card>
  );
}
