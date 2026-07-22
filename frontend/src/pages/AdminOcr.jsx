import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import { Upload, FileText, Sparkles, CheckCircle2 } from "lucide-react";

export default function AdminOcr() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // extracted data preview
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const onProcess = async () => {
    if (!file) return toast.error("Seleccione un PDF");
    setBusy(true);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/ocr/extract", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      setPreview(r.data.data);
      setProvider(r.data.provider);
      toast.success(`Datos extraídos con ${r.data.provider}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo procesar el PDF");
    } finally { setBusy(false); }
  };

  const onConfirmRegister = async () => {
    if (!file) return toast.error("Falta el PDF");
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/admin/ocr/register", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 180000 });
      toast.success(`Alta creada · Nº ${r.data.application.numero_registro}`);
      navigate(`/admin/solicitudes/${r.data.application.application_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo crear el alta");
    } finally { setCreating(false); }
  };

  return (
    <div className="App">
      <Header variant="admin" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 page-enter">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--hemsa-green-hover)] font-semibold">Alta automática</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[color:var(--hemsa-text)] mt-1">Subir PDF y dar de alta con IA</h1>
          <p className="mt-2 text-sm text-[color:var(--hemsa-muted)] max-w-2xl">
            Procesa el PDF oficial de la solicitud con Gemini 3 Pro (Claude Sonnet 4.5 como respaldo) y extrae todos los campos. Revíselos y confirme la creación.
          </p>
        </div>

        <Card className="p-8 border-[color:var(--hemsa-border)]">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="border-2 border-dashed border-[color:var(--hemsa-border)] rounded-2xl p-12 text-center hover:border-[color:var(--hemsa-green)] transition-colors cursor-pointer"
            onClick={() => inputRef.current?.click()}
            data-testid="ocr-dropzone"
          >
            <div className="mx-auto h-14 w-14 rounded-2xl bg-[color:var(--hemsa-green-soft)] flex items-center justify-center text-[color:var(--hemsa-green-hover)]">
              <Upload className="h-6 w-6" />
            </div>
            <div className="font-heading font-semibold text-lg text-[color:var(--hemsa-text)] mt-4">
              {file ? file.name : "Arrastre aquí su PDF o pulse para seleccionar"}
            </div>
            <div className="text-xs text-[color:var(--hemsa-muted)] mt-1">Tamaño máximo 20 MB · Sólo PDF</div>
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onPick} data-testid={ADMIN.ocrUploadInput} />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={onProcess} disabled={!file || busy} className="hemsa-btn-primary rounded-full px-6" data-testid={ADMIN.ocrProcessBtn}>
              <Sparkles className="h-4 w-4 mr-1" /> {busy ? "Procesando con IA…" : "Procesar con IA"}
            </Button>
            {file && <Button variant="ghost" onClick={() => { setFile(null); setPreview(null); }}>Cambiar archivo</Button>}
          </div>

          {preview && (
            <div className="mt-8 border-t border-[color:var(--hemsa-border)] pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold">Vista previa de datos extraídos</div>
                  <div className="text-sm text-[color:var(--hemsa-text)] mt-1 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[color:var(--hemsa-green)]" />
                    Modelo usado: <b>{provider}</b>
                  </div>
                </div>
                <Button onClick={onConfirmRegister} disabled={creating} className="hemsa-btn-primary rounded-full px-6" data-testid={ADMIN.ocrConfirmBtn}>
                  <FileText className="h-4 w-4 mr-1" /> {creating ? "Creando alta…" : "Confirmar alta"}
                </Button>
              </div>
              <pre className="bg-[color:var(--hemsa-surface)] rounded-lg p-4 text-xs overflow-auto max-h-[500px] border border-[color:var(--hemsa-border)]" data-testid="ocr-preview-json">
{JSON.stringify(preview, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
