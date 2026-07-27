import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, User as UserIcon, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { LOGO_URL } from "@/constants/options";
import { AUTH } from "@/constants/testIds";

const NAV_LINKS = {
  public: [
    ["/informacion", "Información", "nav-info"],
    ["/normativa", "Normativa", "nav-normativa"],
    ["/calculadora", "Calculadora", "nav-calculadora"],
    ["/contacto", "Contacto", "nav-contacto"],
    ["/ayuda", "Ayuda", "nav-ayuda"],
  ],
  admin: [
    ["/admin", "Resumen", "nav-admin-overview"],
    ["/admin/solicitudes", "Solicitudes", "nav-admin-solicitudes"],
    ["/admin/ocr", "Alta por OCR", "nav-admin-ocr"],
    ["/admin/baremo", "Baremo", "nav-admin-baremo"],
    ["/admin/calculadora", "Calculadora", "nav-admin-calculadora"],
    ["/admin/usuarios", "Usuarios", "nav-admin-usuarios"],
    ["/ayuda", "Ayuda", "nav-admin-ayuda"],
  ],
  citizen: [
    ["/dashboard", "Mi solicitud", "nav-dashboard"],
    ["/ayuda", "Ayuda", "nav-ciudadano-ayuda"],
  ],
};

export function Header({ variant = "public" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const onLogout = async () => {
    await logout();
    setOpen(false);
    navigate("/");
  };

  const links = NAV_LINKS[variant] || NAV_LINKS.public;
  const linkDesktop = "px-3 py-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)] hover:text-[color:var(--hemsa-green-hover)] whitespace-nowrap";
  const linkMovil = "block px-3 py-3 rounded text-base font-medium text-[color:var(--hemsa-text)] hover:bg-gray-100";

  return (
    <header className="hemsa-glass sticky top-0 z-40 border-b border-[color:var(--hemsa-border)]">
      <div className={`${variant === "public" ? "max-w-6xl" : "max-w-7xl"} mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-2`}>

        {/* Logo + nav escritorio */}
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/" className="shrink-0" onClick={close} data-testid="header-logo-link">
            <img src={LOGO_URL} alt="Hemsa" className="h-12 w-12 object-contain" />
          </Link>
          <div className="w-px h-6 bg-gray-200 mx-1 shrink-0" />
          <nav className="hidden md:flex items-center gap-0.5 text-base font-medium">
            {links.map(([to, label, tid]) => (
              <Link key={to} to={to} className={linkDesktop} data-testid={tid}>{label}</Link>
            ))}
          </nav>
        </div>

        {/* Acciones escritorio */}
        <div className="hidden md:flex items-center justify-end gap-2">
          {!user ? (
            variant === "public" && (
              <>
                <Link to="/admin/login" className="px-3 py-2 rounded text-base font-semibold text-[color:var(--hemsa-green-hover)] hover:bg-gray-100 whitespace-nowrap" data-testid="nav-admin">
                  Panel de gestión
                </Link>
                <Link to="/login" className="px-4 py-2 rounded border border-gray-300 text-base text-[color:var(--hemsa-text)] hover:bg-gray-50 whitespace-nowrap" data-testid="header-login-btn">
                  Acceder
                </Link>
              </>
            )
          ) : (
            <>
              <NotificationBell />
              <div className="flex items-center gap-1.5 text-base text-[color:var(--hemsa-text)]">
                {user.role === "admin"
                  ? <ShieldCheck className="h-5 w-5 text-[color:var(--hemsa-green)]" />
                  : <UserIcon className="h-5 w-5 text-[color:var(--hemsa-green)]" />}
                <span className="font-medium" data-testid="header-user-name">{user.name}</span>
              </div>
              <Button variant="outline" size="sm" onClick={onLogout} data-testid={AUTH.logoutBtn}>
                <LogOut className="h-5 w-5 mr-1" /> Salir
              </Button>
            </>
          )}
        </div>

        {/* Móvil: campana + hamburguesa */}
        <div className="flex md:hidden items-center gap-1">
          {user && <NotificationBell />}
          <button
            onClick={() => setOpen(!open)}
            aria-label="Abrir menú"
            className="p-2 rounded hover:bg-gray-100 text-[color:var(--hemsa-text)]"
            data-testid="header-menu-btn"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Panel desplegable móvil */}
      {open && (
        <div className="md:hidden border-t border-[color:var(--hemsa-border)] bg-white px-4 py-3 space-y-1">
          {links.map(([to, label, tid]) => (
            <Link key={to} to={to} onClick={close} className={linkMovil} data-testid={tid}>{label}</Link>
          ))}
          {!user ? (
            variant === "public" && (
              <>
                <Link to="/admin/login" onClick={close} className={`${linkMovil} font-semibold text-[color:var(--hemsa-green-hover)]`} data-testid="nav-admin">
                  Panel de gestión
                </Link>
                <Link to="/login" onClick={close} className={linkMovil} data-testid="header-login-btn">
                  Acceder
                </Link>
              </>
            )
          ) : (
            <>
              <div className="flex items-center gap-1.5 px-3 py-2 text-base text-[color:var(--hemsa-text)]">
                {user.role === "admin"
                  ? <ShieldCheck className="h-5 w-5 text-[color:var(--hemsa-green)]" />
                  : <UserIcon className="h-5 w-5 text-[color:var(--hemsa-green)]" />}
                <span className="font-medium" data-testid="header-user-name">{user.name}</span>
              </div>
              <button onClick={onLogout} className={`${linkMovil} w-full text-left flex items-center`} data-testid={AUTH.logoutBtn}>
                <LogOut className="h-5 w-5 mr-2" /> Salir
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}