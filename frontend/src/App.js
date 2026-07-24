import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import "@/App.css";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Remove the platform branding badge as soon as the app boots. The script
// `emergent-main.js` re-injects it after page load, so we watch for it.
if (typeof document !== "undefined") {
  const stripBadge = () => {
    document
      .querySelectorAll('#emergent-badge, a[href*="emergent-badge"], a[href*="utm_source=emergent-badge"]')
      .forEach((el) => el.remove());
  };
  stripBadge();
  // Observe DOM for late injection
  const obs = new MutationObserver(stripBadge);
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

import Landing from "@/pages/Landing";
import Informacion from "@/pages/Informacion";
import Normativa from "@/pages/Normativa";
import FAQ from "@/pages/FAQ";
import Contacto from "@/pages/Contacto";
import CalculadoraIprem from "@/pages/CalculadoraIprem";
import CitizenLogin from "@/pages/CitizenLogin";
import CitizenRegister from "@/pages/CitizenRegister";
import AdminLogin from "@/pages/AdminLogin";
import AuthCallback from "@/pages/AuthCallback";
import CitizenDashboard from "@/pages/CitizenDashboard";
import ApplicationWizard from "@/pages/ApplicationWizard";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminApplications from "@/pages/AdminApplications";
import AdminApplicationDetail from "@/pages/AdminApplicationDetail";
import AdminOcr from "@/pages/AdminOcr";
import AdminBaremo from "@/pages/AdminBaremo";
import AdminUsers from "@/pages/AdminUsers";
import AdminApplicationEdit from "@/pages/AdminApplicationEdit";

function AppRouter() {
  const location = useLocation();
  // Detect Google OAuth callback synchronously (avoid race conditions)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/informacion" element={<Informacion />} />
      <Route path="/normativa" element={<Normativa />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/contacto" element={<Contacto />} />
      <Route path="/calculadora" element={<CalculadoraIprem />} />
      <Route path="/login" element={<CitizenLogin />} />
      <Route path="/registro" element={<CitizenRegister />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route path="/dashboard" element={
        <ProtectedRoute role="citizen"><CitizenDashboard /></ProtectedRoute>
      } />
      <Route path="/solicitud/nueva" element={
        <ProtectedRoute role="citizen"><ApplicationWizard mode="create" /></ProtectedRoute>
      } />
      <Route path="/solicitud/editar" element={
        <ProtectedRoute role="citizen"><ApplicationWizard mode="edit" /></ProtectedRoute>
      } />
      <Route path="/solicitud/subsanacion" element={
        <ProtectedRoute role="citizen"><ApplicationWizard mode="subsanacion" /></ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/admin/solicitudes" element={
        <ProtectedRoute role="admin"><AdminApplications /></ProtectedRoute>

      } />
      <Route path="/admin/calculadora" element={
        <ProtectedRoute role="admin"><CalculadoraIprem variant="admin" /></ProtectedRoute>
      } />
      <Route path="/admin/solicitudes/:id" element={
        <ProtectedRoute role="admin"><AdminApplicationDetail /></ProtectedRoute>
      } />
      <Route path="/admin/solicitudes/:id/editar" element={
        <ProtectedRoute role="admin"><AdminApplicationEdit /></ProtectedRoute>
      } />
      <Route path="/admin/ocr" element={
        <ProtectedRoute role="admin"><AdminOcr /></ProtectedRoute>
      } />
      <Route path="/admin/baremo" element={
        <ProtectedRoute role="admin"><AdminBaremo /></ProtectedRoute>
      } />
      <Route path="/admin/usuarios" element={
        <ProtectedRoute role="admin"><AdminUsers /></ProtectedRoute>
      } />

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster richColors closeButton position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
