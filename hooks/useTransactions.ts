"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Transaction } from "@/types";

export function useTransactions(limitCount = 100) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "transactions"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
      setLoading(false);
    });
    return unsub;
  }, [limitCount]);

  return { transactions, loading };
}
