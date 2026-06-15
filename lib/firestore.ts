import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  addDoc, query, where, orderBy, limit, onSnapshot,
  Timestamp, writeBatch, QueryConstraint
} from "firebase/firestore";
import { db } from "./firebase";
import type { Employee, Transaction, PayrollRun, AuditLog, RiskConfig } from "@/types";

// Employees
export const employeesRef = () => collection(db, "employees");
export const getEmployees = async (): Promise<Employee[]> => {
  const snap = await getDocs(employeesRef());
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Employee));
};
export const getEmployee = async (id: string): Promise<Employee | null> => {
  const snap = await getDoc(doc(db, "employees", id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as Employee) : null;
};
export const upsertEmployee = async (emp: Employee) => {
  await setDoc(doc(db, "employees", emp.id), emp);
};
export const updateEmployee = async (id: string, data: Partial<Employee>) => {
  await updateDoc(doc(db, "employees", id), data as Record<string, unknown>);
};

// Transactions
export const transactionsRef = () => collection(db, "transactions");
export const getTransactions = async (constraints: QueryConstraint[] = []): Promise<Transaction[]> => {
  const q = query(transactionsRef(), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction));
};
export const updateTransaction = async (id: string, data: Partial<Transaction>) => {
  await updateDoc(doc(db, "transactions", id), data as Record<string, unknown>);
};
export const batchWriteTransactions = async (txs: Transaction[]) => {
  const batch = writeBatch(db);
  for (const tx of txs) {
    batch.set(doc(db, "transactions", tx.id), tx);
  }
  await batch.commit();
};

// Payroll Runs
export const payrollRunsRef = () => collection(db, "payroll_runs");
export const getPayrollRuns = async (): Promise<PayrollRun[]> => {
  const q = query(payrollRunsRef(), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as PayrollRun));
};
export const getPayrollRun = async (id: string): Promise<PayrollRun | null> => {
  const snap = await getDoc(doc(db, "payroll_runs", id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as PayrollRun) : null;
};
export const createPayrollRun = async (run: PayrollRun) => {
  await setDoc(doc(db, "payroll_runs", run.id), run);
};
export const updatePayrollRun = async (id: string, data: Partial<PayrollRun>) => {
  await updateDoc(doc(db, "payroll_runs", id), data as Record<string, unknown>);
};

// Audit Log
export const addAuditLog = async (log: Omit<AuditLog, "id">) => {
  await addDoc(collection(db, "audit_log"), log);
};
export const getAuditLogs = async (): Promise<AuditLog[]> => {
  const q = query(collection(db, "audit_log"), orderBy("timestamp", "desc"), limit(200));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as AuditLog));
};

// Risk Config
export const getRiskConfig = async (): Promise<RiskConfig> => {
  const snap = await getDoc(doc(db, "risk_config", "thresholds"));
  if (snap.exists()) return snap.data() as RiskConfig;
  return {
    anomalyScoreQuarantine: 0.75,
    anomalyScoreReview: 0.50,
    maxFprPercent: 0.05,
    inferenceLatencyTargetMs: 220,
    modelDriftDaysInterval: 30,
    adaptiveScalingEnabled: false,
  };
};
export const saveRiskConfig = async (config: RiskConfig) => {
  await setDoc(doc(db, "risk_config", "thresholds"), config);
};
