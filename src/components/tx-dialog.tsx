import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { TxProgress, markSteps, type TxStep } from "@/components/tx-progress";
import { Button } from "@/components/ui/button";
import { friendlyChainError, isWalletRejection } from "@/lib/chain-errors";
import { explorerTx } from "@/lib/explorer";
import { shortAddr } from "@/lib/utils";
import { waitForTxReceipt } from "@/lib/wallet";
import type { Hex } from "viem";
import {
  clearActiveChainRun,
  loadActiveChainRun,
  saveActiveChainRun,
  updateActiveChainRun,
  type PersistedChainRun,
} from "@/lib/tx-state";

export function ModalShell({
  title,
  children,
  onClose,
  dismissible = true,
  isClosing = false,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  dismissible?: boolean;
  isClosing?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(frame);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const requestClose = useCallback(() => {
    if (!dismissible || !onClose || closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    timer.current = setTimeout(onClose, 180);
  }, [dismissible, onClose]);
  useEffect(() => {
    if (!dismissible || !onClose) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissible, onClose, requestClose]);

  return (
    <div
      className={`chain-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px] ${visible && !isClosing ? "is-visible" : ""}`}
      role="presentation"
      onMouseDown={() => {
        requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`chain-modal-panel w-full max-w-md border border-border bg-bg-elevated p-5 text-fg shadow-2xl shadow-ink/20 sm:p-6 ${visible && !isClosing ? "is-visible" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="font-display text-2xl">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function ChainDialog({
  open,
  title,
  steps,
  error,
  summary,
  doneLabel = "Close",
  onDone,
  finish,
  onClose,
  onRetry,
  successDetails,
  txHash,
  explorerUrl,
}: {
  open: boolean;
  title: string;
  steps: TxStep[];
  error: string | null;
  summary: string | null;
  doneLabel?: string;
  onDone?: () => void;
  finish?: () => void;
  onClose: () => void;
  onRetry?: () => void;
  successDetails?: ReactNode;
  txHash?: string | null;
  explorerUrl?: string;
}) {
  const [closing, setClosing] = useState(false);
  if (!open) return null;
  const closeWithFade = () => {
    setClosing(true);
    setTimeout(onClose, 190);
  };
  const busy = steps.some((s) => s.state === "processing");
  const finished = Boolean(summary) && !error && !busy;
  const activeTx = txHash || loadActiveChainRun()?.txHash;

  return (
    <ModalShell title={title} onClose={closeWithFade} dismissible={!busy} isClosing={closing}>
      <TxProgress steps={steps} error={error} />
      {activeTx ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-bg-surface px-3 py-2 text-xs font-mono">
          <span className="text-muted">On-Chain Tx:</span>
          <a
            href={explorerTx(activeTx, explorerUrl || "https://gnosis-chiado.blockscout.com")}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline flex items-center gap-1.5"
          >
            <span>{shortAddr(activeTx)}</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      ) : null}
      {finished && summary ? <p className="mt-4 text-sm">{summary}</p> : null}
      {finished ? successDetails : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {finished ? (
          <Button onClick={() => {
            setClosing(true);
            setTimeout(() => {
              onClose();
              (onDone ?? finish)?.();
            }, 190);
          }}>{doneLabel}</Button>
        ) : null}
        {error ? (
          <>
            {onRetry ? (
              <Button onClick={onRetry} disabled={busy}>
                Try again
              </Button>
            ) : null}
            <Button variant="outline" onClick={closeWithFade}>
              Close
            </Button>
          </>
        ) : null}
        {!finished && !error ? (
          <Button variant="outline" disabled={busy} onClick={closeWithFade}>
            {busy ? "Please wait" : "Close"}
          </Button>
        ) : null}
      </div>
    </ModalShell>
  );
}

export function LoadingVeil({ text }: { text: string }) {
  return (
      <ModalShell title="Loading your account" dismissible={false}>
      <div className="flex items-center gap-3 text-sm">
        <Loader2 className="motion-spin size-4 animate-spin text-primary" />
        <p>{text}</p>
      </div>
    </ModalShell>
  );
}

type ChainJob = {
  title: string;
  labels: string[];
  doneLabel?: string;
  onDone?: () => void;
  retry?: () => void;
  onError?: (error: unknown) => void;
  resumePayload?: {
    action?: string;
    data?: Record<string, unknown>;
  };
  task: (advance: (index: number) => void) => Promise<string>;
};

let routeDialogActive = false;
export function isRouteDialogMounted() {
  return routeDialogActive;
}

export function useChainRun() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<TxStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState("Close");
  const [canRetry, setCanRetry] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const doneRef = useRef<(() => void) | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const stepRef = useRef(0);

  useEffect(() => {
    routeDialogActive = true;
    return () => {
      routeDialogActive = false;
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSteps([]);
    setError(null);
    setSummary(null);
    setTxHash(null);
    clearActiveChainRun();
  }, []);

  // Restore on mount if an operation was active or finished
  useEffect(() => {
    const saved = loadActiveChainRun();
    if (!saved) return;

    setTitle(saved.title);
    setDoneLabel(saved.doneLabel || "Close");
    if (saved.txHash) setTxHash(saved.txHash);

    if (saved.status === "success") {
      setSteps(markSteps(saved.labels, saved.labels.length));
      setSummary(saved.summary || "Transaction confirmed.");
      setError(null);
      setOpen(true);
      return;
    }

    if (saved.status === "error") {
      setSteps(markSteps(saved.labels, saved.currentStep, true));
      setError(saved.error || "Operation failed.");
      setSummary(null);
      setOpen(true);
      return;
    }

    if (saved.status === "running") {
      setOpen(true);
      setSummary(null);
      setError(null);

      if (saved.txHash) {
        // Broadcast was sent to the blockchain, continue watching receipt!
        const stepIdx = Math.min(Math.max(saved.currentStep, 1), saved.labels.length - 1);
        setSteps(markSteps(saved.labels, stepIdx));

        let active = true;
        waitForTxReceipt(null, saved.txHash as Hex)
          .then(async (receipt) => {
            if (!active) return;
            if (receipt.status === "success") {
              // Execute resume server function if provided
              if (saved.resumePayload?.action === "buyNow" && saved.resumePayload.data) {
                try {
                  const { buyNow } = await import("@/lib/api");
                  await buyNow({
                    data: {
                      tierId: Number(saved.resumePayload.data.tierId),
                      txHash: saved.txHash!,
                      chainId: Number(saved.resumePayload.data.chainId),
                    },
                  });
                } catch {
                  // Ignore if already indexed
                }
              } else if (saved.resumePayload?.action === "sellTicket" && saved.resumePayload.data) {
                try {
                  const { sellTicket } = await import("@/lib/api");
                  await sellTicket({
                    data: {
                      ticketId: Number(saved.resumePayload.data.ticketId),
                      priceCents: Number(saved.resumePayload.data.priceCents),
                      txHash: saved.txHash!,
                    },
                  });
                } catch {
                  // Ignore
                }
              } else if (saved.resumePayload?.action === "cancelListing" && saved.resumePayload.data) {
                try {
                  const { cancelListing } = await import("@/lib/api");
                  await cancelListing({
                    data: {
                      ticketId: Number(saved.resumePayload.data.ticketId),
                      txHash: saved.txHash!,
                    },
                  });
                } catch {
                  // Ignore
                }
              } else if (saved.resumePayload?.action === "confirmVote" && saved.resumePayload.data) {
                try {
                  const { confirmVote } = await import("@/lib/api");
                  await confirmVote({
                    data: {
                      ticketId: Number(saved.resumePayload.data.ticketId),
                      txHash: saved.txHash!,
                    },
                  });
                } catch {
                  // Ignore
                }
              }

              const successMsg =
                saved.summary ||
                `Transaction confirmed on-chain in block #${receipt.blockNumber}!`;
              setSteps(markSteps(saved.labels, saved.labels.length));
              setSummary(successMsg);
              setError(null);
              updateActiveChainRun({
                status: "success",
                summary: successMsg,
                currentStep: saved.labels.length,
              });
            } else {
              const errMsg = "Transaction was reverted on-chain. Please check the explorer.";
              setSteps(markSteps(saved.labels, saved.labels.length, true));
              setError(errMsg);
              updateActiveChainRun({
                status: "error",
                error: errMsg,
              });
            }
          })
          .catch((err) => {
            if (!active) return;
            const errMsg = err instanceof Error ? err.message : "Confirmation wait timed out.";
            setError(errMsg);
            updateActiveChainRun({
              status: "error",
              error: errMsg,
            });
          });

        return () => {
          active = false;
        };
      } else {
        // Refreshed before user approved wallet signature
        if (Date.now() - saved.timestamp > 3000) {
          const errMsg =
            "Page was refreshed before the transaction was broadcast to the network. No tokens or funds were deducted.";
          setSteps(markSteps(saved.labels, saved.currentStep, true));
          setError(errMsg);
          updateActiveChainRun({
            status: "error",
            error: errMsg,
          });
        }
      }
    }
  }, []);

  // Listen for active chain run changes and reopen requests
  useEffect(() => {
    function onChainRunChange(e: Event) {
      const detail = (e as CustomEvent<PersistedChainRun | null>).detail;
      if (detail?.txHash) {
        setTxHash(detail.txHash);
      }
    }
    function onReopen() {
      const saved = loadActiveChainRun();
      if (saved) {
        setTitle(saved.title);
        setDoneLabel(saved.doneLabel || "Close");
        if (saved.txHash) setTxHash(saved.txHash);
        if (saved.status === "success") {
          setSteps(markSteps(saved.labels, saved.labels.length));
          setSummary(saved.summary || "Transaction confirmed.");
          setError(null);
        } else if (saved.status === "error") {
          setSteps(markSteps(saved.labels, saved.currentStep, true));
          setError(saved.error || "An error occurred.");
          setSummary(null);
        } else {
          setSteps(markSteps(saved.labels, saved.currentStep));
          setSummary(null);
          setError(null);
        }
        setOpen(true);
      }
    }

    window.addEventListener("ct:chain-run-changed", onChainRunChange);
    window.addEventListener("ct:chain-dialog-open", onReopen);
    return () => {
      window.removeEventListener("ct:chain-run-changed", onChainRunChange);
      window.removeEventListener("ct:chain-dialog-open", onReopen);
    };
  }, []);

  const run = useCallback(async (opts: ChainJob) => {
    doneRef.current = opts.onDone ?? null;
    retryRef.current = opts.retry ?? null;
    stepRef.current = 0;
    setTitle(opts.title);
    setDoneLabel(opts.doneLabel ?? "Close");
    setCanRetry(Boolean(opts.retry));
    setError(null);
    setSummary(null);
    setTxHash(null);
    setSteps(markSteps(opts.labels, 0));
    setOpen(true);

    const runId = Math.random().toString(36).slice(2) + Date.now();
    const initialRun: PersistedChainRun = {
      id: runId,
      title: opts.title,
      labels: opts.labels,
      currentStep: 0,
      status: "running",
      txHash: null,
      doneLabel: opts.doneLabel ?? "Close",
      timestamp: Date.now(),
      pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
      resumePayload: opts.resumePayload,
    };
    saveActiveChainRun(initialRun);

    const advance = (index: number) => {
      stepRef.current = index;
      setSteps(markSteps(opts.labels, index));
      updateActiveChainRun({ currentStep: index });
    };

    try {
      const text = await opts.task(advance);
      setSteps(markSteps(opts.labels, opts.labels.length));
      setSummary(text);
      setError(null);
      updateActiveChainRun({
        status: "success",
        summary: text,
        currentStep: opts.labels.length,
      });
    } catch (e) {
      const cancelled = isWalletRejection(e);
      const errMsg = cancelled
        ? "Wallet request cancelled. Your event or ticket was not changed. Close this message and try again when ready."
        : friendlyChainError(e);
      setSteps(markSteps(opts.labels, stepRef.current, true));
      setError(errMsg);
      setSummary(null);
      updateActiveChainRun({
        status: "error",
        error: errMsg,
        currentStep: stepRef.current,
      });
      opts.onError?.(e);
    }
  }, []);

  const finish = useCallback(() => {
    const fn = doneRef.current;
    close();
    fn?.();
  }, [close]);

  const retry = useCallback(() => {
    retryRef.current?.();
  }, []);

  return {
    open,
    title,
    steps,
    error,
    summary,
    doneLabel,
    canRetry,
    txHash,
    run,
    close,
    finish,
    retry,
  };
}
