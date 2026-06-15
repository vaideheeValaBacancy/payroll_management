"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Employee } from "@/types";

export function useEmployees(activeOnly = false) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const constraints = activeOnly ? [where("isActive", "==", true)] : [];
    const q = query(collection(db, "employees"), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(d => ({ ...d.data(), id: d.id } as Employee)));
      setLoading(false);
    });
    return unsub;
  }, [activeOnly]);

  return { employees, loading };
}
