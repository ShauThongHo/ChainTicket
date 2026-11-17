import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, Menu, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChainDialog, isRouteDialogMounted, LoadingVeil, ModalShell } from "@/components/tx-dialog";
import { markSteps } from "@/components/tx-progress";
import { Button } from "@/components/ui/button";
import { portalFor, useSession } from "@/components/session";
import { formatAmount, paySymbol, shortAddr } from "@/lib/utils";
import { getAddress } from "viem";
import {
  clearActiveChainRun,
  loadActiveChainRun,
  requestOpenChainDialog,
  type PersistedChainRun,
} from "@/lib/tx-state";

function Brand() {
  return (
    <Link to="/marketplace" className="group flex items-center gap-2.5 text-fg transition-opacity hover:opacity-90">
      <span className="stub-mark transition-transform group-hover:scale-105" aria-hidden />
      <div className="flex flex-col">
        <span className="font-display text-xl font-bold tracking-tight">ChainTicket</span>
        <span className="text-[10px] font-mono leading-none text-muted">Vaulted Web3 Passes</span>
      </div>
    </Link>
  );
}

function ActiveChainFloatingPill({ explorer }: { explorer: string }) {
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
        onClick={() => requestOpenChainDialog()}
        className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/20 cursor-pointer"
      >
        View
      </button>
      {!isRunning ? (
        <button
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
  const [fallbackRun, setFallbackRun] = useState<PersistedChainRun | null>(null);
  const lastIdentity = useRef<string | null>(null);
  const symbol = paySymbol(config);
  const veiled = gate !== "off";

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
                    className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      active ? "bg-mist font-semibold text-primary shadow-xs" : "text-muted hover:bg-mist/50 hover:text-fg"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-2">
              {me ? (
                <div className="hidden items-center gap-2.5 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 font-mono text-xs md:flex">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Wallet className="size-3.5" />
                    <span className="font-semibold">{formatAmount(me.spendableCents, symbol)}</span>
                  </div>
                  <span className="text-border">|</span>
                  <span className="text-fg">{shortAddr(getAddress(me.address))}</span>
                  {me.role !== "buyer" ? (
                    <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] uppercase font-semibold text-primary">
                      {me.role}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="ml-1 text-muted transition-colors hover:text-danger"
                    onClick={() => void signOut()}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Button size="sm" onClick={requestConnect} className="shadow-xs">
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
      <ActiveChainFloatingPill explorer={config?.explorerUrl || "https://gnosis-chiado.blockscout.com"} />
      {fallbackRun ? (
        <ChainDialog
          open={Boolean(fallbackRun)}
          title={fallbackRun.title}
          steps={markSteps(fallbackRun.labels, fallbackRun.currentStep, fallbackRun.status === "error")}
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
