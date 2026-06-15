import { Timestamp } from "firebase/firestore";

export interface Employee {
  id: string;
  name: string;
  department: "Engineering" | "Finance" | "Operations";
  role: string;
  baseSalaryInr: number;
  bankRoutingHash: string;
  bankAccountHash: string;
  createdAt: Timestamp;
  isActive: boolean;
  avgMonthlyPay: number;
  lastPayrollDate: Timestamp | null;
  routingChangedAt: Timestamp | null;
  panNumber: string;
  pfAccountNumber: string;
  location: string;
}

export interface IndianDeductions {
  pfEmployee: number;
  pfEmployer: number;
  professionalTax: number;
  incomeTax: number;
  foodAllowanceDeduction: number;
  fuelAllowanceDeduction: number;
}

export interface IndianEarnings {
  basic: number;
  hra: number;
  specialAllowance: number;
  foodAllowance: number;
  flexiPay: number;
  fuelAllowance: number;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TxStatus = "PENDING" | "CLEARED" | "QUARANTINED" | "MANUAL_REVIEW";
export type RunStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface ShapContributions {
  routingChange: number;
  amountDeviation: number;
  velocitySpike: number;
  newBankAccount: number;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string; // "June 2026"
  payrollRunId: string;
  earnings: IndianEarnings;
  deductions: IndianDeductions;
  totalEarnings: number;
  totalContributions: number;
  totalDeductions: number;
  netPayable: number;
  paidOn: Timestamp;
  department: string;
  role: string;
  panNumber: string;
  pfAccountNumber: string;
  location: string;
  workingDays: number;
  lopDays: number;
}

export interface SalaryRevision {
  id: string;
  employeeId: string;
  effectiveDate: Timestamp;
  previousCtc: number;
  revisedCtc: number;
  incrementPercent: number;
  reason: string;
  approvedBy: string;
}

export interface Transaction {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  grossEarningsInr: number;
  deductions: IndianDeductions;
  netDisbursableInr: number;
  destinationRoutingHash: string;
  createdAt: Timestamp;
  status: TxStatus;
  anomalyScore: number;
  riskLevel: RiskLevel;
  flagReasons: string[];
  shapContributions: ShapContributions;
  validationToken: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  routingChangedWithin48h: boolean;
  isBankAccountNew: boolean;
  sharedRoutingHashCount: number;
}

export interface PayrollRun {
  id: string;
  runLabel: string;
  createdAt: Timestamp;
  status: RunStatus;
  totalEmployees: number;
  totalGrossInr: number;
  totalNetInr: number;
  flaggedCount: number;
  clearedCount: number;
  quarantinedCount: number;
}

export interface AuditLog {
  id: string;
  timestamp: Timestamp;
  action: string;
  entityType: "transaction" | "payroll_run" | "employee";
  entityId: string;
  performedBy: string;
  details: Record<string, unknown>;
}

export interface RiskConfig {
  anomalyScoreQuarantine: number;
  anomalyScoreReview: number;
  maxFprPercent: number;
  inferenceLatencyTargetMs: number;
  modelDriftDaysInterval: number;
  adaptiveScalingEnabled: boolean;
}

export interface ScoringResult {
  anomalyScore: number;
  riskLevel: RiskLevel;
  status: TxStatus;
  flagReasons: string[];
  shapContributions: ShapContributions;
  validationToken: string | null;
}
