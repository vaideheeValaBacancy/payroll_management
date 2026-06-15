"use client";
import { useState } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Timestamp } from "firebase/firestore";
import { upsertEmployee, addAuditLog } from "@/lib/firestore";
import { useAppStore } from "@/store/useAppStore";
import toast from "react-hot-toast";

const DEPARTMENTS = ["Engineering", "Finance", "Operations"] as const;
const LOCATIONS = ["Mumbai", "Bengaluru", "Pune", "Hyderabad", "Chennai", "Delhi"] as const;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

type Department = typeof DEPARTMENTS[number];
type Location = typeof LOCATIONS[number];

interface AddEmployeeForm {
  name: string;
  department: Department | "";
  role: string;
  annualCtc: string;
  location: Location | "";
  panNumber: string;
}

interface AddEmployeeErrors {
  name?: string;
  department?: string;
  role?: string;
  annualCtc?: string;
  location?: string;
  panNumber?: string;
}

const defaultForm: AddEmployeeForm = {
  name: "",
  department: "",
  role: "",
  annualCtc: "",
  location: "",
  panNumber: "",
};

export default function EmployeesPage() {
  const { employees, loading } = useEmployees();
  const user = useAppStore(s => s.user);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<AddEmployeeForm>(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<AddEmployeeErrors>({});

  // Ghost detection: only flag when MORE THAN 4 employees share the same routing hash
  const ghostCount = (() => {
    const counts: Record<string, number> = {};
    employees.forEach(e => { counts[e.bankRoutingHash] = (counts[e.bankRoutingHash] || 0) + 1; });
    return employees.filter(e => counts[e.bankRoutingHash] > 4).length;
  })();

  const validate = (): boolean => {
    const errs: AddEmployeeErrors = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!form.department) errs.department = "Required";
    if (!form.role.trim()) errs.role = "Required";
    if (!form.annualCtc || isNaN(Number(form.annualCtc)) || Number(form.annualCtc) <= 0)
      errs.annualCtc = "Must be a positive number";
    if (!form.location) errs.location = "Required";
    if (!PAN_REGEX.test(form.panNumber.toUpperCase()))
      errs.panNumber = "Must be in format ABCDE1234F";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const now = Date.now();
      const empId = `emp_${now}`;
      const annualCtc = Number(form.annualCtc);
      const department = form.department as Department;
      const location = form.location as Location;

      const newEmployee = {
        id: empId,
        name: form.name.trim(),
        department,
        role: form.role.trim(),
        baseSalaryInr: Math.round(annualCtc / 12),
        avgMonthlyPay: annualCtc / 12,
        bankRoutingHash: btoa(department + now.toString()).slice(0, 16),
        bankAccountHash: btoa(form.name.trim() + now.toString()).slice(0, 32),
        pfAccountNumber: `MH/MUM/${now}/000/001`,
        panNumber: form.panNumber.toUpperCase(),
        location,
        isActive: true,
        createdAt: Timestamp.now(),
        lastPayrollDate: null,
        routingChangedAt: null,
      };

      await upsertEmployee(newEmployee);
      await addAuditLog({
        timestamp: Timestamp.now(),
        action: "employee_added",
        entityType: "employee",
        entityId: empId,
        performedBy: user?.email ?? "unknown",
        details: { name: newEmployee.name, department, role: newEmployee.role },
      });

      toast.success("Employee added successfully");
      setShowAddModal(false);
      setForm(defaultForm);
      setErrors({});
    } catch {
      toast.error("Failed to add employee");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setShowAddModal(false);
      setForm(defaultForm);
      setErrors({});
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100 text-2xl font-bold">Employee Registry</h1>
          <p className="text-slate-400 text-sm mt-1">
            {employees.length} employees · {employees.filter(e => e.isActive).length} active
          </p>
        </div>
        <div className="flex items-center gap-3">
          {ghostCount > 0 && (
            <Badge className="bg-red-600/20 text-red-400 border-red-600/30 border px-3 py-1">
              ⚠ {ghostCount} Ghost Employee Risk Detected
            </Badge>
          )}
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            + Add Employee
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <EmployeeTable employees={employees} />
      )}

      <Dialog open={showAddModal} onOpenChange={handleClose}>
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-slate-100 text-lg font-semibold">Add New Employee</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Full Name <span className="text-red-400">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Priya Sharma"
                className="bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
              />
              {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Department <span className="text-red-400">*</span></Label>
              <Select
                value={form.department}
                onValueChange={v => setForm(f => ({ ...f, department: v as Department }))}
              >
                <SelectTrigger className="bg-slate-900 border-slate-600 text-slate-100 focus:ring-indigo-500">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d} value={d} className="focus:bg-slate-700">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department && <p className="text-red-400 text-xs">{errors.department}</p>}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Role <span className="text-red-400">*</span></Label>
              <Input
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="Senior Software Engineer"
                className="bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
              />
              {errors.role && <p className="text-red-400 text-xs">{errors.role}</p>}
            </div>

            {/* Annual CTC */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Annual CTC in ₹ <span className="text-red-400">*</span></Label>
              <Input
                type="number"
                value={form.annualCtc}
                onChange={e => setForm(f => ({ ...f, annualCtc: e.target.value }))}
                placeholder="1200000"
                min={1}
                className="bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
              />
              {errors.annualCtc && <p className="text-red-400 text-xs">{errors.annualCtc}</p>}
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Location <span className="text-red-400">*</span></Label>
              <Select
                value={form.location}
                onValueChange={v => setForm(f => ({ ...f, location: v as Location }))}
              >
                <SelectTrigger className="bg-slate-900 border-slate-600 text-slate-100 focus:ring-indigo-500">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {LOCATIONS.map(l => (
                    <SelectItem key={l} value={l} className="focus:bg-slate-700">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.location && <p className="text-red-400 text-xs">{errors.location}</p>}
            </div>

            {/* PAN Number */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">PAN Number <span className="text-red-400">*</span></Label>
              <Input
                value={form.panNumber}
                onChange={e => setForm(f => ({ ...f, panNumber: e.target.value.toUpperCase() }))}
                placeholder="ABCDE1234F"
                maxLength={10}
                className="bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500 font-mono tracking-widest"
              />
              {errors.panNumber && <p className="text-red-400 text-xs">{errors.panNumber}</p>}
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-2 disabled:opacity-60"
            >
              {submitting ? "Adding..." : "Add Employee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
