import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[color:var(--hemsa-muted)]">
        Cargando…
      </div>
    );
  }

  if (!user) {
    const target = role === "admin" ? "/admin/login" : "/login";
    return <Navigate to={target} state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    const fallback = user.role === "admin" ? "/admin" : "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return children;
}
