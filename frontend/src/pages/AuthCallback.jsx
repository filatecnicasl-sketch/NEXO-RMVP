import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { exchangeGoogleSession } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      toast.error("No se pudo procesar el acceso con Google");
      navigate("/login", { replace: true });
      return;
    }
    const session_id = decodeURIComponent(m[1]);
    exchangeGoogleSession(session_id)
      .then(() => {
        toast.success("Bienvenido/a");
        navigate("/dashboard", { replace: true });
      })
      .catch(() => {
        toast.error("Sesión de Google inválida o expirada");
        navigate("/login", { replace: true });
      });
  }, [exchangeGoogleSession, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen text-[color:var(--hemsa-muted)]">
      Procesando acceso seguro…
    </div>
  );
}
