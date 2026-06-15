// Seed script — node scripts/seed.mjs
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, writeBatch, Timestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmpCz6tBzD1IRfHeeGw7Tg7Rlw4V-tprU",
  authDomain: "paymentmanagement-c4971.firebaseapp.com",
  projectId: "paymentmanagement-c4971",
  storageBucket: "paymentmanagement-c4971.firebasestorage.app",
  messagingSenderId: "878080272822",
  appId: "1:878080272822:web:7fbccbaf911b266525f917"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const uid = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
const hash = (s) => [...s].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0).toString(16).replace("-", "");
const daysAgo = (n) => Timestamp.fromDate(new Date(Date.now() - n * 86_400_000));
const fmt2 = (n) => parseFloat(n.toFixed(2));

// ─── Indian payroll calculation ────────────────────────────────────────────────
// CTC → monthly breakdown: basic 40%, HRA 20%, special 10%, food 8%, flexi 15%, fuel 7%
function calcEarnings(annualCtc) {
  const monthly = annualCtc / 12;
  const basic          = fmt2(monthly * 0.40);
  const hra            = fmt2(monthly * 0.20);
  const specialAllow   = fmt2(monthly * 0.10);
  const foodAllowance  = fmt2(monthly * 0.08);
  const flexiPay       = fmt2(monthly * 0.15);
  const fuelAllowance  = fmt2(monthly * 0.07);
  const total = fmt2(basic + hra + specialAllow + foodAllowance + flexiPay + fuelAllowance);
  return { basic, hra, specialAllowance: specialAllow, foodAllowance, flexiPay, fuelAllowance, total };
}

function calcDeductions(earnings) {
  const pfEmployee            = fmt2(Math.min(earnings.basic * 0.12, 1800));
  const pfEmployer            = pfEmployee;
  const professionalTax       = 200;
  const incomeTax             = fmt2(earnings.total * 0.10);
  const foodAllowanceDeduction = earnings.foodAllowance;
  const fuelAllowanceDeduction = earnings.fuelAllowance;
  const totalContributions = fmt2(pfEmployee + pfEmployer);
  const totalDeductions    = fmt2(professionalTax + incomeTax + foodAllowanceDeduction + fuelAllowanceDeduction);
  const netPayable         = fmt2(earnings.total - pfEmployee - totalDeductions);
  return {
    deductions: { pfEmployee, pfEmployer, professionalTax, incomeTax, foodAllowanceDeduction, fuelAllowanceDeduction },
    totalContributions,
    totalDeductions,
    netPayable,
  };
}

function anomalyScore(grossInr, avgPay, routingChanged, newAccount, sharedCount) {
  let s = 0;
  const shap = { routingChange: 0, amountDeviation: 0, velocitySpike: 0, newBankAccount: 0 };
  const reasons = [];
  if (routingChanged) { s += 0.35; shap.routingChange = 0.35; reasons.push("routing_number_changed_48h"); }
  const ratio = grossInr / avgPay;
  if (ratio > 2.5) {
    const dev = Math.min((ratio - 2.5) / 2.5, 1) * 0.25;
    s += dev; shap.amountDeviation = fmt2(dev); reasons.push("amount_exceeds_2.5x_median");
  }
  if (newAccount) { s += 0.20; shap.newBankAccount = 0.20; reasons.push("new_bank_account_detected"); }
  if (sharedCount > 1) {
    const ring = Math.min(sharedCount * 0.10, 0.30);
    s += ring; shap.velocitySpike = fmt2(ring); reasons.push(`shared_routing_hash_${sharedCount}_employees`);
  }
  s = Math.min(s, 1.0);
  const score = fmt2(s);
  return {
    anomalyScore: score,
    riskLevel: s >= 0.75 ? "CRITICAL" : s >= 0.50 ? "HIGH" : s >= 0.25 ? "MEDIUM" : "LOW",
    status: s >= 0.75 ? "QUARANTINED" : s >= 0.50 ? "MANUAL_REVIEW" : "CLEARED",
    flagReasons: reasons,
    shapContributions: shap,
    validationToken: s < 0.75 ? uid() : null,
  };
}

// ─── Employee master ───────────────────────────────────────────────────────────
const locations = ["Mumbai", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Delhi"];
const employeeDefs = [
  // Engineering
  { name: "Arjun Sharma",       dept: "Engineering", role: "Senior Software Engineer",  ctc: 1800000, loc: "Bengaluru" },
  { name: "Priya Iyer",         dept: "Engineering", role: "Staff Engineer",             ctc: 2400000, loc: "Bengaluru" },
  { name: "Rohit Mehta",        dept: "Engineering", role: "Software Engineer II",       ctc: 1320000, loc: "Pune"      },
  { name: "Sneha Patil",        dept: "Engineering", role: "DevOps Engineer",            ctc: 1500000, loc: "Mumbai"    },
  { name: "Vikram Nair",        dept: "Engineering", role: "Software Engineer I",        ctc:  960000, loc: "Hyderabad" },
  { name: "Deepa Krishnamurthy",dept: "Engineering", role: "Engineering Manager",        ctc: 2700000, loc: "Bengaluru" },
  { name: "Karan Joshi",        dept: "Engineering", role: "Software Engineer II",       ctc: 1260000, loc: "Pune"      },
  { name: "Ananya Reddy",       dept: "Engineering", role: "Senior Software Engineer",   ctc: 1920000, loc: "Hyderabad" },
  // Finance
  { name: "Suresh Gupta",       dept: "Finance",     role: "Finance Manager",            ctc: 2100000, loc: "Mumbai"    },
  { name: "Kavita Desai",       dept: "Finance",     role: "Accountant",                 ctc: 1080000, loc: "Mumbai"    },
  { name: "Rajesh Verma",       dept: "Finance",     role: "Financial Analyst",          ctc: 1200000, loc: "Delhi"     },
  { name: "Meera Pillai",       dept: "Finance",     role: "Payroll Specialist",         ctc:  900000, loc: "Chennai"   },
  { name: "Aditya Kulkarni",    dept: "Finance",     role: "Accountant",                 ctc: 1140000, loc: "Pune"      },
  // Operations
  { name: "Sunita Rao",         dept: "Operations",  role: "Operations Director",        ctc: 2640000, loc: "Mumbai"    },
  { name: "Nikhil Agarwal",     dept: "Operations",  role: "Operations Manager",         ctc: 1740000, loc: "Delhi"     },
  { name: "Pooja Sinha",        dept: "Operations",  role: "Operations Analyst",         ctc:  960000, loc: "Bengaluru" },
  { name: "Amit Tiwari",        dept: "Operations",  role: "Operations Coordinator",     ctc:  780000, loc: "Hyderabad" },
  { name: "Divya Menon",        dept: "Operations",  role: "Operations Specialist",      ctc:  900000, loc: "Chennai"   },
  { name: "Gaurav Bhatia",      dept: "Operations",  role: "Operations Analyst",         ctc: 1020000, loc: "Pune"      },
  { name: "Swati Chaudhary",    dept: "Operations",  role: "Operations Manager",         ctc: 1680000, loc: "Delhi"     },
];

function panNumber(name, i) {
  const alpha = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3).padEnd(3, "X");
  return `${alpha}P${String(1000 + i).padStart(4, "0")}K`;
}
function pfNumber(i) {
  const states = ["MH", "KA", "DL", "TN", "AP"];
  return `${states[i % 5]}/MUM/${String(100000 + i)}/000/${String(1000 + i)}`;
}

const employees = employeeDefs.map((def, i) => {
  const id = "emp_" + String(i + 1).padStart(3, "0");
  const routingGroup = def.dept + Math.floor(i / 4);
  return {
    id,
    name: def.name,
    department: def.dept,
    role: def.role,
    baseSalaryInr: def.ctc,
    avgMonthlyPay: fmt2(def.ctc / 12),
    bankRoutingHash: hash(routingGroup),
    bankAccountHash: hash(def.name + id),
    isActive: true,
    createdAt: daysAgo(365 + i * 12),
    lastPayrollDate: daysAgo(1),
    routingChangedAt: null,
    panNumber: panNumber(def.name, i + 1),
    pfAccountNumber: pfNumber(i + 1),
    location: def.loc,
  };
});

// ─── Salary revisions (1–2 per employee) ──────────────────────────────────────
const revisionReasons = [
  "Annual performance appraisal",
  "Market correction",
  "Promotion",
  "Exceptional performance bonus revision",
  "Role change increment",
  "Annual increment cycle",
];
const approvers = ["Rajesh Kumar (CHRO)", "Sunita Rao (Director)", "Priya Iyer (EM)", "Suresh Gupta (CFO)"];

const allRevisions = [];
employees.forEach((emp, i) => {
  // First revision ~12 months ago
  const prev1 = fmt2(emp.baseSalaryInr * 0.82);
  const inc1 = fmt2(((emp.baseSalaryInr - prev1) / prev1) * 100);
  allRevisions.push({
    id: `rev_${emp.id}_1`,
    employeeId: emp.id,
    effectiveDate: daysAgo(365),
    previousCtc: prev1,
    revisedCtc: emp.baseSalaryInr,
    incrementPercent: inc1,
    reason: revisionReasons[i % revisionReasons.length],
    approvedBy: approvers[i % approvers.length],
  });
  // Second (older) revision for senior employees
  if (emp.baseSalaryInr >= 1500000) {
    const prev0 = fmt2(prev1 * 0.85);
    const inc0 = fmt2(((prev1 - prev0) / prev0) * 100);
    allRevisions.push({
      id: `rev_${emp.id}_0`,
      employeeId: emp.id,
      effectiveDate: daysAgo(730),
      previousCtc: prev0,
      revisedCtc: prev1,
      incrementPercent: inc0,
      reason: "Annual increment cycle",
      approvedBy: approvers[(i + 1) % approvers.length],
    });
  }
});

// ─── Payroll run + payslip + transaction data ─────────────────────────────────
const runDefs = [
  { id: "run_001", label: "June 2026 Payroll",   month: "June 2026",   daysBack: 1  },
  { id: "run_002", label: "May 2026 Payroll",    month: "May 2026",    daysBack: 32 },
  { id: "run_003", label: "April 2026 Payroll",  month: "April 2026",  daysBack: 62 },
  { id: "run_004", label: "March 2026 Payroll",  month: "March 2026",  daysBack: 92 },
];

// Anomaly injection: runIndex → [{empId, forceRouting, forceNewAccount, forceHighAmount}]
const anomalyMap = {
  0: [
    { empId: "emp_003", forceRouting: true },
    { empId: "emp_012", forceNewAccount: true },
    { empId: "emp_007", forceHighAmount: true },
  ],
  1: [
    { empId: "emp_005", forceRouting: true, forceNewAccount: true },
    { empId: "emp_015", forceHighAmount: true },
  ],
  2: [{ empId: "emp_018", forceRouting: true }],
  3: [],
};

const allRuns = [], allTxs = [], allPayslips = [], allAudit = [];

runDefs.forEach((runDef, runIdx) => {
  const createdAt = daysAgo(runDef.daysBack);
  const anomalies = anomalyMap[runIdx] || [];

  let totalGross = 0, totalNet = 0, flagged = 0, cleared = 0, quarantined = 0;

  employees.forEach((emp) => {
    const anomaly = anomalies.find(a => a.empId === emp.id);
    const variancePct = 0.97 + Math.random() * 0.06; // ±3% pay variance
    const earnings = calcEarnings(
      anomaly?.forceHighAmount ? emp.baseSalaryInr * 3.2 : emp.baseSalaryInr
    );
    // Apply small variance to non-fixed components
    earnings.specialAllowance = fmt2(earnings.specialAllowance * variancePct);
    earnings.total = fmt2(earnings.basic + earnings.hra + earnings.specialAllowance + earnings.foodAllowance + earnings.flexiPay + earnings.fuelAllowance);

    const { deductions, totalContributions, totalDeductions, netPayable } = calcDeductions(earnings);
    const routingChanged = !!(anomaly?.forceRouting);
    const newAccount     = !!(anomaly?.forceNewAccount);
    const sharedCount    = employees.filter(e => e.id !== emp.id && e.bankRoutingHash === emp.bankRoutingHash).length + 1;
    const sc = anomalyScore(earnings.total, emp.avgMonthlyPay, routingChanged, newAccount, sharedCount > 1 ? sharedCount : 0);

    totalGross += earnings.total;
    totalNet   += netPayable;
    if (sc.status === "CLEARED") cleared++;
    else if (sc.status === "QUARANTINED") { quarantined++; flagged++; }
    else flagged++;

    const txId      = `tx_${runDef.id}_${emp.id}`;
    const payslipId = `ps_${runDef.id}_${emp.id}`;

    allTxs.push({
      id: txId,
      payrollRunId: runDef.id,
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      grossEarningsInr: earnings.total,
      deductions,
      netDisbursableInr: netPayable,
      destinationRoutingHash: routingChanged ? hash(emp.name + "new") : emp.bankRoutingHash,
      createdAt,
      status: sc.status,
      anomalyScore: sc.anomalyScore,
      riskLevel: sc.riskLevel,
      flagReasons: sc.flagReasons,
      shapContributions: sc.shapContributions,
      validationToken: sc.validationToken,
      reviewedBy: null,
      reviewNote: null,
      routingChangedWithin48h: routingChanged,
      isBankAccountNew: newAccount,
      sharedRoutingHashCount: sharedCount,
    });

    allPayslips.push({
      id: payslipId,
      employeeId: emp.id,
      employeeName: emp.name,
      month: runDef.month,
      payrollRunId: runDef.id,
      earnings: {
        basic: earnings.basic,
        hra: earnings.hra,
        specialAllowance: earnings.specialAllowance,
        foodAllowance: earnings.foodAllowance,
        flexiPay: earnings.flexiPay,
        fuelAllowance: earnings.fuelAllowance,
      },
      deductions,
      totalEarnings: earnings.total,
      totalContributions,
      totalDeductions,
      netPayable,
      paidOn: createdAt,
      department: emp.department,
      role: emp.role,
      panNumber: emp.panNumber,
      pfAccountNumber: emp.pfAccountNumber,
      location: emp.location,
      workingDays: 26,
      lopDays: 0,
    });

    if (sc.status !== "CLEARED") {
      allAudit.push({
        timestamp: createdAt,
        action: sc.status === "QUARANTINED" ? "transaction_quarantined" : "transaction_flagged_review",
        entityType: "transaction",
        entityId: txId,
        performedBy: "system",
        details: { riskLevel: sc.riskLevel, anomalyScore: sc.anomalyScore, reasons: sc.flagReasons },
      });
    }
  });

  allRuns.push({
    id: runDef.id,
    runLabel: runDef.label,
    createdAt,
    status: "COMPLETED",
    totalEmployees: employees.length,
    totalGrossInr: fmt2(totalGross),
    totalNetInr: fmt2(totalNet),
    flaggedCount: flagged,
    clearedCount: cleared,
    quarantinedCount: quarantined,
  });

  allAudit.push({
    timestamp: createdAt,
    action: "payroll_run_completed",
    entityType: "payroll_run",
    entityId: runDef.id,
    performedBy: "admin@payroll.com",
    details: { totalGrossInr: fmt2(totalGross), employees: employees.length, flagged },
  });
});

// ─── Risk config ───────────────────────────────────────────────────────────────
const riskConfig = {
  anomalyScoreQuarantine: 0.75,
  anomalyScoreReview: 0.50,
  maxFprPercent: 0.05,
  inferenceLatencyTargetMs: 220,
  modelDriftDaysInterval: 30,
  adaptiveScalingEnabled: false,
};

// ─── Write ─────────────────────────────────────────────────────────────────────
async function batchWrite(collectionName, docs) {
  const BATCH = 400;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH).forEach(d => batch.set(doc(db, collectionName, d.id), d));
    await batch.commit();
    process.stdout.write(".");
  }
}

async function seed() {
  console.log("\nSeeding employees...");
  await batchWrite("employees", employees);
  console.log(` ✓ ${employees.length}`);

  console.log("Seeding payroll runs...");
  await batchWrite("payroll_runs", allRuns);
  console.log(` ✓ ${allRuns.length}`);

  console.log("Seeding transactions...");
  await batchWrite("transactions", allTxs);
  console.log(` ✓ ${allTxs.length}`);

  console.log("Seeding payslips...");
  await batchWrite("payslips", allPayslips);
  console.log(` ✓ ${allPayslips.length}`);

  console.log("Seeding salary revisions...");
  await batchWrite("salary_revisions", allRevisions);
  console.log(` ✓ ${allRevisions.length}`);

  console.log("Seeding audit logs...");
  for (const log of allAudit) {
    await setDoc(doc(db, "audit_log", uid()), log);
  }
  console.log(` ✓ ${allAudit.length}`);

  console.log("Seeding risk config...");
  await setDoc(doc(db, "risk_config", "thresholds"), riskConfig);
  console.log(" ✓");

  console.log("\n✅ Done!");
  allRuns.forEach(r => console.log(`   ${r.runLabel}: gross ₹${r.totalGrossInr.toLocaleString("en-IN")}, flagged ${r.flaggedCount}, quarantined ${r.quarantinedCount}`));
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
