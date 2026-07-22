import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { MessageSquare, Send, CheckCircle2, Clock } from "lucide-react";

export function CitizenAllegations({ applicationId, status }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/applications/me/alegaciones");
      setItems(r.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [applicationId]);

  const submit = async () => {
    if (!text.trim()) return toast.error("Escriba el texto de la alegación");
    setBusy(true);
    try {
      await api.post("/applications/me/alegaciones", { texto: text.trim() });
      toast.success("Alegación enviada");
      setText("");
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo enviar"); }
    setBusy(false);
  };

  return (
    <Card className="p-6 border-[color:var(--hemsa-border)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-3">
        <MessageSquare className="h-4 w-4" /> Buzón de alegaciones
      </div>
      <p className="text-sm text-[color:var(--hemsa-muted)] mb-4">
        {status === "denegada"
          ? "Si no está conforme con la resolución, puede presentar una alegación. Hemsa la revisará y le responderá."
          : "Puede presentar alegaciones o comunicaciones sobre su expediente."}
      </p>
      <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escriba aquí su alegación o comunicación…" data-testid="alegacion-textarea" />
      <div className="flex justify-end mt-3">
        <Button onClick={submit} disabled={busy || !text.trim()} className="hemsa-btn-primary rounded-full" data-testid="alegacion-submit">
          <Send className="h-4 w-4 mr-1" /> {busy ? "Enviando…" : "Presentar alegación"}
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {loading && <div className="text-sm text-[color:var(--hemsa-muted)]">Cargando…</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm text-[color:var(--hemsa-muted)] py-3 text-center border border-dashed border-[color:var(--hemsa-border)] rounded-lg">
            Aún no ha presentado alegaciones.
          </div>
        )}
        {!loading && items.map((a) => (
          <div key={a.alegacion_id} className="border border-[color:var(--hemsa-border)] rounded-lg p-4" data-testid={`alegacion-${a.alegacion_id}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`status-pill ${a.status === "contestada" ? "status-aprobada" : "status-pendiente"}`}>
                {a.status === "contestada" ? <><CheckCircle2 className="h-3 w-3" /> Contestada</> : <><Clock className="h-3 w-3" /> Pendiente de respuesta</>}
              </span>
              <span className="text-xs text-[color:var(--hemsa-muted)]">{new Date(a.created_at).toLocaleString("es-ES")}</span>
            </div>
            <div className="text-sm text-[color:var(--hemsa-text)] whitespace-pre-wrap">{a.texto}</div>
            {a.admin_response && (
              <div className="mt-4 pt-3 border-t border-[color:var(--hemsa-border)] bg-[color:var(--hemsa-green-soft)] -mx-4 -mb-4 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-green-hover)] font-semibold mb-1">
                  Respuesta de Hemsa{a.admin_response_by_name ? ` · ${a.admin_response_by_name}` : ""}
                </div>
                <div className="text-sm text-[color:var(--hemsa-text)] whitespace-pre-wrap">{a.admin_response}</div>
                <div className="text-xs text-[color:var(--hemsa-muted)] mt-1">{a.admin_response_at && new Date(a.admin_response_at).toLocaleString("es-ES")}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
