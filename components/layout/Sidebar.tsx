"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  LayoutDashboard, Users, CreditCard, Activity,
  FileText, Settings, LogOut, Menu, X, Shield
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/home", label: "Dashboard", icon: LayoutDashboard },
  { href: "/payroll", label: "Payroll Runs", icon: CreditCard },
  { href: "/transactions", label: "Transactions", icon: Activity },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/audit", label: "Audit Trail", icon: FileText },
  { href: "/config", label: "Risk Config", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut(auth);
    toast.success("Signed out");
    router.replace("/login");
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-slate-800 p-2 rounded-lg border border-slate-700"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={18} className="text-slate-300" /> : <Menu size={18} className="text-slate-300" />}
      </button>

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-60 bg-slate-900 border-r border-slate-700 z-40 flex flex-col",
        "transform transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-indigo-500" />
            <span className="text-slate-100 font-semibold text-sm">PayrollMonitor</span>
          </div>
          <p className="text-slate-500 text-xs mt-1">Transaction Risk Engine</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                pathname === href
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 w-full transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
