import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Paperclip, Upload, Trash2, Download, FileText, Image as ImageIcon } from "lucide-react";

const CATEGORIAS = [
  { value: "dni", label: "DNI / NIE / Pasaporte" },
  { value: "libro_familia", label: "Libro de familia" },
  { value: "certificado_discapacidad", label: "Certificado de discapacidad" },
  { value: "certificado_renta", label: "Certificado de renta / IRPF" },
  { value: "empadronamiento", label: "Volante de empadronamiento" },
  { value: "violencia_genero", label: "Acreditación violencia de género" },
  { value: "otros", label: "Otros" },
];

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_MB = 15;

function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function Attachments({ applicationId, readOnly = false }) {
  const inputRef = useRef(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState("dni");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/applications/${applicationId}/attachments`);
      setList(r.data || []);
    } catch (e) {
      // ignore
    } finally { setLoading(false); }
  };

  useEffect(() => { if (applicationId) load(); /* eslint-disable-next-line */ }, [applicationId]);

  const onPick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!ALLOWED.includes(f.type)) {
      toast.error("Tipo no permitido. PDF/JPG/PNG/WEBP");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`Máx ${MAX_MB} MB`);
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      await api.post(`/applications/${applicationId}/attachments?categoria=${encodeURIComponent(categoria)}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      toast.success("Documento subido");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo subir");
    } finally { setBusy(false); }
  };

  const onDownload = async (att) => {
    try {
      const r = await api.get(`/attachments/${att.attachment_id}/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: att.content_type }));
      const a = document.createElement("a");
      a.href = url; a.download = att.original_filename || "documento"; document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo descargar");
    }
  };

  const onDelete = async (att) => {
    if (!window.confirm(`¿Eliminar "${att.original_filename}"?`)) return;
    try {
      await api.delete(`/attachments/${att.attachment_id}`);
      toast.success("Adjunto eliminado");
      await load();
    } catch { toast.error("No se pudo eliminar"); }
  };

  return (
    <div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mr-2">Categoría:</div>
          <div className="min-w-[240px]">
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger data-testid="attach-categoria"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={() => inputRef.current?.click()} disabled={busy} className="hemsa-btn-primary rounded-full" data-testid="attach-upload-btn">
            <Upload className="h-4 w-4 mr-1" /> {busy ? "Subiendo…" : "Subir documento"}
          </Button>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} data-testid="attach-input" />
          <div className="text-xs text-[color:var(--hemsa-muted)]">PDF · JPG · PNG · WEBP · Máx {MAX_MB} MB</div>
        </div>
      )}

      <div className="space-y-2">
        {loading && <div className="text-sm text-[color:var(--hemsa-muted)]">Cargando documentos…</div>}
        {!loading && list.length === 0 && (
          <div className="text-sm text-[color:var(--hemsa-muted)] py-4 text-center border border-dashed border-[color:var(--hemsa-border)] rounded-lg">
            <Paperclip className="h-4 w-4 inline mr-1" /> Aún no hay documentos adjuntos.
          </div>
        )}
        {!loading && list.map((a) => (
          <div key={a.attachment_id} className="flex items-center gap-3 p-3 rounded-lg border border-[color:var(--hemsa-border)] hover:bg-[color:var(--hemsa-surface)] transition-colors" data-testid={`attach-row-${a.attachment_id}`}>
            <div className="h-9 w-9 rounded-lg bg-[color:var(--hemsa-green-soft)] flex items-center justify-center text-[color:var(--hemsa-green-hover)]">
              {a.content_type?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[color:var(--hemsa-text)] truncate">{a.original_filename}</div>
              <div className="text-xs text-[color:var(--hemsa-muted)]">
                <span className="uppercase tracking-wide">{(CATEGORIAS.find((c) => c.value === a.categoria)?.label) || a.categoria}</span> · {fmtSize(a.size || 0)} · {new Date(a.created_at).toLocaleDateString("es-ES")}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onDownload(a)} data-testid={`attach-download-${a.attachment_id}`}>
              <Download className="h-4 w-4" />
            </Button>
            {!readOnly && (
              <Button size="sm" variant="ghost" onClick={() => onDelete(a)} data-testid={`attach-delete-${a.attachment_id}`} className="text-[color:var(--hemsa-error)]">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
