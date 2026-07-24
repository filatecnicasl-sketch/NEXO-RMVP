
import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import { Upload, FileText, Sparkles, CheckCircle2, Plus, Trash2 } from "lucide-react";

const REGIMEN_OPTS = ["Propiedad", "Alquiler", "Alquiler con opción a compra"];
const DORM_OPTS = ["1", "2", "3", "4"];
const TIPO_DOC_OPTS = ["DNI", "NIE", "Pasaporte"];

const TITULAR_FIELDS = [
  ["nombre", "Nombre"], ["apellido1", "Primer apellido"], ["apellido2", "Segundo apellido"],
  ["sexo", "Sexo"], ["nacionalidad", "Nacionalidad"], ["fecha_nacimiento", "Fecha nacimiento (DD/MM/AAAA)"],
  ["empadronado_en", "Empadronado en"], ["direccion", "Dirección"],
  ["codigo_postal", "Código postal"], ["telefono_movil", "Teléfono móvil"], ["telefono_fijo", "Teléfono fijo"],
  ["email", "Email"], ["ingresos_economicos", "Ingresos anuales (€)", "number"],
  ["tipo_declaracion_irpf", "Tipo declaración IRPF"], ["anio_ingresos", "Año de los ingresos", "number"],
];

const VIVIENDA_FLAGS = [
  ["silla_ruedas", "Silla de ruedas"], ["movilidad_reducida", "Movilidad reducida"],
  ["cooperativa", "Cooperativa"], ["alojamiento_otros_familiares", "Alojamiento con familiares"],
  ["vivienda_inadecuada_superficie", "Vivienda inadecuada (superficie)"], ["renta_elevada", "Renta elevada"],
  ["necesidad_vivienda_adaptada", "Necesita vivienda adaptada"], ["precariedad", "Precariedad"],
  ["nueva_unidad_familiar", "Nueva unidad familiar"],
];

function setIn(obj, path, value) {
  const keys = path.split(".");
  const copy = { ...obj };
  let cur = copy;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = Array.isArray(cur[keys[i]]) ? [...cur[keys[i]]] : { ...(cur[keys[i]] || {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return copy;
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="text-xs text-[color:var(--hemsa-muted)]">{label}</span>
      <Input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(type === "number" ? (parseFloat(e.target.value) || 0) : e.target.value)}
        className="mt-1"
      />
    </label>
  );
}

export default function AdminOcr() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const upd = (path, value) => setPreview((p) => setIn(p, path, value));

  const toggleArray = (path, item) => setPreview((p) => {
    const arr = path.split(".").reduce((o, k) => o?.[k], p) || [];
    const next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
    return setIn(p, path, next);
  });

  const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); };
  const onPick = (e) => { const f = e.target.files?.[0]; if (f) setFile(f); };

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
      toast.success(`Datos extraídos con ${r.data.provider}. Revísalos y edita lo que necesites.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo procesar el PDF");
    } finally { setBusy(false); }
  };

  const onConfirmRegister = async () => {
    if (!preview) return toast.error("Primero procesa un PDF");
    setCreating(true);
    try {
      const r = await api.post("/admin/ocr/register-data", preview, { timeout: 60000 });
      toast.success(`Alta creada · Nº ${r.data.application.numero_registro}`);
      navigate(`/admin/solicitudes/${r.data.application.application_id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo crear el alta");
    } finally { setCreating(false); }
  };

  const renderTitular = (key, titulo) => {
    const t = preview?.[key];
    if (key === "titular2" && !t) {
      return (
        <div className="mt-6">
          <Button variant="outline" onClick={() => upd("titular2", { tipo_documento: "DNI" })}>
            <Plus className="h-4 w-4 mr-1" /> Añadir segundo titular
          </Button>
        </div>
      );
    }
    if (!t) return null;
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-semibold text-[color:var(--hemsa-text)]">{titulo}</h3>
          {key === "titular2" && (
            <Button variant="ghost" onClick={() => upd("titular2", null)}>
              <Trash2 className="h-4 w-4 mr-1" /> Quitar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs text-[color:var(--hemsa-muted)]">Tipo de documento</span>
            <select
              className="mt-1 w-full h-9 rounded-md border border-[color:var(--hemsa-border)] bg-white px-2 text-sm"
              value={t.tipo_documento || "DNI"}
              onChange={(e) => upd(`${key}.tipo_documento`, e.target.value)}
            >
              {TIPO_DOC_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <Field label="Número de documento" value={t.numero_documento} onChange={(v) => upd(`${key}.numero_documento`, v)} />
          {TITULAR_FIELDS.map(([f, label, type]) => (
            <Field key={f} label={label} type={type || "text"} value={t[f]} onChange={(v) => upd(`${key}.${f}`, v)} />
          ))}
          <Field
            label="Grupos de acreditación (códigos separados por comas)"
            value={(t.grupos_acreditacion || []).join(", ")}
            onChange={(v) => upd(`${key}.grupos_acreditacion`, v.split(",").map((x) => x.trim()).filter(Boolean))}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <Header variant="admin" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 page-enter">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--hemsa-green-hover)] font-semibold">Alta automática</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[color:var(--hemsa-text)] mt-1">Subir PDF y dar de alta con IA</h1>
          <p className="mt-2 text-sm text-[color:var(--hemsa-muted)] max-w-2xl">
            Procesa el PDF oficial con IA, <b>revisa y edita</b> los datos extraídos si algo no está bien, y confirma el alta. La creación es instantánea.
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
              <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold">Datos extraídos — revisa y edita lo que necesites</div>
                  <div className="text-sm text-[color:var(--hemsa-text)] mt-1 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[color:var(--hemsa-green)]" />
                    Modelo usado: <b>{provider}</b>
                  </div>
                </div>
                <Button onClick={onConfirmRegister} disabled={creating} className="hemsa-btn-primary rounded-full px-6" data-testid={ADMIN.ocrConfirmBtn}>
                  <FileText className="h-4 w-4 mr-1" /> {creating ? "Creando alta…" : "Confirmar alta"}
                </Button>
              </div>

              <div className="mt-4 max-w-xs">
                <Field label="Nº de registro previo (si aparece en el documento)" value={preview.numero_registro_previo} onChange={(v) => upd("numero_registro_previo", v)} />
              </div>

              {renderTitular("titular1", "Titular 1")}
              {renderTitular("titular2", "Titular 2")}

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading font-semibold text-[color:var(--hemsa-text)]">Otros miembros de la unidad familiar</h3>
                  <Button variant="outline" onClick={() => upd("otros_miembros", [...(preview.otros_miembros || []), { nombre_completo: "", nif: "", fecha_nacimiento: "", ingresos_economicos: 0, tipo_declaracion: "No la Hace", anio_ingresos: new Date().getFullYear() - 1, grupos_acreditacion: [] }])}>
                    <Plus className="h-4 w-4 mr-1" /> Añadir miembro
                  </Button>
                </div>
                {(preview.otros_miembros || []).map((m, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3 items-end border-b border-[color:var(--hemsa-border)] pb-3">
                    <Field label="Nombre completo" value={m.nombre_completo} onChange={(v) => upd(`otros_miembros.${i}.nombre_completo`, v)} />
                    <Field label="NIF" value={m.nif} onChange={(v) => upd(`otros_miembros.${i}.nif`, v)} />
                    <Field label="Fecha nacimiento" value={m.fecha_nacimiento} onChange={(v) => upd(`otros_miembros.${i}.fecha_nacimiento`, v)} />
                    <Field label="Ingresos (€)" type="number" value={m.ingresos_economicos} onChange={(v) => upd(`otros_miembros.${i}.ingresos_economicos`, v)} />
                    <Button variant="ghost" onClick={() => upd("otros_miembros", preview.otros_miembros.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 mr-1" /> Quitar
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <h3 className="font-heading font-semibold text-[color:var(--hemsa-text)] mb-3">Vivienda demandada</h3>
                <div className="text-xs text-[color:var(--hemsa-muted)] mb-1">Régimen</div>
                <div className="flex flex-wrap gap-4 mb-3">
                  {REGIMEN_OPTS.map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(preview.vivienda?.regimen || []).includes(o)} onChange={() => toggleArray("vivienda.regimen", o)} /> {o}
                    </label>
                  ))}
                </div>
                <div className="text-xs text-[color:var(--hemsa-muted)] mb-1">Dormitorios</div>
                <div className="flex flex-wrap gap-4 mb-3">
                  {DORM_OPTS.map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(preview.vivienda?.dormitorios || []).includes(o)} onChange={() => toggleArray("vivienda.dormitorios", o)} /> {o}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {VIVIENDA_FLAGS.map(([f, label]) => (
                    <label key={f} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!preview.vivienda?.[f]} onChange={(e) => upd(`vivienda.${f}`, e.target.checked)} /> {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Justificación — casillas (códigos separados por comas)"
                  value={(preview.justificacion?.casillas || []).join(", ")}
                  onChange={(v) => upd("justificacion.casillas", v.split(",").map((x) => x.trim()).filter(Boolean))}
                />
                <Field label="Preferencia de zona / en" value={preview.declaracion?.preferencia_en} onChange={(v) => upd("declaracion.preferencia_en", v)} />
                <Field label="Motivo propiedad" value={preview.declaracion?.motivo_propiedad} onChange={(v) => upd("declaracion.motivo_propiedad", v)} />
                <Field label="Inscripción en otros municipios" value={preview.declaracion?.inscripcion_otros_municipios} onChange={(v) => upd("declaracion.inscripcion_otros_municipios", v)} />
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={onConfirmRegister} disabled={creating} className="hemsa-btn-primary rounded-full px-6">
                  <FileText className="h-4 w-4 mr-1" /> {creating ? "Creando alta…" : "Confirmar alta"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}