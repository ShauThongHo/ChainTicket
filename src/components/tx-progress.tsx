import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type TxStepState = "pending" | "processing" | "success" | "error";

export type TxStep = {
  label: string;
  state: TxStepState;
  hint?: string;
};

const STATUS: Record<TxStepState, string> = {
  pending: "Pending",
  processing: "In progress",
  success: "Done",
  error: "Failed",
};

export function TxProgress({ steps, error }: { steps: TxStep[]; error?: string | null }) {
  if (!steps.length) return null;
  return (
    <ol className="grid gap-3">
      {steps.map((step, i) => (
        <li key={`${step.label}-${i}`} className="grid grid-cols-[1.25rem_1fr_auto] items-start gap-3 text-sm">
          <StepDot state={step.state} />
          <div>
            <p
              className={cn(
                step.state === "pending" && "text-muted",
                step.state === "processing" && "text-fg",
                step.state === "success" && "text-success",
                step.state === "error" && "text-danger",
              )}
            >
              {step.label}
            </p>
            {step.hint ? <p className="mt-0.5 font-mono text-xs text-muted">{step.hint}</p> : null}
            {step.state === "error" && error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
          </div>
          <span
            className={cn(
              "font-mono text-[11px] tracking-wide",
              step.state === "pending" && "text-muted",
              step.state === "processing" && "text-fg",
              step.state === "success" && "text-success",
              step.state === "error" && "text-danger",
            )}
          >
            {STATUS[step.state]}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StepDot({ state }: { state: TxStepState }) {
  if (state === "processing") {
    return <Loader2 className="motion-spin size-4 animate-spin text-primary" />;
  }
  if (state === "success") {
    return (
      <span className="grid size-4 place-items-center rounded-full bg-success text-paper">
        <Check className="size-3" />
      </span>
    );
  }
  if (state === "error") {
    return <span className="size-4 rounded-full bg-danger" />;
  }
  return <span className="size-4 rounded-full border border-border bg-mist" />;
}

export function markSteps(labels: string[], active: number, error = false): TxStep[] {
  return labels.map((label, i) => {
    if (error && i === active) return { label, state: "error" };
    if (i < active) return { label, state: "success" };
    if (i === active) return { label, state: "processing" };
    return { label, state: "pending" };
  });
}
