"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AnomalyGauge } from "./AnomalyGauge";
import { ShapChart } from "./ShapChart";
import { RiskBadge } from "@/components/shared/RiskBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { updateTransaction, addAuditLog } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import type { Transaction } from "@/types";
import toast from "react-hot-toast";
import { useAppStore } from "@/store/useAppStore";

interface Props {
  tx: Transaction | null;
  onClose: () => void;
}

export function TxDrawer({ tx, onClose }: Props) {
  const { user } = useAppStore();

  const handleAction = async (action: "clear" | "escalate") => {
    if (!tx) return;
    const newStatus = action === "clear" ? "CLEARED" : "QUARANTINED";
    const auditAction = action === "clear" ? "MANUAL_CLEARED" : "TRANSACTION_ESCALATED";
    try {
      await updateTransaction(tx.id, { status: newStatus, reviewedBy: user?.email ?? "admin" });
      await addAuditLog({
        timestamp: Timestamp.now(),
        action: auditAction,
        entityType: "transaction",
        entityId: tx.id,
        performedBy: user?.email ?? "SYSTEM",
        details: { previousStatus: tx.status, employeeName: tx.employeeName },
      });
      toast.success(action === "clear" ? "Transaction cleared" : "Transaction escalated");
      onClose();
    } catch {
      toast.error("Action failed");
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <Sheet open={!!tx} onOpenChange={o => !o && onClose()}>
      <SheetContent className="bg-slate-800 border-l border-slate-700 w-[440px] max-w-full overflow-y-auto">
        {tx && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="text-slate-100">{tx.employeeName}</SheetTitle>
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={tx.status} />
                <RiskBadge level={tx.riskLevel} />
              </div>
            </SheetHeader>

            <div className="flex justify-center mb-6">
              <AnomalyGauge score={tx.anomalyScore} />
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900/60 rounded-lg p-3 space-y-2">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Deductions</p>
                {Object.entries(tx.deductions).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-slate-400">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                    <span className="text-slate-200">{fmt(v as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm border-t border-slate-700 pt-2">
                  <span className="text-slate-300 font-medium">Gross</span>
                  <span className="text-slate-200">{fmt(tx.grossEarningsInr)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-400 font-medium">Net Disbursable</span>
                  <span className="text-green-400 font-bold">{fmt(tx.netDisbursableInr)}</span>
                </div>
              </div>

              <ShapChart shap={tx.shapContributions} />

              {tx.flagReasons.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Flag Reasons</p>
                  {tx.flagReasons.map(r => (
                    <div key={r} className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded">
                      ⚠ {r.replace(/_/g, " ")}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => handleAction("clear")}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm"
                >
                  Clear & Approve
                </Button>
                <Button
                  onClick={() => handleAction("escalate")}
                  variant="destructive"
                  className="flex-1 text-sm"
                >
                  Escalate
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
