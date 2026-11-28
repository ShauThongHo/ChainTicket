import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { portalFor, useSession } from "@/components/session";
import { ChainDialog, isRouteDialogMounted } from "@/components/tx-dialog";
import { markSteps } from "@/components/tx-progress";
import {
  clearActiveChainRun,
  loadActiveChainRun,
  requestOpenChainDialog,
  type PersistedChainRun,
} from "@/lib/tx-state";

/** Floating status pill and fallback dialog for active persisted on-chain runs. */
export function ActiveChainStatus({ explorerUrl }: { explorerUrl: string }) {
  const [run, setRun] = useState<PersistedChainRun | null>(null);
  const [fallbackRun, setFallbackRun] = useState<PersistedChainRun | null>(null);

  useEffect(() => {
    setRun(loadActiveChainRun());
    const onChange = () => {
      setRun(loadActiveChainRun());
    };
    const onOpen = () => {
      if (!isRouteDialogMounted()) {
        const active = loadActiveChainRun();
        if (active) setFallbackRun(active);
      }
    };
    window.addEventListener("ct:chain-run-changed", onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("ct:chain-dialog-open", onOpen);
    return () => {
      window.removeEventListener("ct:chain-run-changed", onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("ct:chain-dialog-open", onOpen);
    };
  }, []);

  const isRunning = run?.status === "running";
  const isSuccess = run?.status === "success";

  return (
    <>
      {run ? (
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
      ) : null}

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
          explorerUrl={explorerUrl}
          onClose={() => {
            setFallbackRun(null);
            clearActiveChainRun();
          }}
        />
      ) : null}
    </>
  );
}

/** Shared wallet-connect modal with EIP-6963 injected providers and preview wallet. */
export function WalletConnectModal({
  onConnected,
}: {
  onConnected: (dest: "/admin" | "/organizer" | "/marketplace") => Promise<void> | void;
}) {
  const { wallets, connectProvider, connectPreview, gate, requestConnect, cancelConnect, markAccountLoad } =
    useSession();

  useEffect(() => {
    if (gate !== "pick") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cancelConnect();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gate, cancelConnect]);

  const connect = useCallback(
    async (fn: () => Promise<Awaited<ReturnType<typeof connectPreview>>>) => {
      markAccountLoad();
      try {
        const user = await fn();
        if (!user) {
          requestConnect();
          return;
        }
        await onConnected(portalFor(user));
        cancelConnect();
      } catch (e) {
        requestConnect();
        toast.error(e instanceof Error ? e.message : "Could not connect");
      }
    },
    [cancelConnect, markAccountLoad, onConnected, requestConnect],
  );

  const modalOpen = gate !== "off";

  return (
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
  );
}
