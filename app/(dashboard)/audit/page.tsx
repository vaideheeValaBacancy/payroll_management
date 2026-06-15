"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AuditLog } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function entityBadgeClass(entityType: AuditLog["entityType"]): string {
  switch (entityType) {
    case "transaction":
      return "bg-indigo-600 text-indigo-100 hover:bg-indigo-600";
    case "payroll_run":
      return "bg-green-700 text-green-100 hover:bg-green-700";
    case "employee":
      return "bg-amber-600 text-amber-100 hover:bg-amber-600";
    default:
      return "bg-slate-600 text-slate-100 hover:bg-slate-600";
  }
}

function formatEntityType(entityType: AuditLog["entityType"]): string {
  switch (entityType) {
    case "transaction":
      return "Transaction";
    case "payroll_run":
      return "Payroll Run";
    case "employee":
      return "Employee";
    default:
      return entityType;
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "audit_log"), orderBy("timestamp", "desc"), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-100">Audit Trail</h1>
          {!loading && (
            <Badge className="bg-indigo-600 text-indigo-100 hover:bg-indigo-600 text-sm px-2.5 py-0.5">
              {logs.length}
            </Badge>
          )}
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-100 text-lg font-semibold">
              System Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              /* Loading spinner */
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-slate-400 text-sm">
                    Loading audit logs…
                  </span>
                </div>
              </div>
            ) : logs.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm font-medium">
                  No audit logs found
                </p>
                <p className="text-slate-500 text-xs">
                  System activity will appear here once actions are performed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400 font-semibold whitespace-nowrap">
                        Timestamp
                      </TableHead>
                      <TableHead className="text-slate-400 font-semibold">
                        Action
                      </TableHead>
                      <TableHead className="text-slate-400 font-semibold whitespace-nowrap">
                        Entity Type
                      </TableHead>
                      <TableHead className="text-slate-400 font-semibold whitespace-nowrap">
                        Entity ID
                      </TableHead>
                      <TableHead className="text-slate-400 font-semibold whitespace-nowrap">
                        Performed By
                      </TableHead>
                      <TableHead className="text-slate-400 font-semibold">
                        Details
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const detailsJson = JSON.stringify(log.details);
                      const detailsPreview =
                        detailsJson.length > 80
                          ? detailsJson.slice(0, 80) + "…"
                          : detailsJson;

                      const ts =
                        log.timestamp && typeof log.timestamp.toDate === "function"
                          ? log.timestamp.toDate().toLocaleString()
                          : String(log.timestamp);

                      return (
                        <TableRow
                          key={log.id}
                          className="border-slate-700 hover:bg-slate-700/50 transition-colors"
                        >
                          <TableCell className="text-slate-300 text-sm whitespace-nowrap font-mono">
                            {ts}
                          </TableCell>
                          <TableCell className="text-slate-200 text-sm font-medium">
                            {log.action}
                          </TableCell>
                          <TableCell>
                            <Badge className={entityBadgeClass(log.entityType)}>
                              {formatEntityType(log.entityType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm font-mono">
                            {log.entityId.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">
                            {log.performedBy}
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs font-mono max-w-xs truncate">
                            {detailsPreview}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
