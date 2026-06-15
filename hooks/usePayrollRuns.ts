"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PayrollRun } from "@/types";

export function usePayrollRuns() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "payroll_runs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setRuns(snap.docs.map(d => ({ ...d.data(), id: d.id } as PayrollRun)));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { runs, loading };
}
