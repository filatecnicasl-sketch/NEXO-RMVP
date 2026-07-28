import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Header } from "@/components/Header";
import { Attachments } from "@/components/Attachments";
import { AdminAllegations } from "@/components/AdminAllegations";
import { Subsanaciones } from "@/components/Subsanaciones";
import { api } from "@/lib/api";
import { ADMIN } from "@/constants/testIds";
import { STATUS_OPTIONS, STATUS_LABEL, GRUPOS_CODIGOS } from "@/constants/options";
import { ArrowLeft, History, NotebookPen, Download, Award, Paperclip, FileSignature, ShieldCheck, Upload, MessageSquare, Pencil } from "lucide-react";
function Section({ title, children }) {
  return (
    <Card className="p-6 border-[color:var(--hemsa-border)]">
      <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-3">{title}</div>
      {children}
    </Card>
  );
}

function KV({ k, v }) {
  return (
    <div className="text-sm">
      <div className="text-xs text-[color:var(--hemsa-muted)] uppercase tracking-wide">{k}</div>
      <div className="font-medium text-[color:var(--hemsa-text)]">{v || "—"}</div>
    </div>
  );
}

function HolderBlock({ t }) {
  if (!t) return <div className="text-sm text-[color:var(--hemsa-muted)]">No proporcionado</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KV k="Nombre" v={`${t.nombre} ${t.apellido1} ${t.apellido2}`.trim()} />
      <KV k="Documento" v={`${t.tipo_documento} ${t.numero_documento}`} />
      <KV k="Sexo" v={t.sexo} />
      <KV k="Nacionalidad" v={t.nacionalidad} />
      <KV k="Fecha nac." v={t.fecha_nacimiento} />
      <KV k="Empadronado/a en" v={t.empadronado_en} />
      <KV k="Dirección" v={`${t.direccion || t.domicilio || '—'} (${t.codigo_postal || '—'})`} />
      <KV k="Email" v={t.email} />
      <KV k="Móvil" v={t.telefono_movil} />
      <KV k="Tel. fijo" v={t.telefono_fijo} />
      <KV k="Ingresos" v={`${t.ingresos_economicos} € · ${t.tipo_declaracion_irpf} ${t.anio_ingresos}`} />
      <div className="sm:col-span-2 lg:col-span-3">
        <div className="text-xs text-[color:var(--hemsa-muted)] uppercase tracking-wide">Grupos acreditación</div>
        <div className="font-medium text-[color:var(--hemsa-text)]">{(t.grupos_acreditacion || []).join(", ") || "—"}</div>
      </div>
    </div>
  );
}

export default function AdminApplicationDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [noteText, setNoteText] = useState("");
  const [adjPoints, setAdjPoints] = useState(0);
  const [adjReason, setAdjReason] = useState("");
  const [busy, setBusy] = useState(false);
  const signInputRef = React.useRef(null);
  const [signBusy, setSignBusy] = useState(false);

  const uploadSignedApproval = async (file) => {
    setSignBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(`/admin/applications/${id}/sign-approval`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
      if (r.data.firma?.fnmt && r.data.firma?.chain_validated) toast.success("Firma FNMT verificada criptográficamente y adjuntada");
      else if (r.data.firma?.fnmt) toast.warning("Firmante FNMT detectado pero la cadena CA no validó");
      else toast.warning("PDF firmado, pero el emisor no es FNMT-RCM");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "PDF sin firma válida");
    } finally { setSignBusy(false); }
  };

  const load = async () => {
    const r = await api.get(`/admin/applications/${id}`);
    setData(r.data);
    setNewStatus(r.data.status);
    setAdjPoints(r.data?.score_adjustment?.points || 0);
    setAdjReason(r.data?.score_adjustment?.reason || "");
  };

  useEffect(() => { load().catch(() => toast.error("Solicitud no encontrada")); }, [id]);

  const updateStatus = async () => {
    setBusy(true);
    try {
      const r = await api.patch(`/admin/applications/${id}/status`, { status: newStatus, nota: statusNote });
      setData(r.data);
      setStatusNote("");
      toast.success("Estado actualizado");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo actualizar el estado");
    } finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      const r = await api.post(`/admin/applications/${id}/notes`, { texto: noteText.trim() });
      setData(r.data);
      setNoteText("");
      toast.success("Nota añadida");
    } catch { toast.error("No se pudo añadir la nota"); }
    finally { setBusy(false); }
  };

  const recomputeScore = async () => {
    try {
      const r = await api.post(`/admin/applications/${id}/recompute-score`);
      setData(r.data);
      toast.success(`Baremo recalculado: ${r.data.score} pts`);
    } catch { toast.error("No se pudo recalcular"); }
  };

  const downloadPdf = async () => {
    try {
      const r = await api.get(`/admin/applications/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `resguardo_${data.numero_registro}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("No se pudo descargar el PDF"); }
  };

  const saveAdjustment = async () => {
    try {
      const r = await api.patch(`/admin/applications/${id}/score-adjustment`, { points: parseInt(adjPoints) || 0, reason: adjReason });
      setData({ ...data, score: r.data.score, score_breakdown: r.data.score_breakdown, score_adjustment: r.data.score_adjustment });
      toast.success(`Ajuste aplicado: ${r.data.score} pts totales`);
    } catch { toast.error("No se pudo aplicar el ajuste"); }
  };

  if (!data) {
    return (
      <div className="App">
        <Header variant="admin" />
        <main className="max-w-5xl mx-auto px-6 py-16 text-[color:var(--hemsa-muted)]">Cargando…</main>
      </div>
    );
  }

  const v = data.vivienda || {};
  const dec = data.declaracion || {};

  return (
    <div className="App">
      <Header variant="admin" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 page-enter space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2"><Link to="/admin/solicitudes"><ArrowLeft className="h-4 w-4 mr-1" /> Volver al listado</Link></Button>
            <h1 className="font-heading text-3xl font-bold text-[color:var(--hemsa-text)]">{data.numero_registro}</h1>
            <p className="text-sm text-[color:var(--hemsa-muted)]">
              Creada el {new Date(data.created_at).toLocaleString("es-ES")}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button asChild variant="outline" className="rounded-full" data-testid="admin-edit-btn">
              <Link to={`/admin/solicitudes/${id}/editar`}>
                <Pencil className="h-4 w-4 mr-1" /> Editar registro
              </Link>
            </Button>
            <Button onClick={downloadPdf} variant="outline" className="rounded-full" data-testid="admin-download-pdf-btn">
              <Download className="h-4 w-4 mr-1" /> Descargar PDF
            </Button>
            <span className={`status-pill status-${data.status}`}>{STATUS_LABEL[data.status] || data.status}</span>
          </div>
        </div>

        {data.score !== undefined && data.score !== null && (
          <Card className="p-5 border-[color:var(--hemsa-border)] bg-[color:var(--hemsa-green-soft)]">
            <div className="flex items-center gap-4 justify-between flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center text-[color:var(--hemsa-green-hover)]">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-green-hover)] font-semibold">Baremo</div>
                  <div className="font-heading text-3xl font-extrabold text-[color:var(--hemsa-text)]" data-testid="admin-score">{data.score} pts</div>
                </div>
              </div>
              <div className="flex-1 min-w-[280px]">
                <div className="text-xs text-[color:var(--hemsa-muted)] mb-1">Desglose</div>
                <div className="flex flex-wrap gap-1.5">
                  {(data.score_breakdown || []).map((b, i) => (
                    <span key={i} className="px-2 py-1 rounded-full bg-white text-[color:var(--hemsa-text)] text-[11px] border border-[color:var(--hemsa-border)]">{b.label} <b className="text-[color:var(--hemsa-green-hover)]">+{b.points}</b></span>
                  ))}
                  {(!data.score_breakdown || data.score_breakdown.length === 0) && (
                    <span className="text-xs text-[color:var(--hemsa-muted)]">Sin elementos puntuables.</span>
                  )}
                </div>
              </div>
              <Button onClick={recomputeScore} variant="outline" size="sm" className="rounded-full" data-testid="recompute-score-btn">
                Recalcular
              </Button>
            </div>

            <div className="mt-4 pt-4 border-t border-[color:var(--hemsa-green)]/30">
              <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-green-hover)] font-semibold mb-2">Ajuste manual de puntuación (circunstancias personales)</div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="text-xs text-[color:var(--hemsa-muted)]">Puntos (+/-)</label>
                  <Input type="number" value={adjPoints} onChange={(e) => setAdjPoints(e.target.value)} data-testid="score-adjustment-points" />
                </div>
                <div className="md:col-span-8">
                  <label className="text-xs text-[color:var(--hemsa-muted)]">Motivo (queda registrado en el historial)</label>
                  <Input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Ej: Familia con menor con enfermedad crónica acreditada" data-testid="score-adjustment-reason" />
                </div>
                <div className="md:col-span-2">
                  <Button onClick={saveAdjustment} className="hemsa-btn-primary rounded-full w-full" data-testid="score-adjustment-save">
                    Aplicar
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        <Section title="Titular 1"><HolderBlock t={data.titular1} /></Section>
        {data.titular2 && <Section title="Titular 2"><HolderBlock t={data.titular2} /></Section>}

        <Section title={`Otros miembros (${(data.otros_miembros || []).length})`}>
          {(!data.otros_miembros || data.otros_miembros.length === 0) ? (
            <div className="text-sm text-[color:var(--hemsa-muted)]">Sin miembros adicionales.</div>
          ) : (
            <div className="space-y-3">
              {data.otros_miembros.map((m, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[color:var(--hemsa-surface)]">
                  <KV k="Nombre" v={m.nombre_completo} />
                  <KV k="NIF" v={m.nif} />
                  <KV k="F. Nac." v={m.fecha_nacimiento} />
                  <KV k="Ingresos" v={`${m.ingresos_economicos} € · ${m.tipo_declaracion}`} />
                  <KV k="Año" v={m.anio_ingresos} />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Vivienda solicitada">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KV k="Régimen" v={(v.regimen || []).join(", ")} />
            <KV k="Dormitorios" v={(v.dormitorios || []).join(", ")} />
            <KV k="Silla ruedas / Mov. red." v={`${v.silla_ruedas ? "Sí" : "No"} / ${v.movilidad_reducida ? "Sí" : "No"}`} />
            <KV k="Cooperativa" v={v.cooperativa ? "Sí" : "No"} />
            <KV k="Alojamiento c/ familiares" v={v.alojamiento_otros_familiares ? "Sí" : "No"} />
            <KV k="Renta elevada" v={v.renta_elevada ? "Sí" : "No"} />
            <KV k="Sup. inadecuada" v={v.vivienda_inadecuada_superficie ? "Sí" : "No"} />
            <KV k="Adaptada" v={v.necesidad_vivienda_adaptada ? "Sí" : "No"} />
            <KV k="Precariedad" v={v.precariedad ? "Sí" : "No"} />
            <KV k="Nueva U.F." v={v.nueva_unidad_familiar ? "Sí" : "No"} />
            <KV k="Otros" v={v.otros ? (v.otros_detalle || "Sí") : "No"} />
          </div>
        </Section>

        <Section title="Justificación">
          <div className="flex flex-wrap gap-2">
            {(data.justificacion?.casillas || []).length === 0 && <span className="text-sm text-[color:var(--hemsa-muted)]">Sin justificaciones marcadas.</span>}
            {(data.justificacion?.casillas || []).map((c) => {
              const g = GRUPOS_CODIGOS.find((x) => x.code === c);
              return <span key={c} className="px-3 py-1.5 rounded-full bg-[color:var(--hemsa-green-soft)] text-[color:var(--hemsa-green-hover)] text-xs font-semibold">{c} · {g?.label || ""}</span>;
            })}
          </div>
        </Section>

        <Section title="Declaración responsable">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KV k="Motivo (si tiene propiedad)" v={dec.motivo_propiedad} />
            <KV k="Otras inscripciones" v={dec.inscripcion_otros_municipios} />
            <KV k="Preferencia en" v={dec.preferencia_en} />
            <KV k="Notificaciones" v={`${dec.autoriza_email ? "Email" : ""}${dec.autoriza_email && dec.autoriza_sms ? " · " : ""}${dec.autoriza_sms ? "SMS" : ""}` || "—"} />
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Actualizar estado">
            <div className="space-y-3">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid={ADMIN.statusUpdateSelect}><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea placeholder="Motivo / nota interna asociada al cambio (opcional)" rows={3} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
              <Button onClick={updateStatus} disabled={busy || newStatus === data.status} className="hemsa-btn-primary rounded-full px-5" data-testid={ADMIN.statusUpdateBtn}>
                Guardar estado
              </Button>
            </div>
          </Section>

          <Section title="Notas internas">
            <div className="space-y-3">
              <Textarea placeholder="Escribir una nota interna…" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} data-testid={ADMIN.noteTextarea} />
              <Button onClick={addNote} disabled={busy} variant="outline" className="rounded-full" data-testid={ADMIN.addNoteBtn}>
                <NotebookPen className="h-4 w-4 mr-1" /> Añadir nota
              </Button>
              <div className="space-y-2 pt-2">
                {(data.notas_internas || []).length === 0 && <div className="text-sm text-[color:var(--hemsa-muted)]">Sin notas internas.</div>}
                {(data.notas_internas || []).slice().reverse().map((n, i) => (
                  <div key={i} className="p-3 rounded-lg bg-[color:var(--hemsa-surface)] text-sm">
                    <div className="text-[color:var(--hemsa-text)]">{n.texto}</div>
                    <div className="text-xs text-[color:var(--hemsa-muted)] mt-1">{n.by_name || n.by} · {new Date(n.at).toLocaleString("es-ES")}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </div>

        <Section title={<><FileSignature className="h-4 w-4 inline mr-1" /> Firmas digitales</>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-[color:var(--hemsa-border)]">
              <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-2">Firma del ciudadano (Declaración jurada)</div>
              {data.firma_ciudadano?.firmado ? (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-[color:var(--hemsa-text)] font-semibold">
                    <ShieldCheck className={`h-4 w-4 ${data.firma_ciudadano.fnmt && data.firma_ciudadano.chain_validated ? "text-[color:var(--hemsa-green)]" : data.firma_ciudadano.fnmt ? "text-amber-500" : "text-[color:var(--hemsa-muted)]"}`} />
                    {data.firma_ciudadano.fnmt && data.firma_ciudadano.chain_validated
                      ? "FNMT verificada (cadena CA OK)"
                      : data.firma_ciudadano.fnmt
                        ? "FNMT detectado · cadena no validada"
                        : data.firma_ciudadano.tipo === "manual" ? "Aceptación manual" : "Firmada (no FNMT)"}
                  </div>
                  <div className="text-xs text-[color:var(--hemsa-muted)]">
                    {data.firma_ciudadano.firmado_at && new Date(data.firma_ciudadano.firmado_at).toLocaleString("es-ES")}
                  </div>
                  {data.firma_ciudadano.signers?.[0]?.cn && (
                    <div className="text-xs text-[color:var(--hemsa-text)]">Firmante: <b>{data.firma_ciudadano.signers[0].cn}</b>{data.firma_ciudadano.signers[0].dni ? ` · ${data.firma_ciudadano.signers[0].dni}` : ""}</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-[color:var(--hemsa-muted)]">Sin firmar todavía.</div>
              )}
            </div>

            <div className="p-4 rounded-lg border border-[color:var(--hemsa-border)]">
              <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-2">Firma del administrador (aprobación)</div>
              {data.firma_admin?.firmado ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[color:var(--hemsa-text)] font-semibold">
                    <ShieldCheck className={`h-4 w-4 ${data.firma_admin.fnmt && data.firma_admin.chain_validated ? "text-[color:var(--hemsa-green)]" : data.firma_admin.fnmt ? "text-amber-500" : "text-[color:var(--hemsa-muted)]"}`} />
                    {data.firma_admin.fnmt && data.firma_admin.chain_validated
                      ? "FNMT verificada (cadena CA OK)"
                      : data.firma_admin.fnmt
                        ? "FNMT detectado · cadena no validada"
                        : "Firmada (no FNMT)"}
                  </div>
                  <div className="text-xs text-[color:var(--hemsa-muted)]">
                    {data.firma_admin.firmado_at && new Date(data.firma_admin.firmado_at).toLocaleString("es-ES")}
                  </div>
                  {data.firma_admin.signers?.[0]?.cn && (
                    <div className="text-xs text-[color:var(--hemsa-text)]">Firmante: <b>{data.firma_admin.signers[0].cn}</b></div>
                  )}
                  <Button size="sm" variant="outline" className="rounded-full mt-2" onClick={async () => {
                    try {
                      const r = await api.get(`/applications/${id}/signed-approval`, { responseType: "blob" });
                      const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
                      const a = document.createElement("a"); a.href = url; a.download = data.firma_admin.original_filename || `aprobacion_${data.numero_registro}.pdf`;
                      document.body.appendChild(a); a.click(); a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch { toast.error("No se pudo descargar"); }
                  }} data-testid="admin-download-signed-btn">
                    <Download className="h-4 w-4 mr-1" /> Descargar firmado
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-[color:var(--hemsa-muted)]">
                    {data.status === "aprobada"
                      ? "Suba el PDF de aprobación oficial firmado con FNMT para enviarlo al ciudadano."
                      : "Cuando apruebe la solicitud, podrá subir aquí el PDF firmado con FNMT."}
                  </div>
                  <Button size="sm" className="hemsa-btn-primary rounded-full" disabled={signBusy} onClick={() => signInputRef.current?.click()} data-testid="admin-upload-sign-btn">
                    <Upload className="h-4 w-4 mr-1" /> {signBusy ? "Verificando…" : "Subir PDF firmado (FNMT)"}
                  </Button>
                  <input ref={signInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]; e.target.value = "";
                    if (f) uploadSignedApproval(f);
                  }} data-testid="admin-sign-input" />
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title="Historial">
          <div className="space-y-2">
            {(data.historial || []).slice().reverse().map((h, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <History className="h-4 w-4 text-[color:var(--hemsa-muted)] mt-0.5" />
                <div>
                  <div className="text-[color:var(--hemsa-text)] font-medium">{h.event}</div>
                  <div className="text-xs text-[color:var(--hemsa-muted)]">{new Date(h.at).toLocaleString("es-ES")} {h.nota ? `· ${h.nota}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title={<><Paperclip className="h-4 w-4 inline mr-1" /> Documentos acreditativos</>}>
          <Attachments applicationId={data.application_id} />
        </Section>

        <Section title={<><MessageSquare className="h-4 w-4 inline mr-1" /> Alegaciones del ciudadano</>}>
          <AdminAllegations applicationId={data.application_id} />
        </Section>

        <Section title={<><Pencil className="h-4 w-4 inline mr-1" /> Subsanaciones solicitadas</>}>
          <Subsanaciones applicationId={data.application_id} isAdmin={true} original={data} />
        </Section>
      </main>
    </div>
  );
}