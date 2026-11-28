import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getAddress } from "viem";
import { ActiveChainStatus, WalletConnectModal } from "@/components/dark-shell-shared";
import { portalFor, useSession } from "@/components/session";
import { TopoCanvas } from "@/components/topo-canvas";
import { useAnimatedCents } from "@/lib/use-animated-cents";
import { formatAmount, paySymbol, shortAddr } from "@/lib/utils";
import "@/styles/public-dark.css";

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
    }
  }, [me, navigate]);

  async function signOut() {
    disconnect();
    setMobileOpen(false);
    await navigate({ to: pathname === "/my-tickets" ? "/my-tickets" : "/marketplace" });
  }

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

      <WalletConnectModal
        onConnected={async (dest) => {
          if (dest !== "/marketplace") await navigate({ to: dest });
        }}
      />

      <ActiveChainStatus
        explorerUrl={config?.explorerUrl || "https://gnosis-chiado.blockscout.com"}
      />
    </div>
  );
}
