import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { MessageSquare, Send, CheckCircle2, Clock } from "lucide-react";

export function AdminAllegations({ applicationId }) {
  const [items, setItems] = useState([]);
  const [responses, setResponses] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/applications/${applicationId}/alegaciones`);
      setItems(r.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [applicationId]);

  const respond = async (alegacion_id) => {
    const texto = (responses[alegacion_id] || "").trim();
    if (!texto) return toast.error("Escriba una respuesta");
    setBusy(true);
    try {
      await api.post(`/admin/alegaciones/${alegacion_id}/respond`, { texto });
      toast.success("Respuesta enviada al ciudadano");
      setResponses({ ...responses, [alegacion_id]: "" });
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo responder"); }
    setBusy(false);
  };

  return (
    <div>
      {loading && <div className="text-sm text-[color:var(--hemsa-muted)]">Cargando…</div>}
      {!loading && items.length === 0 && (
        <div className="text-sm text-[color:var(--hemsa-muted)] py-3 text-center border border-dashed border-[color:var(--hemsa-border)] rounded-lg">
          Sin alegaciones presentadas.
        </div>
      )}
      <div className="space-y-3">
        {!loading && items.map((a) => (
          <div key={a.alegacion_id} className="border border-[color:var(--hemsa-border)] rounded-lg p-4" data-testid={`admin-alegacion-${a.alegacion_id}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`status-pill ${a.status === "contestada" ? "status-aprobada" : "status-pendiente"}`}>
                {a.status === "contestada" ? <><CheckCircle2 className="h-3 w-3" /> Contestada</> : <><Clock className="h-3 w-3" /> Pendiente</>}
              </span>
              <span className="text-xs text-[color:var(--hemsa-muted)]">{new Date(a.created_at).toLocaleString("es-ES")}</span>
            </div>
            <div className="text-sm text-[color:var(--hemsa-text)] whitespace-pre-wrap">{a.texto}</div>

            {a.admin_response ? (
              <div className="mt-4 pt-3 border-t border-[color:var(--hemsa-border)] bg-[color:var(--hemsa-green-soft)] -mx-4 -mb-4 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-green-hover)] font-semibold mb-1">
                  Su respuesta{a.admin_response_by_name ? ` · ${a.admin_response_by_name}` : ""}
                </div>
                <div className="text-sm text-[color:var(--hemsa-text)] whitespace-pre-wrap">{a.admin_response}</div>
                <div className="text-xs text-[color:var(--hemsa-muted)] mt-1">{a.admin_response_at && new Date(a.admin_response_at).toLocaleString("es-ES")}</div>
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-[color:var(--hemsa-border)]">
                <Textarea rows={3} placeholder="Escriba la respuesta oficial al ciudadano…"
                  value={responses[a.alegacion_id] || ""}
                  onChange={(e) => setResponses({ ...responses, [a.alegacion_id]: e.target.value })}
                  data-testid={`alegacion-response-${a.alegacion_id}`} />
                <Button onClick={() => respond(a.alegacion_id)} disabled={busy} className="hemsa-btn-primary rounded-full mt-2" size="sm" data-testid={`alegacion-respond-${a.alegacion_id}`}>
                  <Send className="h-4 w-4 mr-1" /> Responder
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
