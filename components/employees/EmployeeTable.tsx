"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEmployee } from "@/lib/firestore";
import type { Employee } from "@/types";
import { Timestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { AlertTriangle } from "lucide-react";

export function EmployeeTable({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [routing, setRouting] = useState("");

  // Find employees sharing routing hash
  const routingCounts: Record<string, number> = {};
  employees.forEach(e => { routingCounts[e.bankRoutingHash] = (routingCounts[e.bankRoutingHash] || 0) + 1; });
  const isGhost = (emp: Employee) => routingCounts[emp.bankRoutingHash] > 4;

  const handleUpdateRouting = async () => {
    if (!editEmp || !routing) return;
    try {
      await updateEmployee(editEmp.id, {
        bankRoutingHash: btoa(routing).slice(0, 32),
        routingChangedAt: Timestamp.now(),
      });
      toast.success("Routing updated");
      setEditEmp(null);
      setRouting("");
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <>
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400">Name</TableHead>
              <TableHead className="text-slate-400">Department</TableHead>
              <TableHead className="text-slate-400">Role</TableHead>
              <TableHead className="text-slate-400">Base Salary</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.map(emp => (
              <TableRow
                key={emp.id}
                className={`border-slate-700 cursor-pointer ${isGhost(emp) ? "bg-red-950/30 hover:bg-red-950/50" : "hover:bg-slate-800/50"}`}
                onClick={() => router.push(`/employees/${emp.id}`)}
              >
                <TableCell className="text-slate-200 font-medium">
                  <div className="flex items-center gap-2">
                    {isGhost(emp) && <AlertTriangle size={14} className="text-red-400" />}
                    {emp.name}
                  </div>
                </TableCell>
                <TableCell className="text-slate-300">{emp.department}</TableCell>
                <TableCell className="text-slate-400 text-sm">{emp.role}</TableCell>
                <TableCell className="text-slate-300">₹{emp.baseSalaryInr.toLocaleString("en-IN")}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={emp.isActive ? "text-green-400 border-green-500/30" : "text-slate-500 border-slate-600"}>
                    {emp.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-slate-100 text-xs h-7 px-2"
                    onClick={(e) => { e.stopPropagation(); setEditEmp(emp); setRouting(""); }}
                  >
                    Edit Routing
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editEmp} onOpenChange={o => !o && setEditEmp(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Update Routing — {editEmp?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300">New Routing Number</Label>
              <Input
                value={routing}
                onChange={e => setRouting(e.target.value)}
                placeholder="123456789"
                className="bg-slate-900 border-slate-600 text-slate-100"
              />
            </div>
            <Button onClick={handleUpdateRouting} className="w-full bg-indigo-600 hover:bg-indigo-700">
              Save & Mark Changed
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
