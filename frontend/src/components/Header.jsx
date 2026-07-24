import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { LOGO_URL } from "@/constants/options";
import { AUTH } from "@/constants/testIds";

export function Header({ variant = "public" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  /* ── CABECERA PÚBLICA ─────────────────────────────────────────────
     Mismo contenedor y proporciones que la landing (max-w-6xl, 2:1):
     · izquierda (2/3): logo + navegación
     · derecha   (1/3): panel de gestión / acceder / usuario
  ────────────────────────────────────────────────────────────────── */
  if (variant === "public") {
    return (
      <header className="hemsa-glass sticky top-0 z-40 border-b border-[color:var(--hemsa-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-8 h-16">

          {/* Izquierda (2/3): logo + nav */}
          <div className="flex items-center gap-2 flex-[2] min-w-0">
            <Link to="/" className="shrink-0" data-testid="header-logo-link">
              <img src={LOGO_URL} alt="Hemsa" className="h-12 w-12 object-contain" />
            </Link>
            <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />
            <nav className="flex items-center gap-0.5 text-base font-medium">
              <Link to="/informacion" className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)] hover:text-[color:var(--hemsa-green-hover)] whitespace-nowrap" data-testid="nav-info">Información</Link>
           <Link to="/calculadora" className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)] hover:text-[color:var(--hemsa-green-hover)] whitespace-nowrap" data-testid="nav-calculadora">Calculadora</Link>
              <Link to="/normativa"   className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)] hover:text-[color:var(--hemsa-green-hover)] whitespace-nowrap" data-testid="nav-normativa">Normativa</Link>
              <Link to="/contacto"   className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)] hover:text-[color:var(--hemsa-green-hover)] whitespace-nowrap" data-testid="nav-contacto">Contacto</Link>
            </nav>
          </div>

          {/* Derecha (1/3): acciones — encima del sidebar */}
          <div className="flex items-center justify-end gap-2 flex-[1]">
            {!user ? (
              <>
                <Link
                  to="/admin/login"
                  className="px-3 py-2 rounded text-base font-semibold text-[color:var(--hemsa-green-hover)] hover:bg-gray-100 whitespace-nowrap"
                  data-testid="nav-admin"
                >
                  Panel de gestión
                </Link>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded border border-gray-300 text-base text-[color:var(--hemsa-text)] hover:bg-gray-50 whitespace-nowrap"
                  data-testid="header-login-btn"
                >
                  Acceder
                </Link>
              </>
            ) : (
              <>
                <NotificationBell />
                <div className="hidden sm:flex items-center gap-1.5 text-base text-[color:var(--hemsa-text)]">
                  {user.role === "admin"
                    ? <ShieldCheck className="h-5 w-5 text-[color:var(--hemsa-green)]" />
                    : <UserIcon    className="h-5 w-5 text-[color:var(--hemsa-green)]" />}
                  <span className="font-medium" data-testid="header-user-name">{user.name}</span>
                </div>
                <Button variant="outline" size="sm" onClick={onLogout} data-testid={AUTH.logoutBtn}>
                  <LogOut className="h-5 w-5 mr-1" /> Salir
                </Button>
              </>
            )}
          </div>

        </div>
      </header>
    );
  }

  /* ── CABECERA ADMIN / CIUDADANO ───────────────────────────────────
     Logo + nav a la izquierda, usuario a la derecha.
     Contenedor max-w-7xl para alinearse con el contenido del panel.
  ────────────────────────────────────────────────────────────────── */
  return (
    <header className="hemsa-glass sticky top-0 z-40 border-b border-[color:var(--hemsa-border)]">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex items-center h-16 gap-3">

        <Link to="/" className="shrink-0" data-testid="header-logo-link">
          <img src={LOGO_URL} alt="Hemsa" className="h-12 w-12 object-contain" />
        </Link>

        <div className="w-px h-6 bg-gray-200 shrink-0" />

        <nav className="flex items-center gap-0.5 text-base font-medium">
          {variant === "citizen" && (
            <Link to="/dashboard" className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)]" data-testid="nav-dashboard">Mi solicitud</Link>
          )}
          {variant === "admin" && (
            <>
              <Link to="/admin"             className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)]" data-testid="nav-admin-overview">Resumen</Link>
              <Link to="/admin/solicitudes" className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)]" data-testid="nav-admin-solicitudes">Solicitudes</Link>
              <Link to="/admin/ocr"         className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)]" data-testid="nav-admin-ocr">Alta por OCR</Link>
              <Link to="/admin/baremo"      className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)]" data-testid="nav-admin-baremo">Baremo</Link>
              <Link to="/admin/usuarios"    className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)]" data-testid="nav-admin-usuarios">Usuarios</Link>
              <Link to="/admin/calculadora" className="px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)]" data-testid="nav-admin-calculadora">Calculadora</Link>
            </>
          )}
        </nav>

        {user && (
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-1.5 text-base text-[color:var(--hemsa-text)]">
              {user.role === "admin"
                ? <ShieldCheck className="h-5 w-5 text-[color:var(--hemsa-green)]" />
                : <UserIcon    className="h-5 w-5 text-[color:var(--hemsa-green)]" />}
              <span className="font-medium" data-testid="header-user-name">{user.name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onLogout} data-testid={AUTH.logoutBtn}>
              <LogOut className="h-5 w-5 mr-1" /> Salir
            </Button>
          </div>
        )}

      </div>
    </header>
  );
}
