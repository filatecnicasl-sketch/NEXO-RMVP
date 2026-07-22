import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Clock, CheckCircle2, XCircle, Bell, MessageSquare, Pencil } from "lucide-react";

/**
 * PendingChangesPanel — Polls citizen subsanaciones and alegaciones every POLL_MS.
 * Renders a prominent live panel with counters, and surfaces toast notifications
 * the moment an item changes status (e.g. a subsanación is approved/rejected,
 * or an alegación is answered).
 */
const POLL_MS = 30000;

function StatusDot({ status }) {
  const colorByStatus = {
    pendiente: "bg-amber-500",
    aprobada: "bg-emerald-500",
    rechazada: "bg-rose-500",
    enviada: "bg-amber-500",
    contestada: "bg-emerald-500",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colorByStatus[status] || "bg-slate-400"}`} />;
}

function StatusBadge({ status }) {
  const labelByStatus = {
    pendiente: { txt: "Pendiente", icon: <Clock className="h-3 w-3" />, cls: "bg-amber-50 text-amber-800 border-amber-200" },
    aprobada: { txt: "Aprobada", icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    rechazada: { txt: "Rechazada", icon: <XCircle className="h-3 w-3" />, cls: "bg-rose-50 text-rose-800 border-rose-200" },
    enviada: { txt: "En espera", icon: <Clock className="h-3 w-3" />, cls: "bg-amber-50 text-amber-800 border-amber-200" },
    contestada: { txt: "Contestada", icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  };
  const cfg = labelByStatus[status] || { txt: status, icon: null, cls: "bg-slate-50 text-slate-700 border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.cls}`}>
      {cfg.icon}{cfg.txt}
    </span>
  );
}

export function PendingChangesPanel() {
  const [subs, setSubs] = useState([]);
  const [alegs, setAlegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlight, setHighlight] = useState(false);
  const prevSubsRef = useRef(null);
  const prevAlegsRef = useRef(null);

  const tick = async () => {
    try {
      const [rS, rA] = await Promise.all([
        api.get("/applications/me/subsanaciones"),
        api.get("/applications/me/alegaciones"),
      ]);
      const newSubs = Array.isArray(rS.data) ? rS.data : [];
      const newAlegs = Array.isArray(rA.data) ? rA.data : [];

      // Detect status changes vs previous snapshot (skip first load = silent baseline)
      if (prevSubsRef.current) {
        for (const cur of newSubs) {
          const prev = prevSubsRef.current.find((p) => p.subsanacion_id === cur.subsanacion_id);
          if (prev && prev.status !== cur.status) {
            if (cur.status === "aprobada") toast.success(`✅ Su subsanación ha sido APROBADA por Hemsa.`);
            else if (cur.status === "rechazada") toast.error(`❌ Su subsanación ha sido rechazada. ${cur.admin_response ? "Motivo: " + cur.admin_response.slice(0, 80) : ""}`);
            setHighlight(true);
            setTimeout(() => setHighlight(false), 4000);
          }
        }
      }
      if (prevAlegsRef.current) {
        for (const cur of newAlegs) {
          const prev = prevAlegsRef.current.find((p) => p.alegacion_id === cur.alegacion_id);
          if (prev && prev.status !== cur.status && cur.status === "contestada") {
            toast.success(`💬 Hemsa ha contestado a su alegación.`);
            setHighlight(true);
            setTimeout(() => setHighlight(false), 4000);
          }
        }
      }
      prevSubsRef.current = newSubs;
      prevAlegsRef.current = newAlegs;
      setSubs(newSubs);
      setAlegs(newAlegs);
    } catch (e) {
      // silent — banner is non-critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Defer the initial tick by a microtask so React isn't asked to commit
    // a state update synchronously inside this effect (react-hooks/set-state-in-effect).
    Promise.resolve().then(tick);
    const id = setInterval(tick, POLL_MS);
    // Refresh immediately when the user returns to this tab (no need to wait
    // for the next 30s poll cycle).
    const onFocus = () => tick();
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (loading) return null;
  const pendingSubs = subs.filter((s) => s.status === "pendiente");
  const recentResolvedSubs = subs.filter((s) => s.status !== "pendiente").slice(0, 2);
  const pendingAlegs = alegs.filter((a) => a.status === "enviada");
  const totalActive = pendingSubs.length + pendingAlegs.length + recentResolvedSubs.length;
  if (totalActive === 0) return null;

  return (
    <Card
      data-testid="pending-changes-panel"
      className={`p-5 border-[color:var(--hemsa-border)] mb-6 transition-all duration-500 ${
        highlight
          ? "ring-2 ring-[color:var(--hemsa-green)] shadow-lg shadow-emerald-100/60"
          : "shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Bell className={`h-4 w-4 ${highlight ? "text-[color:var(--hemsa-green)] animate-pulse" : "text-[color:var(--hemsa-muted)]"}`} />
        <div className="text-xs uppercase tracking-wider font-semibold text-[color:var(--hemsa-text)]">
          Mis cambios pendientes
        </div>
        <div className="ml-auto text-[11px] text-[color:var(--hemsa-muted)]">
          Actualización en vivo cada 30 s
        </div>
      </div>

      <div className="space-y-2">
        {pendingSubs.map((s) => (
          <div key={s.subsanacion_id} className="flex items-center gap-3 text-sm" data-testid={`pending-subs-${s.subsanacion_id}`}>
            <StatusDot status={s.status} />
            <Pencil className="h-3.5 w-3.5 text-[color:var(--hemsa-muted)]" />
            <div className="flex-1 truncate text-[color:var(--hemsa-text)]">
              <span className="font-medium">Subsanación:</span>{" "}
              <span className="text-[color:var(--hemsa-muted)]">{s.motivo}</span>
            </div>
            <StatusBadge status={s.status} />
          </div>
        ))}
        {recentResolvedSubs.map((s) => (
          <div key={s.subsanacion_id} className="flex items-center gap-3 text-sm" data-testid={`resolved-subs-${s.subsanacion_id}`}>
            <StatusDot status={s.status} />
            <Pencil className="h-3.5 w-3.5 text-[color:var(--hemsa-muted)]" />
            <div className="flex-1 truncate text-[color:var(--hemsa-text)]">
              <span className="font-medium">Subsanación:</span>{" "}
              <span className="text-[color:var(--hemsa-muted)]">{s.motivo}</span>
            </div>
            <StatusBadge status={s.status} />
          </div>
        ))}
        {pendingAlegs.map((a) => (
          <div key={a.alegacion_id} className="flex items-center gap-3 text-sm" data-testid={`pending-aleg-${a.alegacion_id}`}>
            <StatusDot status={a.status} />
            <MessageSquare className="h-3.5 w-3.5 text-[color:var(--hemsa-muted)]" />
            <div className="flex-1 truncate text-[color:var(--hemsa-text)]">
              <span className="font-medium">Alegación:</span>{" "}
              <span className="text-[color:var(--hemsa-muted)]">{a.texto?.slice(0, 80)}</span>
            </div>
            <StatusBadge status={a.status} />
          </div>
        ))}
      </div>
    </Card>
  );
}
