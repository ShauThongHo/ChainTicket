import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminAccessGate, AdminDarkShell } from "@/components/admin-dark-shell";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import {
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
import { friendlyChainError } from "@/lib/chain-errors";
import { explorerAddress, explorerTx, gatewayUrl } from "@/lib/explorer";
import type {
  InfraStatus,
  LedgerRow,
  OrganizerEvent,
  PendingIndexRow,
  WithdrawRequest,
} from "@/lib/types";
import { checkInPct, formatAmount, paySymbol, phaseLabel, shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/admin") return <Outlet />;
  return <AdminDashboard />;
}

function withdrawBadgeClass(status: WithdrawRequest["status"]) {
  if (status === "done" || status === "approved" || status === "passed") return "done";
  if (status === "rejected") return "rejected";
  return "pending";
}

function AdminDashboard() {
  const { me, config } = useSession();
  const navigate = useNavigate();
  const [infra, setInfra] = useState<InfraStatus | null>(null);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [payouts, setPayouts] = useState<WithdrawRequest[]>([]);
  const [ops, setOps] = useState<LedgerRow[]>([]);
  const [pending, setPending] = useState<PendingIndexRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
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
        title: id.startsWith("frz-")
          ? "Update event access"
          : id.startsWith("payout-") || id.startsWith("reject-")
            ? "Review payout"
            : "Update event record",
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

  function copyAddress(key: string, value: string) {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((cur) => (cur === key ? null : cur));
    }, 1100);
  }

  function toggleInfoDrawer(eventId: number) {
    setExpandedEvents((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  }

  const q = searchQuery.trim().toLowerCase();

  const filteredEvents = useMemo(() => {
    if (!q) return events;
    return events.filter(
      (ev) =>
        ev.name.toLowerCase().includes(q) ||
        ev.venue.toLowerCase().includes(q) ||
        (ev.marketplaceAddress ?? "").toLowerCase().includes(q) ||
        (ev.vaultAddress ?? "").toLowerCase().includes(q) ||
        (ev.collectionAddress ?? "").toLowerCase().includes(q),
    );
  }, [events, q]);

  const filteredPayouts = useMemo(() => {
    if (!q) return payouts;
    return payouts.filter(
      (p) =>
        p.eventName.toLowerCase().includes(q) ||
        p.organizerWallet.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q) ||
        (p.txHash ?? "").toLowerCase().includes(q),
    );
  }, [payouts, q]);

  const filteredPending = useMemo(() => {
    if (!q) return pending;
    return pending.filter(
      (row) =>
        row.kind.toLowerCase().includes(q) ||
        row.txHash.toLowerCase().includes(q) ||
        (row.error ?? "").toLowerCase().includes(q),
    );
  }, [pending, q]);

  const filteredOps = useMemo(() => {
    if (!q) return ops;
    return ops.filter(
      (row) =>
        row.kind.toLowerCase().includes(q) ||
        (row.eventName ?? "").toLowerCase().includes(q) ||
        row.ref.toLowerCase().includes(q),
    );
  }, [ops, q]);

  if (!me || !me.isAdmin) {
    return (
      <AdminDarkShell>
        <AdminAccessGate allowClaimAdmin />
      </AdminDarkShell>
    );
  }

  const incomplete = infra && !infra.setup.complete;
  const pendingPayoutCount = payouts.filter(
    (p) => p.status === "pending" || p.status === "escalated",
  ).length;

  return (
    <AdminDarkShell>
      <main className="admin-shell">
        <div className="dash-header-row">
          <div className="dash-title-group">
            <h1 className="dash-main-title">Dashboard</h1>
            <span className="admin-role-pill">ADMIN CONSOLE</span>
          </div>

          <div className="dash-search-box">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events, contracts, tx hash..."
              aria-label="Search admin dashboard"
            />
          </div>
        </div>

        {incomplete ? (
          <div className="setup-alert-bar">
            <span className="setup-alert-text">
              Platform setup incomplete (Database, Storage, or Signer key required).
            </span>
            <button
              type="button"
              className="btn-mini-mint"
              onClick={() => void navigate({ to: "/admin/config" })}
            >
              Configure →
            </button>
          </div>
        ) : null}

        <div className="bento-grid">
          <div className="bento-left-col">
            {/* Top 4 KPI Cards */}
            <section className="kpi-4-grid">
              <div className="kpi-card accent-card">
                <div className="kpi-top-row">
                  <div className="kpi-icon-box">
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="kpi-label">SIGNER</div>
                  <div className="kpi-value">
                    {infra?.chain.operatorAddress ? shortAddr(infra.chain.operatorAddress) : "Not set"}
                  </div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-top-row">
                  <div className="kpi-icon-box">
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="kpi-label">PENDING PAYOUTS</div>
                  <div className="kpi-value">{pendingPayoutCount}</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-top-row">
                  <div className="kpi-icon-box">
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="kpi-label">CHAIN INDEX</div>
                  <div className="kpi-value">{pending.length}</div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-top-row">
                  <div className="kpi-icon-box">
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                      <path d="M13 5v2" />
                      <path d="M13 17v2" />
                      <path d="M13 11v2" />
                    </svg>
                  </div>
                </div>
                <div>
                  <div className="kpi-label">EVENTS</div>
                  <div className="kpi-value">{events.length}</div>
                </div>
              </div>
            </section>

            {/* Chain Index (shown when lagged index rows exist) */}
            {pending.length > 0 ? (
              <section className="glass-panel withdraw-panel">
                <div className="section-header-bar">
                  <h2 className="section-title">Chain Index</h2>
                  <span className="section-count-tag">
                    {filteredPending.length} Pending
                  </span>
                </div>

                <div className="withdraw-list">
                  {filteredPending.length === 0 ? (
                    <div className="empty-list-note">No matching pending index rows.</div>
                  ) : (
                    filteredPending.map((row) => (
                      <div key={row.id} className="withdraw-item">
                        <div className="min-w-0">
                          <div className="wd-title flex flex-wrap items-center gap-2">
                            <span className="ev-badge neutral">{row.kind}</span>
                            <span className="wd-sub">
                              {new Date(row.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="wd-sub mt-1">
                            <a
                              className="op-tx-link"
                              href={explorerTx(row.txHash, explorer)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {row.txHash.slice(0, 18)}…
                            </a>
                            {row.error ? (
                              <span className="ml-2 text-rose-300">{row.error}</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="wd-actions-grp">
                          <button
                            type="button"
                            className="btn-mini-mint"
                            disabled={busy !== null}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  "Replay this on-chain transaction into the index? The receipt is the source of truth.",
                                )
                              ) {
                                return;
                              }
                              void runOp(
                                `retry-${row.id}`,
                                ["Read receipt", "Wait one block", "Update index"],
                                async (tick) => {
                                  tick(1);
                                  await retryPendingIndex({ data: { id: row.id } });
                                  tick(3);
                                  await load();
                                  toast.success("Index replayed from chain");
                                },
                              );
                            }}
                          >
                            Retry index
                          </button>
                          <button
                            type="button"
                            className="btn-mini-outline"
                            disabled={busy !== null}
                            onClick={() => {
                              if (!window.confirm("Mark this as resolved without changing the index?"))
                                return;
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
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            {/* Withdraw Requests */}
            <section className="glass-panel withdraw-panel">
              <div className="section-header-bar">
                <h2 className="section-title">Withdraw Requests</h2>
                <span className="section-count-tag">
                  {q
                    ? `${filteredPayouts.length} of ${payouts.length} Requests`
                    : `${payouts.length} ${payouts.length === 1 ? "Request" : "Requests"}`}
                </span>
              </div>

              <div className="withdraw-list">
                {filteredPayouts.length === 0 ? (
                  <div className="empty-list-note">
                    {payouts.length === 0 ? "No requests yet." : "No matching withdraw requests."}
                  </div>
                ) : (
                  filteredPayouts.map((p) => (
                    <div key={p.id} className="withdraw-item">
                      <div>
                        <div className="wd-title">
                          {p.eventName} · {formatAmount(p.amountCents, symbol)}
                        </div>
                        <div className="wd-sub">
                          {shortAddr(p.organizerWallet)}
                          {p.soldWeight || p.yesWeight
                            ? ` · ${p.engineVersion && p.engineVersion >= 4 ? "opposed" : "support"} ${p.yesWeight}/${p.soldWeight}`
                            : ""}
                          {p.deadline ? ` · until ${new Date(p.deadline).toLocaleString()}` : ""}
                          {p.materialsUri ? (
                            <>
                              {" · "}
                              <a
                                className="op-tx-link"
                                href={gatewayUrl(p.materialsUri, config?.ipfsGateway)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                materials
                              </a>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="wd-actions-grp">
                        <span className={`wd-status-badge ${withdrawBadgeClass(p.status)}`}>
                          {p.status}
                        </span>
                        {p.status === "pending" || p.status === "escalated" ? (
                          <>
                            <button
                              type="button"
                              className="btn-mini-mint"
                              disabled={busy !== null}
                              onClick={() =>
                                void runOp(
                                  `payout-${p.id}`,
                                  ["Review request", "Withdraw on-chain", "Index"],
                                  async (tick) => {
                                    tick(1);
                                    await decidePayout({ data: { requestId: p.id, approve: true } });
                                    tick(3);
                                    await load();
                                    toast.success("Payout sent");
                                  },
                                )
                              }
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn-mini-outline"
                              disabled={busy !== null}
                              onClick={() =>
                                void runOp(
                                  `reject-${p.id}`,
                                  ["Reject request", "Update index"],
                                  async (tick) => {
                                    tick(0);
                                    await decidePayout({
                                      data: { requestId: p.id, approve: false },
                                    });
                                    tick(2);
                                    await load();
                                    toast.success("Rejected — vault stays locked to holders");
                                  },
                                )
                              }
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Events List + Collapsible Information Drawer */}
            <section className="glass-panel events-panel">
              <div className="section-header-bar">
                <h2 className="section-title">Events</h2>
                <span className="section-count-tag">
                  {q
                    ? `${filteredEvents.length} of ${events.length} Events`
                    : `${events.length} Total Events`}
                </span>
              </div>

              <div className="events-list">
                {filteredEvents.length === 0 ? (
                  <div className="empty-list-note">
                    {events.length === 0 ? "No events yet." : "No matching events found."}
                  </div>
                ) : (
                  filteredEvents.map((ev) => {
                    const isOpen = Boolean(expandedEvents[ev.id]);
                    const contracts = [
                      ev.marketplaceAddress
                        ? {
                            key: `mkt-${ev.id}`,
                            label: "Market:",
                            addr: ev.marketplaceAddress,
                          }
                        : null,
                      ev.vaultAddress
                        ? {
                            key: `vlt-${ev.id}`,
                            label: "Vault:",
                            addr: ev.vaultAddress,
                          }
                        : null,
                      ev.collectionAddress
                        ? {
                            key: `col-${ev.id}`,
                            label: "Collection (ERC-721):",
                            addr: ev.collectionAddress,
                          }
                        : null,
                    ].filter((c): c is { key: string; label: string; addr: string } => Boolean(c));

                    return (
                      <article
                        key={ev.id}
                        className={`admin-event-card${ev.frozen ? " is-frozen" : ""}`}
                      >
                        <div className="ev-card-main-row">
                          <div>
                            <div className="ev-badges-row">
                              <span className={`ev-badge ${ev.phase}`}>{phaseLabel(ev.phase)}</span>
                              {ev.frozen ? <span className="ev-badge frozen">FROZEN</span> : null}
                              {ev.withdrawn ? (
                                <span className="ev-badge withdrawn">Withdrawn</span>
                              ) : null}
                              {ev.engineVersion < 3 ? (
                                <span className="ev-badge neutral">Legacy</span>
                              ) : null}
                              {ev.engineVersion >= 3 && !ev.collectionAddress ? (
                                <span className="ev-badge frozen">No NFT</span>
                              ) : null}
                              {ev.withdrawRequest === "pending_vote" ? (
                                <span className="ev-badge neutral">
                                  Vote {ev.proposalYes}/{ev.proposalSold}
                                </span>
                              ) : null}
                              {ev.withdrawRequest === "escalated" ? (
                                <span className="ev-badge frozen">Escalated</span>
                              ) : null}
                              <span className="ev-badge neutral">
                                {checkInPct(ev.checkInRate)} checked in
                              </span>
                            </div>

                            <div className="ev-name">{ev.name}</div>
                          </div>

                          <div className="ev-right-controls">
                            <button
                              type="button"
                              className={`btn-info-toggle${isOpen ? " open" : ""}`}
                              onClick={() => toggleInfoDrawer(ev.id)}
                            >
                              {isOpen ? "▼ Information" : "▶ Information"}
                            </button>

                            <button
                              type="button"
                              className={`btn-freeze${ev.frozen ? " unfreeze-mode" : ""}`}
                              disabled={busy !== null}
                              onClick={() =>
                                void runOp(
                                  `frz-${ev.id}`,
                                  ["Sign freeze", "Wait one block", "Update index"],
                                  async (tick) => {
                                    tick(0);
                                    await freezeShow({ data: { eventId: ev.id, on: !ev.frozen } });
                                    tick(3);
                                    await load();
                                    toast.success(ev.frozen ? "Unfrozen" : "Frozen");
                                  },
                                )
                              }
                            >
                              {ev.frozen ? "Unfreeze" : "Freeze"}
                            </button>
                          </div>
                        </div>

                        <div className={`ev-info-drawer${isOpen ? " open" : ""}`}>
                          <div className="ev-info-inner">
                            <div className="ev-metrics-drawer-line">
                              {ev.venue || "TBA"} · sold {ev.sold}/{ev.supply} · gate{" "}
                              {ev.checkedIn} · vault {formatAmount(ev.lockedCents, symbol)}
                            </div>

                            {contracts.length > 0 ? (
                              <div className="ev-contracts-row">
                                {contracts.map((c) => (
                                  <div key={c.key} className="contract-chip-item">
                                    <span>{c.label}</span>
                                    <a
                                      href={explorerAddress(c.addr, explorer)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="contract-addr-link"
                                    >
                                      {shortAddr(c.addr)} ↗
                                    </a>
                                    <button
                                      type="button"
                                      className={`btn-copy-mini${copiedKey === c.key ? " copied" : ""}`}
                                      title="Copy address"
                                      onClick={() => copyAddress(c.key, c.addr)}
                                    >
                                      {copiedKey === c.key ? "✓" : "⧉"}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>

          {/* Right Sticky Sidebar: Signer Operations */}
          <aside className="bento-right-col">
            <section className="glass-panel signer-ops-panel">
              <div className="section-header-bar">
                <h2 className="section-title">Signer Operations</h2>
                <span className="section-count-tag">
                  {filteredOps.length} {filteredOps.length === 1 ? "Log" : "Logs"}
                </span>
              </div>

              <div className="ops-list">
                {filteredOps.length === 0 ? (
                  <div className="empty-list-note">
                    {ops.length === 0
                      ? "No indexed operations yet."
                      : "No matching operations."}
                  </div>
                ) : (
                  filteredOps.map((row) => (
                    <div key={row.id} className="op-row">
                      <div className="op-left">
                        <span className="op-action-text">
                          {row.kind}
                          {row.eventName ? ` · ${row.eventName}` : ""}
                        </span>
                        <span className={row.onChain ? "onchain-pill" : "index-pill"}>
                          {row.onChain ? "on-chain" : "index"}
                        </span>
                      </div>
                      {row.onChain ? (
                        <a
                          href={explorerTx(row.ref, explorer)}
                          target="_blank"
                          rel="noreferrer"
                          className="op-tx-link"
                        >
                          {row.ref.slice(0, 12)}…
                        </a>
                      ) : (
                        <span className="wd-sub">{row.ref.slice(0, 18)}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>

        <ChainDialog {...chain} onClose={chain.close} explorerUrl={explorer} />
      </main>
    </AdminDarkShell>
  );
}
