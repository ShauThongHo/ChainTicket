import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
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
import {
  claimPlatformAdmin,
  decidePayout,
  dismissPendingIndex,
  fetchAdminEvents,
  fetchInfra,
  fetchPendingIndex,
  fetchSignerOps,
  fetchWithdrawals,
  freezeShow,
  retryPendingIndex,
} from "@/lib/api";
import { explorerAddress, explorerTx, gatewayUrl } from "@/lib/explorer";
import { friendlyChainError } from "@/lib/chain-errors";
import type { InfraStatus, LedgerRow, OrganizerEvent, PendingIndexRow, WithdrawRequest } from "@/lib/types";
import { checkInPct, formatAmount, paySymbol, shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin") return <Outlet />;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const { me, refresh, config } = useSession();
  const navigate = useNavigate();
  const [infra, setInfra] = useState<InfraStatus | null>(null);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [payouts, setPayouts] = useState<WithdrawRequest[]>([]);
  const [ops, setOps] = useState<LedgerRow[]>([]);
  const [pending, setPending] = useState<PendingIndexRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const chain = useChainRun();
  const symbol = paySymbol(config);
  const explorer = config?.explorerUrl ?? "";

  async function load() {
    const [data, evs, pays, signerOps, lagged] = await Promise.all([
      fetchInfra(),
      fetchAdminEvents(),
      fetchWithdrawals(),
      fetchSignerOps(),
      fetchPendingIndex(),
    ]);
    setInfra(data);
    setEvents(evs);
    setPayouts(pays);
    setOps(signerOps);
    setPending(lagged);
  }

  useEffect(() => {
    if (me?.isAdmin) void load().catch((e) => toast.error(friendlyChainError(e)));
  }, [me?.isAdmin]);

  async function runOp(id: string, labels: string[], fn: (tick: (n: number) => void) => Promise<void>) {
    setBusy(id);
    try {
      await chain.run({
        title: id.startsWith("frz-") ? "Update event access" : id.startsWith("payout-") || id.startsWith("reject-") ? "Review payout" : "Update event record",
        labels,
        task: async (tick) => {
          await fn(tick);
          return "The update is complete.";
        },
        retry: () => void runOp(id, labels, fn),
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    } finally {
      setBusy(null);
    }
  }

  if (!me) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Connect a wallet.</p>
      </AppShell>
    );
  }

  if (!me.isAdmin) {
    return (
      <AppShell>
        <h1 className="font-display text-4xl italic">Admin</h1>
        <Card className="mt-6 max-w-lg p-5">
          <p className="text-sm">
            This wallet is not the platform admin. The bootstrap file holds only the <strong>public</strong>{" "}
            admin wallet address — never a private key. Put that address in before start, or save this
            wallet once if none is configured yet. Operator keys, Pinata JWT and the database URL are
            stored in the connected database from Configuration.
          </p>
          {!config?.adminConfigured ? (
            <Button
              className="mt-4"
              onClick={() =>
                void (async () => {
                  await claimPlatformAdmin();
                  await refresh();
                  toast.success("Saved as platform admin");
                  navigate({ to: "/admin" });
                })()
              }
            >
              Save this wallet as platform admin
            </Button>
          ) : null}
        </Card>
      </AppShell>
    );
  }

  const incomplete = infra && !infra.setup.complete;

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Platform</p>
          <h1 className="font-display text-4xl italic">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void navigate({ to: "/admin/kyc" })}>
            KYC
          </Button>
          <Button variant="outline" onClick={() => void navigate({ to: "/admin/organizers" })}>
            Organizers
          </Button>
          <Button onClick={() => void navigate({ to: "/admin/config" })}>Configuration</Button>
        </div>
      </div>

      {incomplete ? (
        <Card className="mt-6 p-5">
          <p className="text-sm">
            First-run setup is incomplete. Order: Database → Pinata → Signer key. Optional: Dev mode
            (DxDAI). The bootstrap file is only the public admin address and RPC — secrets stay in the
            database.
          </p>
          <Button className="mt-3" onClick={() => void navigate({ to: "/admin/config" })}>
            Open setup
          </Button>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Signer</p>
          <p className="mt-2 font-mono text-sm">
            {infra?.chain.operatorAddress ? shortAddr(infra.chain.operatorAddress) : "not set"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {infra?.chain.lastAnchor
              ? `${infra.chain.lastAnchor.kind} · ${infra.chain.lastAnchor.hash.slice(0, 10)}…`
              : "no recent operator tx"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Pending payouts</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">
            {payouts.filter((p) => p.status === "pending" || p.status === "escalated").length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Chain index</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{pending.length}</p>
          <p className="mt-1 text-xs text-muted">chain ok, index lagged</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Events</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">{events.length}</p>
        </Card>
      </div>

      <ChainDialog {...chain} onClose={chain.close} />

      <h2 className="mt-10 font-display text-2xl italic">Chain index</h2>
      <p className="mt-1 text-sm text-muted">
        Chain is the source of truth. Rows here are receipts that landed on Chiado but failed to
        update the index. Retry replays the same verify + index path. Dismiss marks it resolved
        without changing tickets.
      </p>
      <div className="mt-3 divide-y divide-border rounded-xl border border-border">
        {pending.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No pending index rows.</p>
        ) : null}
        {pending.map((row) => (
          <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{row.kind}</Badge>
                <span className="font-mono text-xs text-muted">
                  {new Date(row.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs">
                <a
                  className="text-primary underline"
                  href={explorerTx(row.txHash, explorer)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.txHash.slice(0, 18)}…
                </a>
              </p>
              {row.error ? <p className="mt-1 text-xs text-danger">{row.error}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Replay this on-chain transaction into the index? The receipt is the source of truth.",
                    )
                  ) {
                    return;
                  }
                  void runOp(`retry-${row.id}`, ["Read receipt", "Wait one block", "Update index"], async (tick) => {
                    tick(1);
                    await retryPendingIndex({ data: { id: row.id } });
                    tick(3);
                    await load();
                    toast.success("Index replayed from chain");
                  });
                }}
              >
                Retry index
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => {
                  if (!window.confirm("Mark this as resolved without changing the index?")) return;
                  void runOp(`dismiss-${row.id}`, ["Mark resolved"], async (tick) => {
                    tick(0);
                    await dismissPendingIndex({ data: { id: row.id } });
                    tick(1);
                    await load();
                    toast.success("Dismissed");
                  });
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-2xl italic">Withdraw requests</h2>
      <p className="mt-1 text-sm text-muted">
        Legacy requests keep their original rules. Version 4 events open a seven-day opposition window; requests with at least one third opposed can be escalated here with materials.
      </p>
      <div className="mt-3 divide-y divide-border rounded-xl border border-border">
        {payouts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No requests yet.</p>
        ) : null}
        {payouts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm">
                {p.eventName} · {formatAmount(p.amountCents, symbol)}
              </p>
              <p className="font-mono text-xs text-muted">
                {shortAddr(p.organizerWallet)}
                {p.soldWeight || p.yesWeight ? ` · ${p.engineVersion && p.engineVersion >= 4 ? "opposed" : "support"} ${p.yesWeight}/${p.soldWeight}` : ""}
                {p.deadline ? ` · until ${new Date(p.deadline).toLocaleString()}` : ""}
              </p>
              {p.materialsUri ? (
                <a
                  className="font-mono text-xs text-primary underline"
                  href={gatewayUrl(p.materialsUri)}
                  target="_blank"
                  rel="noreferrer"
                >
                  materials
                </a>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={p.status === "done" ? "sage" : p.status === "rejected" ? "danger" : "mist"}>
                {p.status}
              </Badge>
              {p.status === "pending" || p.status === "escalated" ? (
                <>
                  <Button
                    size="sm"
                    disabled={busy !== null}
                    onClick={() =>
                      void runOp(`payout-${p.id}`, ["Review request", "Withdraw on-chain", "Index"], async (tick) => {
                        tick(1);
                        await decidePayout({ data: { requestId: p.id, approve: true } });
                        tick(3);
                        await load();
                        toast.success("Payout sent");
                      })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      void runOp(`reject-${p.id}`, ["Reject request", "Update index"], async (tick) => {
                        tick(0);
                        await decidePayout({ data: { requestId: p.id, approve: false } });
                        tick(2);
                        await load();
                        toast.success("Rejected — vault stays locked to holders");
                      })
                    }
                  >
                    Reject
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-2xl italic">All events <Hint>Freezing pauses buying, resale, transfers and withdrawals. Check-in stays available.</Hint></h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Freeze locks the marketplace, the vault, and the ERC-721 collection (no buy, list, transfer,
        or withdraw). Check-in can still run. Shows minted before the collection must be reminted.
      </p>
      <div className="mt-4 grid gap-3">
        {events.length === 0 ? (
          <Card className="p-5 text-sm text-muted">No events yet.</Card>
        ) : null}
        {events.map((ev) => (
          <Card key={ev.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2">
                  <PhaseBadge phase={ev.phase} />
                  {ev.frozen ? <Badge tone="danger">Frozen</Badge> : null}
                  {ev.withdrawn ? <Badge tone="ink">Withdrawn</Badge> : null}
                  {ev.engineVersion < 3 ? <Badge>Legacy</Badge> : null}
                  {ev.engineVersion >= 3 && !ev.collectionAddress ? <Badge tone="danger">No NFT</Badge> : null}
                  {ev.withdrawRequest === "pending_vote" ? (
                    <Badge>
                      Vote {ev.proposalYes}/{ev.proposalSold}
                    </Badge>
                  ) : null}
                  {ev.withdrawRequest === "escalated" ? <Badge tone="danger">Escalated</Badge> : null}
                  <Badge>{checkInPct(ev.checkInRate)} checked in</Badge>
                </div>
                <h3 className="mt-1 font-display text-xl italic">{ev.name}</h3>
                <p className="text-sm text-muted">
                  {ev.venue} · sold {ev.sold}/{ev.supply} · gate {ev.checkedIn} · vault{" "}
                  {formatAmount(ev.lockedCents, symbol)}
                </p>
                {ev.marketplaceAddress ? (
                  <p className="mt-1 font-mono text-xs text-muted">
                    <a
                      className="text-primary underline"
                      href={explorerAddress(ev.marketplaceAddress, explorer)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      market {shortAddr(ev.marketplaceAddress)}
                    </a>
                    {" · "}
                    <a
                      className="text-primary underline"
                      href={explorerAddress(ev.vaultAddress ?? "", explorer)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      vault {shortAddr(ev.vaultAddress ?? "")}
                    </a>
                    {ev.collectionAddress ? (
                      <>
                        {" · "}
                        <a
                          className="text-primary underline"
                          href={explorerAddress(ev.collectionAddress, explorer)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          collection {shortAddr(ev.collectionAddress)}
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <Button
                variant={ev.frozen ? "outline" : "danger"}
                disabled={busy !== null}
                onClick={() =>
                  void runOp(`frz-${ev.id}`, ["Sign freeze", "Wait one block", "Update index"], async (tick) => {
                    tick(0);
                    await freezeShow({ data: { eventId: ev.id, on: !ev.frozen } });
                    tick(3);
                    await load();
                    toast.success(ev.frozen ? "Unfrozen" : "Frozen");
                  })
                }
              >
                {ev.frozen ? "Unfreeze" : "Freeze"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 font-display text-2xl italic">Signer operations</h2>
      <p className="mt-1 text-sm text-muted">
        On-chain work the operator key has indexed: deploys, mints, check-ins, refunds, freezes,
        withdrawals. Click through to the explorer.
      </p>
      <div className="mt-3 divide-y divide-border rounded-xl border border-border">
        {ops.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No indexed operations yet.</p>
        ) : null}
        {ops.map((row) => (
          <div key={row.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
            <span>
              {row.kind} {row.eventName ? `· ${row.eventName}` : ""}{" "}
              {row.onChain ? <Badge tone="sage">on-chain</Badge> : <Badge>index</Badge>}
            </span>
            <span className="font-mono text-xs text-muted">
              {row.onChain ? (
                <a
                  className="text-primary underline"
                  href={explorerTx(row.ref, explorer)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.ref.slice(0, 12)}…
                </a>
              ) : (
                row.ref.slice(0, 18)
              )}
            </span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
