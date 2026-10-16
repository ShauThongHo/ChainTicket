import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("border border-border bg-bg-elevated", className)}
      {...props}
    />
  );
}
