import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: skip /me check if returning from Google OAuth callback
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const loginCitizen = async (email, password) => {
    // Unified login: try citizen first. If it's not a citizen account but is a valid
    // admin account, transparently fall back to admin login so the user never has
    // to know which "door" their account belongs to.
    try {
      const res = await api.post("/auth/citizen/login", { email, password });
      localStorage.setItem("hemsa_token", res.data.token);
      setUser(res.data.user);
      return res.data.user;
    } catch (citizenErr) {
      try {
        const r2 = await api.post("/auth/admin/login", { email, password });
        localStorage.setItem("hemsa_token", r2.data.token);
        setUser(r2.data.user);
        return r2.data.user;
      } catch (_) {
        throw citizenErr; // surface original message ("Credenciales incorrectas")
      }
    }
  };

  const registerCitizen = async (name, email, password) => {
    const res = await api.post("/auth/citizen/register", { name, email, password });
    localStorage.setItem("hemsa_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const loginAdmin = async (email, password) => {
    try {
      const res = await api.post("/auth/admin/login", { email, password });
      localStorage.setItem("hemsa_token", res.data.token);
      setUser(res.data.user);
      return res.data.user;
    } catch (adminErr) {
      try {
        const r2 = await api.post("/auth/citizen/login", { email, password });
        localStorage.setItem("hemsa_token", r2.data.token);
        setUser(r2.data.user);
        return r2.data.user;
      } catch (_) {
        throw adminErr;
      }
    }
  };

  const exchangeGoogleSession = async (session_id) => {
    const res = await api.post("/auth/google/session", { session_id });
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("hemsa_token");
    // Limpiar cookies de la sesión (defensa contra sesiones cruzadas)
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name === "session_token") {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, checkAuth, loginCitizen, registerCitizen, loginAdmin, exchangeGoogleSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
