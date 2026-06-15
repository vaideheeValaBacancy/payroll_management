import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/types";

const config: Record<RiskLevel, { label: string; className: string }> = {
  LOW: { label: "LOW", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  MEDIUM: { label: "MEDIUM", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  HIGH: { label: "HIGH", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  CRITICAL: { label: "CRITICAL", className: "bg-red-600/20 text-red-400 border-red-600/30 animate-pulse" },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const { label, className } = config[level];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
