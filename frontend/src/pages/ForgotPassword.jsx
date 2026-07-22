import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
      toast.success("Si la cuenta existe, recibirá un email");
    } catch {
      toast.error("Error al procesar la solicitud");
    }
    setBusy(false);
  };

  return (
    <div className="App">
      <Header variant="public" />
      <main className="max-w-md mx-auto px-4 py-16">
        <Card className="p-8 border-[color:var(--hemsa-border)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-[color:var(--hemsa-green-soft)] flex items-center justify-center text-[color:var(--hemsa-green-hover)]">
              <Mail className="h-5 w-5" />
            </div>
            <h1 className="font-heading text-xl font-bold text-[color:var(--hemsa-text)]">Recuperar contraseña</h1>
          </div>

          {sent ? (
            <div className="mt-4">
              <p className="text-sm text-[color:var(--hemsa-text)]">
                Si la dirección <b>{email}</b> está registrada, en breve recibirá un email con un enlace para elegir una nueva contraseña.
              </p>
              <p className="text-xs text-[color:var(--hemsa-muted)] mt-3">
                El enlace es válido durante <b>1 hora</b>. Si no recibe el correo, revise su carpeta de spam o vuelva a intentarlo.
              </p>
              <Button asChild variant="outline" className="rounded-full w-full mt-6">
                <Link to="/login"><ArrowLeft className="h-4 w-4 mr-1" /> Volver al inicio de sesión</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-[color:var(--hemsa-muted)]">
                Introduzca el email con el que se registró y le enviaremos un enlace para restablecer su contraseña.
              </p>
              <form onSubmit={onSubmit} className="space-y-4 mt-6">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="forgot-password-email" />
                </div>
                <Button type="submit" disabled={busy} className="hemsa-btn-primary w-full h-11 rounded-full" data-testid="forgot-password-submit">
                  {busy ? "Enviando…" : "Enviar enlace"}
                </Button>
              </form>
              <p className="mt-6 text-sm text-center">
                <Link to="/login" className="text-[color:var(--hemsa-muted)] hover:underline text-xs">Volver al inicio de sesión</Link>
              </p>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
