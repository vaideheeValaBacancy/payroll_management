"use client";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";
import { Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Signed in successfully");
      router.replace("/home");
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-indigo-600/20 rounded-full border border-indigo-600/30 mb-4">
            <Shield size={28} className="text-indigo-400" />
          </div>
          <h1 className="text-slate-100 text-2xl font-bold">PayrollMonitor</h1>
          <p className="text-slate-400 text-sm mt-1">AI Transaction Risk Engine</p>
        </div>

        <form onSubmit={handleLogin} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@payroll.com"
              required
              className="bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-sm">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-slate-900 border-slate-600 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-slate-500 text-xs text-center mt-4">
          Demo: admin@payroll.com / Admin@123
        </p>
      </div>
    </div>
  );
}
