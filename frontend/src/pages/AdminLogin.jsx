import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { AUTH } from "@/constants/testIds";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await loginAdmin(email, password);
      if (u?.role === "admin") {
        toast.success("Acceso administrador correcto");
        navigate("/admin");
      } else {
        toast.success("Sesión iniciada");
        navigate("/dashboard");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Credenciales incorrectas");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="App">
      <Header variant="public" />
      <main className="max-w-md mx-auto px-4 py-16">
        <Card className="p-8 border-[color:var(--hemsa-border)]">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--hemsa-border)] px-4 py-2 text-sm font-semibold text-[color:var(--hemsa-green-hover)] hover:bg-[color:var(--hemsa-green-soft)]"
            data-testid="link-back-home"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a la página principal
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-[color:var(--hemsa-green-soft)] flex items-center justify-center text-[color:var(--hemsa-green-hover)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[color:var(--hemsa-muted)]">Área restringida</div>
              <h1 className="font-heading text-xl font-bold text-[color:var(--hemsa-text)]">Acceso administrador</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-[color:var(--hemsa-muted)]">Acceso exclusivo para el personal técnico de Hemsa.</p>

          <form onSubmit={onSubmit} className="space-y-4 mt-6">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid={AUTH.adminLoginEmail} />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid={AUTH.adminLoginPassword} />
            </div>
            <Button type="submit" disabled={busy} className="hemsa-btn-primary w-full h-11 rounded-full" data-testid={AUTH.adminLoginSubmit}>
              {busy ? "Entrando…" : "Acceder"}
            </Button>
          </form>
        </Card>

        <div className="mt-4 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs text-[color:var(--hemsa-muted)] hover:text-[color:var(--hemsa-green-hover)] underline-offset-4 hover:underline"
            data-testid="link-to-citizen-login"
          >
            ← ¿Eres ciudadano? Accede por aquí
          </Link>
        </div>
      </main>
    </div>
  );
}