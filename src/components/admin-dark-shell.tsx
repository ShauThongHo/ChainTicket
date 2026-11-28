import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getAddress } from "viem";
import { ActiveChainStatus, WalletConnectModal } from "@/components/dark-shell-shared";
import { portalFor, useSession } from "@/components/session";
import { TopoCanvas } from "@/components/topo-canvas";
import { claimPlatformAdmin } from "@/lib/api";
import { useAnimatedCents } from "@/lib/use-animated-cents";
import { formatAmount, paySymbol, shortAddr } from "@/lib/utils";
import "@/styles/public-dark.css";
import "@/styles/admin-dark.css";

const ADMIN_NAV_ITEMS = [
  { key: "dashboard", to: "/admin", label: "Dashboard" },
  { key: "list", to: "/admin/kyc", label: "List" },
  { key: "setup", to: "/admin/config", label: "Setup" },
] as const;

export function AdminDarkShell({ children }: { children: ReactNode }) {
  const { me, config, disconnect, requestConnect } = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastIdentity = useRef<string | null>(null);

  const displayCents = useAnimatedCents(me?.address, me?.spendableCents);
  const symbol = paySymbol(config);
  const networkLabel = config?.chainName || "Gnosis Chiado";

  useEffect(() => {
    const identity = me ? `${me.address.toLowerCase()}:${me.role}` : null;
    const previous = lastIdentity.current;
    lastIdentity.current = identity;
    if (previous && identity && previous !== identity) {
      void navigate({ to: portalFor(me!) });
    } else if (previous && !identity && pathname.startsWith("/admin")) {
      void navigate({ to: "/marketplace" });
    }
  }, [me, navigate, pathname]);

  async function signOut() {
    disconnect();
    setMobileOpen(false);
    await navigate({ to: "/marketplace" });
  }

  function isNavActive(key: (typeof ADMIN_NAV_ITEMS)[number]["key"]) {
    if (key === "dashboard") return pathname === "/admin";
    if (key === "list") return pathname === "/admin/kyc" || pathname === "/admin/organizers";
    return pathname === "/admin/config";
  }

  function handleNavClick(key: (typeof ADMIN_NAV_ITEMS)[number]["key"]) {
    setMobileOpen(false);
    if (key === "list" && pathname === "/admin/kyc") {
      window.dispatchEvent(new CustomEvent("ct:admin-list-reset"));
    }
  }

  return (
    <div className="ct-dark-theme ct-admin-theme">
      <div className="bg-stage" />
      <div className="grid-overlay" />
      <TopoCanvas />

      <header className="navbar">
        <div className="nav-left">
          <Link to="/" className="brand">
            <div className="brand-logo">CT</div>
            ChainTicket
          </Link>
          <nav className="nav-pills" aria-label="Admin">
            {ADMIN_NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className={isNavActive(item.key) ? "active" : undefined}
                onClick={() => handleNavClick(item.key)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="nav-right">
          <div className="network-chip" title={`Chain ID ${config?.chainId ?? 10200}`}>
            <span className="status-dot" />
            {networkLabel}
          </div>

          {me ? (
            <div className="admin-wallet-pill">
              <div className="wallet-balance-grp">
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
                <span>{formatAmount(displayCents, symbol)}</span>
              </div>
              <span className="pill-divider" />
              <span className="wallet-addr">{shortAddr(getAddress(me.address))}</span>
              <span className="role-badge-admin">
                {me.isAdmin ? "ADMIN" : me.role.toUpperCase()}
              </span>
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
          {ADMIN_NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={isNavActive(item.key) ? "active" : undefined}
              onClick={() => handleNavClick(item.key)}
            >
              {item.label}
            </Link>
          ))}
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

      <WalletConnectModal
        onConnected={async (dest) => {
          if (dest !== pathname) await navigate({ to: dest });
        }}
      />

      <ActiveChainStatus
        explorerUrl={config?.explorerUrl || "https://gnosis-chiado.blockscout.com"}
      />
    </div>
  );
}

/** Shared admin auth & role guard rendered inside AdminDarkShell. */
export function AdminAccessGate({
  allowClaimAdmin = false,
}: {
  allowClaimAdmin?: boolean;
}) {
  const { me, config, refresh, requestConnect } = useSession();
  const navigate = useNavigate();
  const [claiming, setClaiming] = useState(false);

  if (!me) {
    return (
      <main className="admin-gate-shell">
        <section className="glass-panel admin-gate-card">
          <div className="kicker-pill mb-4">
            Restricted Console · <span>Platform Admin</span>
          </div>
          <h1 className="dash-main-title mb-3">Admin Console</h1>
          <p className="text-sm leading-relaxed text-white/65 mb-6">
            Connect an authorized platform admin wallet to inspect events, review KYC credentials,
            manage verified organizers, and configure network settings.
          </p>
          <button type="button" className="btn-solid-mint" onClick={requestConnect}>
            Connect Wallet →
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-gate-shell">
      <section className="glass-panel admin-gate-card">
        <div className="kicker-pill mb-4">
          Access Restricted · <span>Admin Only</span>
        </div>
        <h1 className="dash-main-title mb-3">Admin</h1>
        {allowClaimAdmin ? (
          <p className="text-sm leading-relaxed text-white/70">
            This wallet is not the platform admin. The bootstrap file holds only the{" "}
            <strong className="text-white">public</strong> admin wallet address — never a private
            key. Put that address in before start, or save this wallet once if none is configured
            yet. Operator keys, Pinata JWT and the database URL are stored in the connected
            database from Configuration.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-white/70">
            This wallet ({shortAddr(me.address)}) does not have platform admin permissions.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {allowClaimAdmin && !config?.adminConfigured ? (
            <button
              type="button"
              className="btn-solid-mint"
              disabled={claiming}
              onClick={() =>
                void (async () => {
                  setClaiming(true);
                  try {
                    await claimPlatformAdmin();
                    await refresh();
                    toast.success("Saved as platform admin");
                    await navigate({ to: "/admin" });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not claim admin");
                  } finally {
                    setClaiming(false);
                  }
                })()
              }
            >
              {claiming ? "Saving..." : "Save this wallet as platform admin"}
            </button>
          ) : null}
          <Link to="/admin" className="btn-outline-glass inline-flex items-center no-underline">
            Back to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
