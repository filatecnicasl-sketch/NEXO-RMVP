import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { Pencil, CheckCircle2, XCircle, Clock } from "lucide-react";

const STATUS = {
  pendiente: { label: "Pendiente de revisión", cls: "status-pendiente", icon: <Clock className="h-3 w-3" /> },
  aprobada: { label: "Aprobada y aplicada", cls: "status-aprobada", icon: <CheckCircle2 className="h-3 w-3" /> },
  rechazada: { label: "Rechazada", cls: "status-denegada", icon: <XCircle className="h-3 w-3" /> },
};

function summarizeDiff(original, proposed) {
  // Returns array of {label, before, after} for visible field changes
  const out = [];
  const t1o = original?.titular1 || {}, t1p = proposed?.titular1 || {};
  ["nombre", "apellido1", "apellido2", "numero_documento", "email", "telefono_movil", "direccion", "codigo_postal", "ingresos_economicos"].forEach((k) => {
    if (String(t1o[k] ?? "") !== String(t1p[k] ?? "")) {
      out.push({ label: `Titular 1 · ${k}`, before: t1o[k], after: t1p[k] });
    }
  });
  const vo = original?.vivienda || {}, vp = proposed?.vivienda || {};
  if (JSON.stringify(vo.regimen || []) !== JSON.stringify(vp.regimen || [])) out.push({ label: "Vivienda · régimen", before: (vo.regimen || []).join(", "), after: (vp.regimen || []).join(", ") });
  if (JSON.stringify(vo.dormitorios || []) !== JSON.stringify(vp.dormitorios || [])) out.push({ label: "Vivienda · dormitorios", before: (vo.dormitorios || []).join(", "), after: (vp.dormitorios || []).join(", ") });
  const jo = JSON.stringify(original?.justificacion?.casillas || []);
  const jp = JSON.stringify(proposed?.justificacion?.casillas || []);
  if (jo !== jp) out.push({ label: "Justificación", before: jo, after: jp });
  const mo = (original?.otros_miembros || []).length, mp = (proposed?.otros_miembros || []).length;
  if (mo !== mp) out.push({ label: "Miembros unidad familiar", before: mo, after: mp });
  return out;
}

export function Subsanaciones({ applicationId, isAdmin = false, original = null }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const url = isAdmin ? `/admin/applications/${applicationId}/subsanaciones` : "/applications/me/subsanaciones";
      const r = await api.get(url);
      setItems((r.data || []).filter((s) => !applicationId || s.application_id === applicationId));
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [applicationId, isAdmin]);

  const approve = async (id) => {
    setBusy(true);
    try {
      await api.post(`/admin/subsanaciones/${id}/approve`);
      toast.success("Subsanación aprobada y aplicada");
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo aprobar"); }
    setBusy(false);
  };

  const reject = async (id) => {
    const motivo = (reasons[id] || "").trim();
    if (!motivo) return toast.error("Indique el motivo del rechazo");
    setBusy(true);
    try {
      await api.post(`/admin/subsanaciones/${id}/reject`, { motivo });
      toast.success("Subsanación rechazada");
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo rechazar"); }
    setBusy(false);
  };

  return (
    <div>
      {loading && <div className="text-sm text-[color:var(--hemsa-muted)]">Cargando…</div>}
      {!loading && items.length === 0 && (
        <div className="text-sm text-[color:var(--hemsa-muted)] py-3 text-center border border-dashed border-[color:var(--hemsa-border)] rounded-lg">
          Sin subsanaciones solicitadas.
        </div>
      )}
      <div className="space-y-3">
        {!loading && items.map((s) => {
          const meta = STATUS[s.status] || STATUS.pendiente;
          const diff = isAdmin && original ? summarizeDiff(original, s.proposed_data) : [];
          return (
            <div key={s.subsanacion_id} className="border border-[color:var(--hemsa-border)] rounded-lg p-4" data-testid={`subs-${s.subsanacion_id}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`status-pill ${meta.cls}`}>{meta.icon} {meta.label}</span>
                <span className="text-xs text-[color:var(--hemsa-muted)]">{new Date(s.created_at).toLocaleString("es-ES")}</span>
              </div>
              <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mt-2">Motivo aportado por el ciudadano</div>
              <div className="text-sm text-[color:var(--hemsa-text)] whitespace-pre-wrap">{s.motivo}</div>

              {isAdmin && diff.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[color:var(--hemsa-border)]">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-2">Cambios propuestos ({diff.length})</div>
                  <div className="space-y-1.5">
                    {diff.map((d, i) => (
                      <div key={i} className="text-xs grid grid-cols-1 sm:grid-cols-12 gap-2 py-1.5 px-2 bg-[color:var(--hemsa-surface)] rounded">
                        <div className="sm:col-span-3 text-[color:var(--hemsa-muted)] uppercase tracking-wider font-semibold">{d.label}</div>
                        <div className="sm:col-span-4 line-through text-[color:var(--hemsa-error)]">{String(d.before ?? "—") || "—"}</div>
                        <div className="sm:col-span-5 text-[color:var(--hemsa-green-hover)] font-semibold">→ {String(d.after ?? "—") || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {s.status === "rechazada" && s.admin_response && (
                <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-xs uppercase tracking-wider text-red-700 font-semibold mb-1">Motivo del rechazo · {s.admin_response_by_name || "Hemsa"}</div>
                  <div className="text-sm text-[color:var(--hemsa-text)]">{s.admin_response}</div>
                </div>
              )}

              {isAdmin && s.status === "pendiente" && (
                <div className="mt-3 pt-3 border-t border-[color:var(--hemsa-border)] space-y-2">
                  <Textarea rows={2} placeholder="Motivo (solo necesario si rechaza)" value={reasons[s.subsanacion_id] || ""} onChange={(e) => setReasons({ ...reasons, [s.subsanacion_id]: e.target.value })} data-testid={`subs-reason-${s.subsanacion_id}`} />
                  <div className="flex gap-2">
                    <Button onClick={() => approve(s.subsanacion_id)} disabled={busy} size="sm" className="hemsa-btn-primary rounded-full" data-testid={`subs-approve-${s.subsanacion_id}`}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Aprobar y aplicar
                    </Button>
                    <Button onClick={() => reject(s.subsanacion_id)} disabled={busy} variant="outline" size="sm" className="rounded-full text-[color:var(--hemsa-error)]" data-testid={`subs-reject-${s.subsanacion_id}`}>
                      <XCircle className="h-4 w-4 mr-1" /> Rechazar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
