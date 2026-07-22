import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { AUTH } from "@/constants/testIds";

export default function CitizenRegister() {
  const navigate = useNavigate();
  const { registerCitizen } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== password2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      await registerCitizen(name, email, password);
      toast.success("Cuenta creada. ¡Bienvenido/a!");
      navigate("/solicitud/nueva");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo crear la cuenta");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="App">
      <Header variant="public" />
      <main className="max-w-md mx-auto px-4 py-16">
        <Card className="p-8 border-[color:var(--hemsa-border)]">
          <h1 className="font-heading text-2xl font-bold text-[color:var(--hemsa-text)]">Cree su cuenta</h1>
          <p className="mt-2 text-sm text-[color:var(--hemsa-muted)]">
            Solo necesitamos un email y una contraseña. Después rellenará el formulario oficial.
          </p>

          <Button onClick={onGoogle} variant="outline" className="w-full mt-6 h-11 rounded-full">
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuar con Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px bg-[color:var(--hemsa-border)] flex-1" />
            <span className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">o con email</span>
            <div className="h-px bg-[color:var(--hemsa-border)] flex-1" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre completo</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} data-testid={AUTH.citizenRegisterName} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid={AUTH.citizenRegisterEmail} />
            </div>
            <div>
              <Label htmlFor="password">Contraseña (mín. 8 caracteres)</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid={AUTH.citizenRegisterPassword} />
            </div>
            <div>
              <Label htmlFor="password2">Confirmar contraseña</Label>
              <Input id="password2" type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} data-testid="citizen-register-password2" />
              {password2 && password !== password2 && (
                <p className="text-xs text-[color:var(--hemsa-error)] mt-1">Las contraseñas no coinciden</p>
              )}
            </div>
            <Button type="submit" disabled={busy} className="hemsa-btn-primary w-full h-11 rounded-full" data-testid={AUTH.citizenRegisterSubmit}>
              {busy ? "Creando…" : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-[color:var(--hemsa-muted)]">
            ¿Ya tiene cuenta? <Link to="/login" className="text-[color:var(--hemsa-green-hover)] font-semibold">Acceder</Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
