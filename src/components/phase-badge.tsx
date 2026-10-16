import { Badge } from "@/components/ui/badge";
import type { EventPhase } from "@/lib/types";
import { phaseLabel } from "@/lib/utils";

export function PhaseBadge({ phase }: { phase: EventPhase }) {
  const tone = phase === "cancelled" ? "danger" : phase === "ended" ? "ink" : "sage";
  return <Badge tone={tone}>{phaseLabel(phase)}</Badge>;
}
