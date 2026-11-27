import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, Menu, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getAddress } from "viem";
import { portalFor, useSession } from "@/components/session";
import { TopoCanvas } from "@/components/topo-canvas";
import { ChainDialog, isRouteDialogMounted } from "@/components/tx-dialog";
import { markSteps } from "@/components/tx-progress";
import {
  clearActiveChainRun,
  loadActiveChainRun,
  requestOpenChainDialog,
  type PersistedChainRun,
} from "@/lib/tx-state";
import { formatAmount, paySymbol, shortAddr } from "@/lib/utils";
import "@/styles/public-dark.css";

function ActiveChainFloatingPill() {
  const [run, setRun] = useState<PersistedChainRun | null>(null);

  useEffect(() => {
    setRun(loadActiveChainRun());
    const onChange = () => {
      setRun(loadActiveChainRun());
    };
    window.addEventListener("ct:chain-run-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("ct:chain-run-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  if (!run) return null;

  const isRunning = run.status === "running";
  const isSuccess = run.status === "success";

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 rounded-full border border-border bg-bg-elevated/95 px-3.5 py-2 text-xs shadow-lg backdrop-blur-md transition-all">
      {isRunning ? (
        <Loader2 className="size-3.5 animate-spin text-primary" />
      ) : isSuccess ? (
        <CheckCircle2 className="size-3.5 text-sage" />
      ) : (
        <AlertTriangle className="size-3.5 text-danger" />
      )}
      <span className="max-w-[180px] sm:max-w-[240px] truncate font-medium">
        {isRunning
          ? `${run.title || "Transaction"} confirming…`
          : isSuccess
            ? `${run.title || "Transaction"} confirmed`
            : `${run.title || "Transaction"} failed`}
      </span>
      <button
        type="button"
        onClick={() => requestOpenChainDialog()}
        className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/20 cursor-pointer"
      >
        View
      </button>
      {!isRunning ? (
        <button
          type="button"
          onClick={() => clearActiveChainRun()}
          className="text-muted hover:text-fg ml-0.5 cursor-pointer"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/my-tickets", label: "My Tickets" },
] as const;

export function PublicDarkShell({
  children,
  homeViewport = false,
  navRightPrefix,
  mobileMenuExtra,
}: {
  children: ReactNode;
  homeViewport?: boolean;
  navRightPrefix?: ReactNode;
  mobileMenuExtra?: ReactNode;
}) {
  const {
    me,
    config,
    disconnect,
    wallets,
    connectProvider,
    connectPreview,
    gate,
    requestConnect,
    cancelConnect,
    markAccountLoad,
  } = useSession();

  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fallbackRun, setFallbackRun] = useState<PersistedChainRun | null>(null);
  const [displayCents, setDisplayCents] = useState<number>(me?.spendableCents ?? 0);
  const prevCentsRef = useRef<number | null>(me?.spendableCents ?? null);
  const lastIdentity = useRef<string | null>(null);

  const symbol = paySymbol(config);
  const networkLabel = config?.chainName || "Gnosis Chiado";

  useEffect(() => {
    const next = me?.spendableCents ?? 0;
    const prev = prevCentsRef.current;
    prevCentsRef.current = me ? next : null;
    if (!me || prev === null || next <= prev) {
      setDisplayCents(next);
      return;
    }
    let start: number | null = null;
    let rafId = 0;
    const duration = 450;
    function step(ts: number) {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayCents(Math.round(prev! + (next - prev!) * ease));
      if (p < 1) {
        rafId = requestAnimationFrame(step);
      }
    }
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [me?.address, me?.spendableCents]);

  useEffect(() => {
    function onOpen() {
      if (!isRouteDialogMounted()) {
        const run = loadActiveChainRun();
        if (run) setFallbackRun(run);
      }
    }
    window.addEventListener("ct:chain-dialog-open", onOpen);
    return () => window.removeEventListener("ct:chain-dialog-open", onOpen);
  }, []);

  useEffect(() => {
    const identity = me ? `${me.address.toLowerCase()}:${me.role}` : null;
    const previous = lastIdentity.current;
    lastIdentity.current = identity;
    if (previous && identity && previous !== identity) {
      void navigate({ to: portalFor(me!) });
    }
  }, [me, navigate]);

  useEffect(() => {
    if (gate !== "pick") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cancelConnect();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gate, cancelConnect]);

  async function signOut() {
    disconnect();
    setMobileOpen(false);
    await navigate({ to: pathname === "/my-tickets" ? "/my-tickets" : "/marketplace" });
  }

  async function connect(fn: () => Promise<Awaited<ReturnType<typeof connectPreview>>>) {
    markAccountLoad();
    try {
      const user = await fn();
      if (!user) {
        requestConnect();
        return;
      }
      const dest = portalFor(user);
      if (dest !== "/marketplace") await navigate({ to: dest });
      cancelConnect();
    } catch (e) {
      requestConnect();
      toast.error(e instanceof Error ? e.message : "Could not connect");
    }
  }

  const modalOpen = gate !== "off";

  return (
    <div className={homeViewport ? "ct-dark-theme ct-home-viewport" : "ct-dark-theme"}>
      <div className="bg-stage" />
      <div className="grid-overlay" />
      <TopoCanvas />

      <header className="navbar">
        <div className="nav-left">
          <Link to="/" className="brand">
            <div className="brand-logo">CT</div>
            ChainTicket
          </Link>
          <nav className="nav-pills" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link key={item.to} to={item.to} className={active ? "active" : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="nav-right">
          {navRightPrefix}

          <div className="network-chip" title={`Chain ID ${config?.chainId ?? 10200}`}>
            <span className="status-dot" />
            {networkLabel}
          </div>

          {me ? (
            <div className="attendee-wallet-pill">
              <div className="wallet-balance-grp">
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
                <span>{formatAmount(displayCents, symbol)}</span>
              </div>
              <span className="pill-divider" />
              <span className="wallet-addr">{shortAddr(getAddress(me.address))}</span>
              {me.role !== "attendee" ? (
                <Link
                  to={me.role === "admin" ? "/admin" : "/organizer"}
                  className="role-badge-attendee"
                >
                  {me.role.toUpperCase()}
                </Link>
              ) : (
                <span className="role-badge-attendee">ATTENDEE</span>
              )}
              <button
                type="button"
                className="btn-sign-out"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button type="button" className="btn-connect" onClick={requestConnect}>
              Connect Wallet →
            </button>
          )}

          <button
            type="button"
            className="mobile-menu-btn"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <div className="mobile-nav-drawer md:hidden">
          {NAV_ITEMS.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active ? "active" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
          {mobileMenuExtra}
          {me ? (
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-xs text-white/75">
              <span>
                {shortAddr(getAddress(me.address))} · {formatAmount(displayCents, symbol)}
              </span>
              <button
                type="button"
                className="text-rose-300"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {children}

      {/* Frosted Glass Wallet Selection & Loading Modal */}
      <div
        className={`wallet-modal-backdrop${modalOpen ? " open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget && gate === "pick") cancelConnect();
        }}
      >
        <div
          className="wallet-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="walletModalTitle"
        >
          {gate === "pick" ? (
            <button
              type="button"
              className="modal-close-x"
              title="Close"
              onClick={cancelConnect}
            >
              ✕
            </button>
          ) : null}

          {gate === "pick" ? (
            <div className="modal-view">
              <h3 className="modal-title" id="walletModalTitle">
                Choose a wallet
              </h3>
              <p className="modal-sub">
                Pick one to sign in. You can browse shows without it.
              </p>

              <div className="wallet-options-list">
                {wallets.length ? (
                  wallets.map((w) => (
                    <button
                      key={w.uuid}
                      type="button"
                      className="wallet-option-btn"
                      onClick={() => void connect(() => connectProvider(w.provider))}
                    >
                      <div className="wallet-option-left">
                        <div className="wallet-icon-badge">
                          {w.icon ? (
                            <img src={w.icon} alt="" />
                          ) : (
                            <Wallet className="size-4 text-white" />
                          )}
                        </div>
                        <span className="wallet-option-name">{w.name}</span>
                      </div>
                      <span className="wallet-option-status">Connect →</span>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-white/55 mb-1">
                    No browser wallet found. Use a preview wallet instead.
                  </p>
                )}

                <button
                  type="button"
                  className="wallet-option-btn"
                  onClick={() => void connect(() => connectPreview())}
                >
                  <div className="wallet-option-left">
                    <div className="wallet-icon-badge">
                      <Wallet className="size-4 text-[#6ee7b7]" />
                    </div>
                    <span className="wallet-option-name">Preview wallet</span>
                  </div>
                  <span className="wallet-option-status">Connect →</span>
                </button>
              </div>
            </div>
          ) : null}

          {gate === "load" ? (
            <div className="modal-view loading-view-box">
              <h3 className="loading-view-title">Loading your account</h3>
              <div className="loading-status-row">
                <span className="account-spinner" />
                <span>Loading your account...</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ActiveChainFloatingPill />
      {fallbackRun ? (
        <ChainDialog
          open={Boolean(fallbackRun)}
          title={fallbackRun.title}
          steps={markSteps(
            fallbackRun.labels,
            fallbackRun.currentStep,
            fallbackRun.status === "error",
          )}
          error={fallbackRun.error ?? null}
          summary={fallbackRun.summary ?? null}
          doneLabel={fallbackRun.doneLabel || "Close"}
          txHash={fallbackRun.txHash}
          explorerUrl={config?.explorerUrl || "https://gnosis-chiado.blockscout.com"}
          onClose={() => {
            setFallbackRun(null);
            clearActiveChainRun();
          }}
        />
      ) : null}
    </div>
  );
}
