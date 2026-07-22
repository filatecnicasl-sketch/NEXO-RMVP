import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { HolderForm } from "@/components/HolderForm";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { ChevronLeft, ChevronRight, Plus, Trash2, Send } from "lucide-react";
import {
  initialFormState,
  emptyTitular,
  emptyMiembro,
  validateTitular1,
  validateVivienda,
} from "@/lib/formState";
import { REGIMEN_VIVIENDA, DORMITORIOS_OPTIONS, GRUPOS_CODIGOS, SEXO_OPTIONS, TIPO_IRPF } from "@/constants/options";
import { CITIZEN } from "@/constants/testIds";

const STEPS = [
  "Titular 1",
  "Titular 2",
  "Otros miembros",
  "Vivienda",
  "Justificación",
  "Declaración",
  "Resumen",
];

export default function ApplicationWizard({ mode = "create", applicationId = null }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialFormState);
  const [includeTitular2, setIncludeTitular2] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedExisting, setLoadedExisting] = useState(false);
  const [subsanacionMotivo, setSubsanacionMotivo] = useState("");

  // For edit mode, prefill
  useEffect(() => {
    if (mode === "create") return;
    const url = mode === "admin-edit" && applicationId
      ? `/admin/applications/${applicationId}`
      : "/applications/me";  // both edit and subsanacion load own data
    api.get(url).then((r) => {
      const d = r.data;
      setForm({
        titular1: { ...emptyTitular(), ...(d.titular1 || {}) },
        titular2: d.titular2 || null,
        otros_miembros: d.otros_miembros || [],
        vivienda: { ...initialFormState().vivienda, ...(d.vivienda || {}) },
        justificacion: d.justificacion || { casillas: [] },
        declaracion: { ...initialFormState().declaracion, ...(d.declaracion || {}) },
      });
      setIncludeTitular2(Boolean(d.titular2));
      setLoadedExisting(true);
    }).catch(() => toast.error("No se pudo cargar la solicitud"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, applicationId]);

  // Prefill titular1.email with user email on first load (create)
  useEffect(() => {
    if (mode === "create" && user && !form.titular1.email) {
      setForm((f) => ({ ...f, titular1: { ...f.titular1, email: user.email, nombre: f.titular1.nombre || user.name?.split(" ")[0] || "" } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode]);

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  const next = () => {
    if (step === 0) {
      const err = validateTitular1(form.titular1);
      if (err) return toast.error(err);
    }
    if (step === 3) {
      const err = validateVivienda(form.vivienda);
      if (err) return toast.error(err);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prev = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleTitular2 = (v) => {
    setIncludeTitular2(v);
    setForm((f) => ({ ...f, titular2: v ? (f.titular2 || emptyTitular()) : null }));
  };

  const addMiembro = () => setForm((f) => ({ ...f, otros_miembros: [...f.otros_miembros, emptyMiembro()] }));
  const removeMiembro = (i) => setForm((f) => ({ ...f, otros_miembros: f.otros_miembros.filter((_, idx) => idx !== i) }));
  const updateMiembro = (i, key, val) => setForm((f) => ({
    ...f,
    otros_miembros: f.otros_miembros.map((m, idx) => idx === i ? { ...m, [key]: val } : m),
  }));

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        titular1: form.titular1,
        titular2: includeTitular2 ? form.titular2 : null,
        otros_miembros: form.otros_miembros,
        vivienda: form.vivienda,
        justificacion: form.justificacion,
        declaracion: form.declaracion,
      };
      if (mode === "edit") {
        const r = await api.put("/applications/me", payload);
        toast.success("Solicitud actualizada");
        navigate("/dashboard");
        return r.data;
      } else if (mode === "admin-edit" && applicationId) {
        const r = await api.put(`/admin/applications/${applicationId}`, payload);
        toast.success("Solicitud actualizada por administrador");
        navigate(`/admin/solicitudes/${applicationId}`);
        return r.data;
      } else if (mode === "subsanacion") {
        if (!subsanacionMotivo.trim()) {
          toast.error("Indique el motivo de la subsanación");
          return;
        }
        await api.post("/applications/me/subsanaciones", { motivo: subsanacionMotivo, proposed_data: payload });
        toast.success("Subsanación enviada · pendiente de revisión por Hemsa");
        navigate("/dashboard");
        return;
      } else {
        const r = await api.post("/applications", payload);
        toast.success(`Solicitud enviada · Nº ${r.data.numero_registro}`);
        navigate("/dashboard");
        return r.data;
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo enviar la solicitud");
    } finally {
      setBusy(false);
    }
  };

  const toggleInArr = (arr, value) => arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  return (
    <div className="App">
      <Header variant={mode === "admin-edit" ? "admin" : "citizen"} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 page-enter">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--hemsa-green-hover)] font-semibold">{mode === "subsanacion" ? "Subsanación (requiere aprobación)" : mode === "edit" ? "Editar" : mode === "admin-edit" ? "Editar (administrador)" : "Nueva"} solicitud</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[color:var(--hemsa-text)] mt-1">
            Registro Municipal de Vivienda Protegida
          </h1>
          <p className="mt-2 text-sm text-[color:var(--hemsa-muted)]">Paso {step + 1} de {STEPS.length} · {STEPS[step]}</p>
          <div className="mt-4">
            <Progress value={progress} className="h-2" data-testid={CITIZEN.wizardProgress} />
          </div>
        </div>

        <Card className="p-6 sm:p-8 border-[color:var(--hemsa-border)]">
          {step === 0 && (
            <>
              <h2 className="font-heading text-xl font-semibold text-[color:var(--hemsa-text)] mb-1">Datos del Titular 1</h2>
              <p className="text-sm text-[color:var(--hemsa-muted)] mb-6">Persona principal solicitante.</p>
              <HolderForm data={form.titular1} onChange={(d) => setForm({ ...form, titular1: d })} prefix="t1" />
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-heading text-xl font-semibold text-[color:var(--hemsa-text)] mb-1">Titular 2 (opcional)</h2>
              <p className="text-sm text-[color:var(--hemsa-muted)] mb-4">Si solicita la vivienda junto a otra persona adulta, añada sus datos.</p>
              <label className="flex items-center gap-3 p-3 rounded-lg border border-[color:var(--hemsa-border)] cursor-pointer mb-6" data-testid={CITIZEN.toggleTitular2}>
                <Checkbox checked={includeTitular2} onCheckedChange={(v) => toggleTitular2(Boolean(v))} />
                <span className="text-sm text-[color:var(--hemsa-text)]">Quiero añadir un segundo titular</span>
              </label>
              {includeTitular2 && (
                <HolderForm data={form.titular2 || emptyTitular()} onChange={(d) => setForm({ ...form, titular2: d })} prefix="t2" />
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-heading text-xl font-semibold text-[color:var(--hemsa-text)] mb-1">Otros miembros de la unidad familiar</h2>
              <p className="text-sm text-[color:var(--hemsa-muted)] mb-6">Añada hijos/as y demás personas que convivan con usted.</p>
              <div className="space-y-4">
                {form.otros_miembros.map((m, i) => (
                  <div key={i} className="p-4 rounded-lg border border-[color:var(--hemsa-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-[color:var(--hemsa-text)]">Miembro #{i + 1}</div>
                      <Button variant="ghost" size="sm" onClick={() => removeMiembro(i)} data-testid={`${CITIZEN.removeOtroMiembroBtn}-${i}`} className="text-[color:var(--hemsa-error)]">
                        <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Apellidos y nombre</Label>
                        <Input value={m.nombre_completo} onChange={(e) => updateMiembro(i, "nombre_completo", e.target.value)} data-testid={`miembro-${i}-nombre`} />
                      </div>
                      <div>
                        <Label>NIF</Label>
                        <Input value={m.nif} onChange={(e) => updateMiembro(i, "nif", e.target.value)} data-testid={`miembro-${i}-nif`} />
                      </div>
                      <div>
                        <Label>Fecha de nacimiento</Label>
                        <Input type="date" value={m.fecha_nacimiento} onChange={(e) => updateMiembro(i, "fecha_nacimiento", e.target.value)} data-testid={`miembro-${i}-fnac`} />
                      </div>
                      <div>
                        <Label>Sexo</Label>
                        <Select value={m.sexo} onValueChange={(v) => updateMiembro(i, "sexo", v)}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                          <SelectContent>{SEXO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Nacionalidad</Label>
                        <Input value={m.nacionalidad} onChange={(e) => updateMiembro(i, "nacionalidad", e.target.value)} />
                      </div>
                      <div>
                        <Label>Ingresos económicos (€)</Label>
                        <Input type="number" value={m.ingresos_economicos} onChange={(e) => updateMiembro(i, "ingresos_economicos", parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <Label>Declaración IRPF</Label>
                        <Select value={m.tipo_declaracion} onValueChange={(v) => updateMiembro(i, "tipo_declaracion", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{TIPO_IRPF.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Año de ingresos</Label>
                        <Input type="number" value={m.anio_ingresos} onChange={(e) => updateMiembro(i, "anio_ingresos", parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addMiembro} data-testid={CITIZEN.addOtroMiembroBtn} className="rounded-full">
                  <Plus className="h-4 w-4 mr-1" /> Añadir miembro
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-heading text-xl font-semibold text-[color:var(--hemsa-text)] mb-1">Vivienda a la que se opta</h2>
              <p className="text-sm text-[color:var(--hemsa-muted)] mb-6">Indique el régimen, el número de dormitorios y cualquier necesidad especial.</p>

              <div className="space-y-6">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-2">Régimen</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {REGIMEN_VIVIENDA.map((o) => {
                      const checked = form.vivienda.regimen.includes(o.value);
                      return (
                        <label key={o.value} className="flex items-center gap-2 p-3 rounded-lg border border-[color:var(--hemsa-border)] hover:bg-[color:var(--hemsa-surface)] cursor-pointer" data-testid={`regimen-${o.value}`}>
                          <Checkbox checked={checked} onCheckedChange={() => setForm({ ...form, vivienda: { ...form.vivienda, regimen: toggleInArr(form.vivienda.regimen, o.value) } })} />
                          <span className="text-sm">{o.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-2">Dormitorios</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DORMITORIOS_OPTIONS.map((o) => {
                      const checked = form.vivienda.dormitorios.includes(o.value);
                      return (
                        <label key={o.value} className="flex items-center gap-2 p-3 rounded-lg border border-[color:var(--hemsa-border)] hover:bg-[color:var(--hemsa-surface)] cursor-pointer" data-testid={`dorm-${o.value}`}>
                          <Checkbox checked={checked} onCheckedChange={() => setForm({ ...form, vivienda: { ...form.vivienda, dormitorios: toggleInArr(form.vivienda.dormitorios, o.value) } })} />
                          <span className="text-sm">{o.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-2">Necesidades / situación familiar</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      ["silla_ruedas", "Algún miembro usa silla de ruedas"],
                      ["movilidad_reducida", "Algún miembro con movilidad reducida"],
                      ["cooperativa", "Desea formar parte de una cooperativa"],
                      ["alojamiento_otros_familiares", "Alojamiento con otros familiares"],
                      ["vivienda_inadecuada_superficie", "Vivienda inadecuada por superficie"],
                      ["renta_elevada", "Renta de alquiler elevada respecto a ingresos"],
                      ["necesidad_vivienda_adaptada", "Necesidad de vivienda adaptada"],
                      ["precariedad", "Precariedad habitacional"],
                      ["nueva_unidad_familiar", "Formación de nueva unidad familiar"],
                      ["otros", "Otros (especifique)"],
                    ].map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 p-3 rounded-lg border border-[color:var(--hemsa-border)] hover:bg-[color:var(--hemsa-surface)] cursor-pointer" data-testid={`viv-${k}`}>
                        <Checkbox checked={form.vivienda[k]} onCheckedChange={(v) => setForm({ ...form, vivienda: { ...form.vivienda, [k]: Boolean(v) } })} />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                  {form.vivienda.otros && (
                    <div className="mt-3">
                      <Label>Detalle de "Otros"</Label>
                      <Input value={form.vivienda.otros_detalle} onChange={(e) => setForm({ ...form, vivienda: { ...form.vivienda, otros_detalle: e.target.value } })} data-testid="viv-otros-detalle" />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="font-heading text-xl font-semibold text-[color:var(--hemsa-text)] mb-1">Justificación de la necesidad</h2>
              <p className="text-sm text-[color:var(--hemsa-muted)] mb-6">Marque todas las situaciones que apliquen. Deberá poder acreditarlas si se le solicita.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GRUPOS_CODIGOS.map((g) => {
                  const checked = form.justificacion.casillas.includes(g.code);
                  return (
                    <label key={g.code} className="flex items-start gap-2 p-3 rounded-lg border border-[color:var(--hemsa-border)] hover:bg-[color:var(--hemsa-surface)] cursor-pointer" data-testid={`just-${g.code}`}>
                      <Checkbox checked={checked} onCheckedChange={() => setForm({ ...form, justificacion: { ...form.justificacion, casillas: toggleInArr(form.justificacion.casillas, g.code) } })} />
                      <span className="text-sm"><b>{g.code}</b> · {g.label}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="font-heading text-xl font-semibold text-[color:var(--hemsa-text)] mb-1">Declaración responsable</h2>
              <p className="text-sm text-[color:var(--hemsa-muted)] mb-6">Información adicional y autorizaciones de notificación.</p>
              <div className="space-y-4">
                <div>
                  <Label>Si tiene vivienda en propiedad, motivo por el que solicita vivienda protegida</Label>
                  <Textarea rows={3} value={form.declaracion.motivo_propiedad} onChange={(e) => setForm({ ...form, declaracion: { ...form.declaracion, motivo_propiedad: e.target.value } })} data-testid="dec-motivo" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Otras inscripciones en otros municipios</Label>
                    <Input value={form.declaracion.inscripcion_otros_municipios} onChange={(e) => setForm({ ...form, declaracion: { ...form.declaracion, inscripcion_otros_municipios: e.target.value } })} data-testid="dec-otros-mun" />
                  </div>
                  <div>
                    <Label>Tiene carácter de preferencia en</Label>
                    <Input value={form.declaracion.preferencia_en} onChange={(e) => setForm({ ...form, declaracion: { ...form.declaracion, preferencia_en: e.target.value } })} data-testid="dec-pref" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  <label className="flex items-center gap-2 p-3 rounded-lg border border-[color:var(--hemsa-border)] cursor-pointer" data-testid="dec-email-auth">
                    <Checkbox checked={form.declaracion.autoriza_email} onCheckedChange={(v) => setForm({ ...form, declaracion: { ...form.declaracion, autoriza_email: Boolean(v) } })} />
                    <span className="text-sm">Autorizo recibir notificaciones por email</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 rounded-lg border border-[color:var(--hemsa-border)] cursor-pointer" data-testid="dec-sms-auth">
                    <Checkbox checked={form.declaracion.autoriza_sms} onCheckedChange={(v) => setForm({ ...form, declaracion: { ...form.declaracion, autoriza_sms: Boolean(v) } })} />
                    <span className="text-sm">Autorizo recibir SMS al móvil</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <h2 className="font-heading text-xl font-semibold text-[color:var(--hemsa-text)] mb-1">Resumen y envío</h2>
              <p className="text-sm text-[color:var(--hemsa-muted)] mb-6">Revise los datos y envíe la solicitud. Le asignaremos un número de registro.</p>
              <div className="space-y-4 text-sm">
                <div className="p-4 rounded-lg bg-[color:var(--hemsa-surface)] border border-[color:var(--hemsa-border)]">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] mb-1">Titular 1</div>
                  <div className="font-medium">{form.titular1.nombre} {form.titular1.apellido1} {form.titular1.apellido2} · {form.titular1.tipo_documento} {form.titular1.numero_documento}</div>
                  <div className="text-[color:var(--hemsa-muted)] text-xs mt-1">{form.titular1.email} · {form.titular1.telefono_movil}</div>
                </div>
                {includeTitular2 && form.titular2 && (
                  <div className="p-4 rounded-lg bg-[color:var(--hemsa-surface)] border border-[color:var(--hemsa-border)]">
                    <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] mb-1">Titular 2</div>
                    <div className="font-medium">{form.titular2.nombre} {form.titular2.apellido1} {form.titular2.apellido2}</div>
                  </div>
                )}
                <div className="p-4 rounded-lg bg-[color:var(--hemsa-surface)] border border-[color:var(--hemsa-border)]">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] mb-1">Vivienda</div>
                  <div className="font-medium">{form.vivienda.regimen.join(", ") || "—"} · {form.vivienda.dormitorios.join(", ") || "—"} dorm.</div>
                </div>
                <div className="p-4 rounded-lg bg-[color:var(--hemsa-surface)] border border-[color:var(--hemsa-border)]">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] mb-1">Unidad familiar</div>
                  <div className="font-medium">{1 + (includeTitular2 ? 1 : 0) + form.otros_miembros.length} personas</div>
                </div>
                <div className="p-4 rounded-lg bg-[color:var(--hemsa-surface)] border border-[color:var(--hemsa-border)]">
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] mb-1">Justificación</div>
                  <div className="font-medium">{form.justificacion.casillas.join(", ") || "—"}</div>
                </div>
              </div>
              {mode === "subsanacion" && (
                <div className="mt-6 p-4 rounded-lg border-2 border-[color:var(--hemsa-warning,#F59E0B)] bg-amber-50">
                  <Label className="font-semibold text-[color:var(--hemsa-text)]">Motivo de la subsanación *</Label>
                  <p className="text-xs text-[color:var(--hemsa-muted)] mb-2 mt-1">
                    Explique brevemente qué cambios solicita y por qué. La administración los revisará y aprobará o rechazará. Los cambios NO se aplicarán hasta que el administrador los apruebe.
                  </p>
                  <Textarea rows={4} value={subsanacionMotivo} onChange={(e) => setSubsanacionMotivo(e.target.value)} placeholder="Ej.: Solicito corregir mi domicilio (cambié de calle el 03/2026) y actualizar los ingresos del 2024 según nueva declaración de la AEAT."
                    data-testid="subsanacion-motivo" />
                </div>
              )}
            </>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-[color:var(--hemsa-border)]">
            <Button variant="ghost" onClick={prev} disabled={step === 0} data-testid={CITIZEN.wizardStepPrev}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} className="hemsa-btn-primary rounded-full px-6" data-testid={CITIZEN.wizardStepNext}>
                Continuar <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={busy} className="hemsa-btn-primary rounded-full px-6" data-testid={CITIZEN.wizardSubmit}>
                <Send className="h-4 w-4 mr-1" /> {busy ? "Enviando…" : (mode === "subsanacion" ? "Enviar subsanación" : (mode === "edit" || mode === "admin-edit" ? "Guardar cambios" : "Enviar solicitud"))}
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
