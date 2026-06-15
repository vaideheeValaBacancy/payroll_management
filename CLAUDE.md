# CLAUDE.md — Agent Scratchpad

## Project: payroll_management | Firebase: paymentManagement

## Decisions Log

### Phase 0 — Bootstrap ✅
- Next.js 14 App Router, TypeScript, Tailwind initialized
- shadcn/ui initialized (base-nova style)
- Dependencies installed: firebase, zustand, react-hook-form, zod, recharts, react-hot-toast, next-pwa
- shadcn components added: badge, card, dialog, dropdown-menu, input, label, select, sheet, table, tabs

### Phase 1 — Types + Firebase ✅
- types/index.ts with all interfaces
- lib/firebase.ts with hardcoded config (no .env)
- lib/firestore.ts with typed CRUD helpers

### Phase 2 — Engines ✅
- lib/scoringEngine.ts — deterministic rule-based
- lib/deductionEngine.ts

### Phase 3 — Auth ✅
- app/(auth)/login/page.tsx
- store/useAppStore.ts
- app/(dashboard)/layout.tsx with auth guard

### Phase 4 — Sidebar + Shell ✅
- components/layout/Sidebar.tsx

### Phase 5 — Dashboard ✅
- hooks: useTransactions, useEmployees, usePayrollRuns
- components: StatsCards, RiskDonut, LiveFeed
- app/(dashboard)/page.tsx

### Phase 6 — Employees ✅
- components/employees/EmployeeTable.tsx
- app/(dashboard)/employees/page.tsx

### Phase 7 — Payroll Runs ✅
- components/payroll/PayrollTable.tsx
- app/(dashboard)/payroll/page.tsx + [runId]/page.tsx

### Phase 8 — Transactions ✅
- TxTable, TxDrawer, AnomalyGauge, ShapChart
- app/(dashboard)/transactions/page.tsx

### Phase 9 — Audit + Config ✅
- /audit page
- /config page

### Phase 10 — PWA + Seed ✅
- next-pwa config
- manifest.json
- seedFirestore.ts

## Key Decisions
- All monetary values stored as number (dollars, 2dp)
- No .env.local — Firebase config hardcoded per spec
- react-hot-toast for all user feedback
- All onSnapshot listeners cleaned up in useEffect return
