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

export default function CitizenLogin() {
  const navigate = useNavigate();
  const { loginCitizen } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await loginCitizen(email, password);
      // Unified login: route by role so the user never has to pick the right "door".
      if (u?.role === "admin") {
        toast.success(`Bienvenido, ${u.name || "Administrador"}`);
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
          <h1 className="font-heading text-2xl font-bold text-[color:var(--hemsa-text)]">Acceder al registro</h1>
          <p className="mt-2 text-sm text-[color:var(--hemsa-muted)]">Entre con su cuenta de ciudadano para gestionar su solicitud.</p>

          {process.env.REACT_APP_GOOGLE_OAUTH === '1' && (
          <Button onClick={onGoogle} variant="outline" className="w-full mt-6 h-11 rounded-full" data-testid={AUTH.googleSignInBtn}>
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Acceder con Google
          </Button>
          )}

          {process.env.REACT_APP_GOOGLE_OAUTH === '1' && (
          <div className="my-6 flex items-center gap-3">
            <div className="h-px bg-[color:var(--hemsa-border)] flex-1" />
            <span className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">o con email</span>
            <div className="h-px bg-[color:var(--hemsa-border)] flex-1" />
          </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid={AUTH.citizenLoginEmail} />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} data-testid={AUTH.citizenLoginPassword} />
            </div>
            <Button type="submit" disabled={busy} className="hemsa-btn-primary w-full h-11 rounded-full" data-testid={AUTH.citizenLoginSubmit}>
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-center text-[color:var(--hemsa-muted)]">
            ¿No tiene cuenta? <Link to="/registro" className="text-[color:var(--hemsa-green-hover)] font-semibold">Darme de alta</Link>
          </p>
          <p className="mt-2 text-sm text-center">
            <Link to="/recuperar-contrasena" className="text-[color:var(--hemsa-muted)] hover:text-[color:var(--hemsa-green-hover)] text-xs" data-testid="forgot-password-link">¿Olvidó su contraseña?</Link>
          </p>
        </Card>

        <div className="mt-4 text-center">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-2 text-xs text-[color:var(--hemsa-muted)] hover:text-[color:var(--hemsa-green-hover)] underline-offset-4 hover:underline"
            data-testid="link-to-admin-login"
          >
            ¿Eres administrador de Hemsa? Accede por aquí →
          </Link>
        </div>
      </main>
    </div>
  );
}