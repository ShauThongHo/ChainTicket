import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { TxProgress, markSteps, type TxStep } from "@/components/tx-progress";
import { Button } from "@/components/ui/button";
import { friendlyChainError } from "@/lib/chain-errors";

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
}) {
  const [closing, setClosing] = useState(false);
  if (!open) return null;
  const closeWithFade = () => {
    setClosing(true);
    setTimeout(onClose, 190);
  };
  const busy = steps.some((s) => s.state === "processing");
  const finished = Boolean(summary) && !error && !busy;
  return (
    <ModalShell title={title} onClose={closeWithFade} dismissible={!busy} isClosing={closing}>
      <TxProgress steps={steps} error={error} />
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
  task: (advance: (index: number) => void) => Promise<string>;
};

export function useChainRun() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<TxStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState("Close");
  const [canRetry, setCanRetry] = useState(false);
  const doneRef = useRef<(() => void) | null>(null);
  const retryRef = useRef<(() => void) | null>(null);
  const stepRef = useRef(0);

  const close = useCallback(() => {
    setOpen(false);
    setSteps([]);
    setError(null);
    setSummary(null);
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
    setSteps(markSteps(opts.labels, 0));
    setOpen(true);
    const advance = (index: number) => {
      stepRef.current = index;
      setSteps(markSteps(opts.labels, index));
    };
    try {
      const text = await opts.task(advance);
      setSteps(markSteps(opts.labels, opts.labels.length));
      setSummary(text);
      setError(null);
    } catch (e) {
      setSteps(markSteps(opts.labels, stepRef.current, true));
      setError(friendlyChainError(e));
      setSummary(null);
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
    run,
    close,
    finish,
    retry,
  };
}
