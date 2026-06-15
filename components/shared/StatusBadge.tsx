import { Badge } from "@/components/ui/badge";
import type { TxStatus } from "@/types";

const config: Record<TxStatus, { label: string; className: string }> = {
  PENDING: { label: "PENDING", className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  CLEARED: { label: "CLEARED", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  QUARANTINED: { label: "QUARANTINED", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  MANUAL_REVIEW: { label: "REVIEW", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

export function StatusBadge({ status }: { status: TxStatus }) {
  const { label, className } = config[status];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
