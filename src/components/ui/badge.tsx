import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "mist",
  ...props
}: React.ComponentProps<"span"> & { tone?: "mist" | "sage" | "danger" | "ink" }) {
  const tones = {
    mist: "bg-mist text-fg",
    sage: "bg-primary text-primary-fg",
    danger: "bg-danger/15 text-danger",
    ink: "bg-ink text-paper",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
