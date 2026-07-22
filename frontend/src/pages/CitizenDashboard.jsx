import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Attachments } from "@/components/Attachments";
import { CitizenSignatureCard } from "@/components/CitizenSignatureCard";
import { CitizenAllegations } from "@/components/CitizenAllegations";
import { Subsanaciones } from "@/components/Subsanaciones";
import { PendingChangesPanel } from "@/components/PendingChangesPanel";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_LABEL } from "@/constants/options";
import { CITIZEN } from "@/constants/testIds";
import { FileText, FilePlus2, Clock, CheckCircle2, XCircle, Loader2, Home as HomeIcon, Download, Paperclip, Award, ShieldCheck, Pencil } from "lucide-react";

function StatusPill({ status }) {
  return (
    <span className={`status-pill status-${status}`} data-testid={CITIZEN.applicationStatus}>
      {status === "pendiente" && <Clock className="h-3 w-3" />}
      {status === "en_revision" && <Loader2 className="h-3 w-3" />}
      {status === "aprobada" && <CheckCircle2 className="h-3 w-3" />}
      {status === "denegada" && <XCircle className="h-3 w-3" />}
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function CitizenDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);

  const reload = () => {
    api.get("/applications/me")
      .then((r) => setApplication(r.data))
      .catch((e) => { if (e?.response?.status !== 404) toast.error("Error cargando su solicitud"); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let mounted = true;
    api.get("/applications/me")
      .then((r) => { if (mounted) setApplication(r.data); })
      .catch((e) => { if (e?.response?.status !== 404) toast.error("Error cargando su solicitud"); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="App">
      <Header variant="citizen" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 page-enter" data-testid={CITIZEN.dashboard}>
        <div className="mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--hemsa-green-hover)] font-semibold">Hola, {user?.name?.split(" ")[0] || "ciudadano/a"}</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[color:var(--hemsa-text)] mt-2">Mi solicitud de vivienda protegida</h1>
        </div>

        {loading && <Card className="p-8 border-[color:var(--hemsa-border)]">Cargando…</Card>}

        {!loading && application && <PendingChangesPanel />}

        {!loading && !application && (
          <Card className="p-10 border-[color:var(--hemsa-border)] text-center">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-[color:var(--hemsa-green-soft)] flex items-center justify-center text-[color:var(--hemsa-green-hover)]">
              <FilePlus2 className="h-6 w-6" />
            </div>
            <h2 className="font-heading text-2xl font-bold text-[color:var(--hemsa-text)] mt-5">Aún no ha presentado una solicitud</h2>
            <p className="mt-2 text-[color:var(--hemsa-muted)] max-w-md mx-auto">
              Inscríbase ahora completando el formulario oficial. Solo tardará unos minutos.
            </p>
            <Button onClick={() => navigate("/solicitud/nueva")} className="hemsa-btn-primary mt-6 rounded-full px-7 h-11" data-testid={CITIZEN.newApplicationBtn}>
              Iniciar mi solicitud
            </Button>
          </Card>
        )}

        {!loading && application && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-7 border-[color:var(--hemsa-border)] lg:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">Número de registro</div>
                  <div className="font-heading text-3xl font-extrabold text-[color:var(--hemsa-text)] mt-1" data-testid={CITIZEN.applicationNumber}>
                    {application.numero_registro}
                  </div>
                </div>
                <StatusPill status={application.status} />
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">Titular 1</div>
                  <div className="font-medium text-[color:var(--hemsa-text)]">
                    {application.titular1?.nombre} {application.titular1?.apellido1} {application.titular1?.apellido2}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">Documento</div>
                  <div className="font-medium text-[color:var(--hemsa-text)]">{application.titular1?.tipo_documento} · {application.titular1?.numero_documento || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">Email contacto</div>
                  <div className="font-medium text-[color:var(--hemsa-text)]">{application.titular1?.email || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">Régimen solicitado</div>
                  <div className="font-medium text-[color:var(--hemsa-text)]">{(application.vivienda?.regimen || []).join(", ") || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">Dormitorios</div>
                  <div className="font-medium text-[color:var(--hemsa-text)]">{(application.vivienda?.dormitorios || []).join(", ") || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">Miembros unidad familiar</div>
                  <div className="font-medium text-[color:var(--hemsa-text)]">{1 + (application.titular2 ? 1 : 0) + (application.otros_miembros?.length || 0)}</div>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                {application.status === "pendiente" ? (
                  <Button asChild className="hemsa-btn-primary rounded-full" data-testid="citizen-edit-btn">
                    <Link to="/solicitud/editar">
                      <Pencil className="h-4 w-4 mr-1" /> Modificar mi solicitud
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="rounded-full" data-testid="citizen-subsanacion-btn">
                    <Link to="/solicitud/subsanacion">
                      <Pencil className="h-4 w-4 mr-1" /> Solicitar subsanación
                    </Link>
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    try {
                      const r = await api.get("/applications/me/pdf", { responseType: "blob" });
                      const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
                      const a = document.createElement("a");
                      a.href = url; a.download = `resguardo_${application.numero_registro}.pdf`;
                      document.body.appendChild(a); a.click(); a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch {
                      toast.error("No se pudo descargar el resguardo");
                    }
                  }}
                  className="hemsa-btn-primary rounded-full"
                  data-testid={CITIZEN.downloadPdfBtn}
                >
                  <Download className="h-4 w-4 mr-1" /> Descargar resguardo PDF
                </Button>
                <Button
                  onClick={async () => {
                    const tId = toast.loading("Preparando su exportación de datos…");
                    try {
                      const r = await api.get("/applications/me/export", { responseType: "blob" });
                      const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/zip" }));
                      const a = document.createElement("a");
                      a.href = url; a.download = `hemsa_export_${application.numero_registro}.zip`;
                      document.body.appendChild(a); a.click(); a.remove();
                      window.URL.revokeObjectURL(url);
                      toast.success("Exportación lista", { id: tId, description: "Sus datos personales (RGPD Art. 20) se han descargado en un ZIP." });
                    } catch {
                      toast.error("No se pudo generar la exportación", { id: tId });
                    }
                  }}
                  variant="outline"
                  className="rounded-full border-[color:var(--hemsa-border)]"
                  data-testid="citizen-export-data-btn"
                  title="Derecho de portabilidad de datos personales (RGPD Art. 20)"
                >
                  <Download className="h-4 w-4 mr-1" /> Exportar mis datos (RGPD)
                </Button>
                <Button asChild variant="ghost" className="rounded-full text-[color:var(--hemsa-muted)]">
                  <Link to="/">Volver al inicio</Link>
                </Button>
              </div>

              {application.score !== undefined && application.score !== null && (
                <div className="mt-7 pt-6 border-t border-[color:var(--hemsa-border)]">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-[color:var(--hemsa-green-soft)] flex items-center justify-center text-[color:var(--hemsa-green-hover)]">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold">Baremo orientativo</div>
                      <div className="font-heading text-2xl font-bold text-[color:var(--hemsa-text)]" data-testid="citizen-score">{application.score} pts</div>
                    </div>
                  </div>
                  <p className="text-xs text-[color:var(--hemsa-muted)] mt-2 leading-relaxed">
                    Esta puntuación es orientativa según la información declarada. La adjudicación final dependerá de la verificación documental y de los criterios oficiales de Hemsa.
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-7 border-[color:var(--hemsa-border)]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)]">
                <FileText className="h-4 w-4" /> Estado del expediente
              </div>
              <div className="mt-3 space-y-3">
                {(application.historial || []).slice().reverse().map((h, i) => (
                  <div key={i} className="text-sm">
                    <div className="font-medium text-[color:var(--hemsa-text)]">{h.event}</div>
                    <div className="text-xs text-[color:var(--hemsa-muted)]">{new Date(h.at).toLocaleString("es-ES")}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-[color:var(--hemsa-border)]">
                <div className="flex items-center gap-2 text-sm text-[color:var(--hemsa-text)]">
                  <HomeIcon className="h-4 w-4 text-[color:var(--hemsa-green)]" />
                  <span>Gracias por confiar en Hemsa</span>
                </div>
                <p className="text-xs text-[color:var(--hemsa-muted)] mt-2 leading-relaxed">
                  Recibirá actualizaciones por email cuando cambie el estado de su solicitud o se publique una nueva adjudicación.
                </p>
              </div>
            </Card>
          </div>
        )}

        {!loading && application && (
          <div className="mt-6">
            <CitizenSignatureCard application={application} onChange={reload} />
          </div>
        )}

        {!loading && application?.status === "aprobada" && application?.firma_admin?.firmado && (
          <Card className="p-6 border-[color:var(--hemsa-border)] mt-6 bg-[color:var(--hemsa-green-soft)]" data-testid="approved-signed-card">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-white text-[color:var(--hemsa-green-hover)] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-green-hover)] font-semibold">Aprobación oficial</div>
                <div className="font-heading text-xl font-bold text-[color:var(--hemsa-text)] mt-1">Su solicitud ha sido aprobada</div>
                <p className="text-sm text-[color:var(--hemsa-text)] mt-2">
                  El documento oficial ha sido firmado digitalmente {application.firma_admin.fnmt ? "con certificado FNMT" : "por la administración"}
                  {application.firma_admin.signers?.[0]?.cn ? ` por ${application.firma_admin.signers[0].cn}` : ""}.
                </p>
                <Button onClick={async () => {
                  try {
                    const r = await api.get(`/applications/${application.application_id}/signed-approval`, { responseType: "blob" });
                    const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
                    const a = document.createElement("a"); a.href = url; a.download = `aprobacion_${application.numero_registro}.pdf`;
                    document.body.appendChild(a); a.click(); a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch { toast.error("No se pudo descargar"); }
                }} className="hemsa-btn-primary rounded-full mt-3" data-testid="download-signed-approval-btn">
                  <Download className="h-4 w-4 mr-1" /> Descargar documento firmado
                </Button>
              </div>
            </div>
          </Card>
        )}

        {!loading && application && (
          <Card className="p-7 border-[color:var(--hemsa-border)] mt-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-4">
              <Paperclip className="h-4 w-4" /> Documentos acreditativos
            </div>
            <Attachments applicationId={application.application_id} />
          </Card>
        )}

        {!loading && application && (
          <div className="mt-6">
            <CitizenAllegations applicationId={application.application_id} status={application.status} />
          </div>
        )}

        {!loading && application && (
          <Card className="p-6 border-[color:var(--hemsa-border)] mt-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-3">
              <Pencil className="h-4 w-4" /> Mis subsanaciones
            </div>
            <p className="text-sm text-[color:var(--hemsa-muted)] mb-4">
              Aquí ve el estado de los cambios que ha solicitado a su expediente. Los cambios solo se aplican si Hemsa los aprueba.
            </p>
            <Subsanaciones applicationId={application.application_id} isAdmin={false} />
          </Card>
        )}
      </main>
    </div>
  );
}
