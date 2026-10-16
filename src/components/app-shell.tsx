import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LoadingVeil, ModalShell } from "@/components/tx-dialog";
import { Button } from "@/components/ui/button";
import { portalFor, useSession } from "@/components/session";
import { formatAmount, paySymbol, shortAddr } from "@/lib/utils";
import { getAddress } from "viem";

function Brand() {
  return (
    <Link to="/marketplace" className="flex items-center gap-2 text-fg">
      <span className="stub-mark" aria-hidden />
      <span className="font-display text-xl">ChainTicket</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
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
  const [open, setOpen] = useState(false);
  const lastIdentity = useRef<string | null>(null);
  const symbol = paySymbol(config);
  const veiled = gate !== "off";

  useEffect(() => {
    const identity = me ? `${me.address.toLowerCase()}:${me.role}` : null;
    const previous = lastIdentity.current;
    lastIdentity.current = identity;
    if (previous && identity && previous !== identity) {
      void navigate({ to: portalFor(me!) });
    } else if (previous && !identity && (pathname.startsWith("/admin") || pathname.startsWith("/organizer"))) {
      void navigate({ to: "/marketplace" });
    }
  }, [me, navigate, pathname]);

  async function signOut() {
    disconnect();
    setOpen(false);
    await navigate({ to: "/marketplace" });
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

  const links =
    me?.role === "admin"
      ? [
          { to: "/admin", label: "Desk" },
          { to: "/admin/kyc", label: "KYC" },
          { to: "/admin/organizers", label: "Organizers" },
          { to: "/admin/config", label: "Setup" },
        ]
      : me?.role === "organizer"
        ? [
            { to: "/organizer", label: "Shows" },
            { to: "/organizer/scan", label: "Gate" },
            { to: "/organizer/mint", label: "New show" },
          ]
        : [
            { to: "/marketplace", label: "Shows" },
            { to: "/my-tickets", label: "My tickets" },
          ];

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className={veiled ? "pointer-events-none brightness-75 blur-[2px] transition-[filter] duration-200" : "transition-[filter] duration-200"}>
        <header className="sticky top-0 z-30 border-b border-border bg-bg-elevated">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
            <Brand />
            <nav className="hidden items-center gap-1 md:flex">
              {links.map((l) => {
                const active =
                  l.to === "/admin" || l.to === "/organizer" ? pathname === l.to : pathname === l.to || pathname.startsWith(`${l.to}/`);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`border-b-2 px-3 py-2 text-sm ${active ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"}`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-2">
              {me ? (
                <div className="hidden items-center gap-2 px-2 py-2 font-mono text-xs md:flex">
                  <Wallet className="size-3.5" />
                  <span>{shortAddr(getAddress(me.address))}</span>
                  <span className="text-muted">{me.role}</span>
                  <button type="button" className="text-muted hover:text-fg" onClick={() => void signOut()}>
                    Sign out
                  </button>
                </div>
              ) : (
                <Button size="sm" onClick={requestConnect}>
                  Connect wallet
                </Button>
              )}
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)}>
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            </div>
          </div>
          {open ? (
            <div className="border-t border-border px-4 py-3 md:hidden">
              <div className="flex flex-col gap-1">
                {links.map((l) => (
                  <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="px-3 py-3 text-sm">
                    {l.label}
                  </Link>
                ))}
                {me ? (
                  <p className="px-3 py-2 font-mono text-xs text-muted">
                    {shortAddr(me.address)} · {formatAmount(me.spendableCents, symbol)}
                  </p>
                ) : (
                  <Button className="mt-2" onClick={() => { setOpen(false); requestConnect(); }}>
                    Connect wallet
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      </div>
      {gate === "pick" ? (
        <ModalShell title="Choose a wallet" onClose={cancelConnect}>
          <p className="text-sm text-muted">Pick one to sign in. You can browse shows without it.</p>
          <div className="mt-4 grid gap-2">
            {wallets.length ? (
              wallets.map((w) => (
                <Button
                  key={w.uuid}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => void connect(() => connectProvider(w.provider))}
                >
                  {w.icon ? <img src={w.icon} alt="" className="size-5" /> : <Wallet className="size-4" />}
                  {w.name}
                </Button>
              ))
            ) : (
              <p className="text-sm text-muted">No browser wallet found. Use a preview wallet instead.</p>
            )}
            <Button onClick={() => void connect(() => connectPreview())}>Preview wallet</Button>
          </div>
        </ModalShell>
      ) : null}
      {gate === "load" ? <LoadingVeil text="Loading your account…" /> : null}
    </div>
  );
}
