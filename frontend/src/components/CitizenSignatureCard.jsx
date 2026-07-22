import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { Download, Upload, FileSignature, ShieldCheck, AlertCircle } from "lucide-react";

export function CitizenSignatureCard({ application, onChange }) {
  const firma = application?.firma_ciudadano;
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const downloadDraft = async () => {
    try {
      const r = await api.get("/applications/me/pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `declaracion_jurada_${application.numero_registro}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("No se pudo descargar el PDF"); }
  };

  const uploadSigned = async (file) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/applications/me/sign-citizen", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
      if (r.data.firma?.fnmt && r.data.firma?.chain_validated) toast.success("Firma FNMT verificada criptográficamente");
      else if (r.data.firma?.fnmt) toast.warning("Firmante FNMT detectado pero la cadena CA no validó (verifique vigencia del certificado)");
      else toast.warning("PDF firmado, pero el emisor no es FNMT-RCM");
      onChange && onChange();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "PDF sin firma válida");
    } finally { setBusy(false); }
  };

  const acceptManual = async () => {
    setBusy(true);
    try {
      await api.post("/applications/me/sign-citizen-manual");
      toast.success("Declaración jurada aceptada");
      onChange && onChange();
    } catch { toast.error("No se pudo registrar la declaración"); }
    finally { setBusy(false); }
  };

  if (firma?.firmado) {
    const isFnmtValid = firma.fnmt && firma.chain_validated;
    return (
      <Card className="p-5 border-[color:var(--hemsa-border)] bg-[color:var(--hemsa-green-soft)]" data-testid="citizen-signature-card-signed">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-white text-[color:var(--hemsa-green-hover)] flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-heading font-semibold text-[color:var(--hemsa-text)]">
              {isFnmtValid
                ? "Declaración jurada firmada con certificado FNMT verificado"
                : firma.fnmt
                  ? "Declaración firmada con certificado FNMT (no se pudo validar la cadena CA)"
                  : firma.tipo === "manual"
                    ? "Declaración jurada aceptada manualmente"
                    : "Declaración firmada digitalmente (emisor no FNMT)"}
            </div>
            <div className="text-xs text-[color:var(--hemsa-muted)] mt-1">
              {firma.firmado_at && <>El {new Date(firma.firmado_at).toLocaleString("es-ES")} · </>}
              {firma.signers?.[0]?.cn && <>Firmante: <b>{firma.signers[0].cn}</b>{firma.signers[0].dni ? ` (${firma.signers[0].dni})` : ""}</>}
            </div>
            {isFnmtValid && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-white text-[color:var(--hemsa-green-hover)] px-2 py-1 rounded-full">
                <ShieldCheck className="h-3 w-3" /> Validación criptográfica FNMT-RCM
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-[color:var(--hemsa-border)] border-l-4 border-l-[color:var(--hemsa-warning,#F59E0B)]" data-testid="citizen-signature-card">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div>
          <div className="font-heading font-semibold text-lg text-[color:var(--hemsa-text)]">Pendiente: declaración jurada</div>
          <p className="text-sm text-[color:var(--hemsa-muted)] mt-1">
            Para que su solicitud sea revisada, debe firmar la declaración jurada confirmando que los datos aportados son veraces. Tiene dos opciones:
          </p>
        </div>
      </div>

      <div className="space-y-4 pl-1">
        <div className="p-4 rounded-lg border border-[color:var(--hemsa-border)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[color:var(--hemsa-green-soft)] text-[color:var(--hemsa-green-hover)] px-2 py-1 rounded">Recomendado</span>
            <div className="font-semibold text-sm text-[color:var(--hemsa-text)]">Firmar con certificado FNMT (AutoFirma)</div>
          </div>
          <p className="text-xs text-[color:var(--hemsa-muted)] mb-3 leading-relaxed">
            1. Descargue su solicitud en PDF. 2. Fírmela con <a href="https://firmaelectronica.gob.es/Home/Descargas.html" target="_blank" rel="noopener noreferrer" className="text-[color:var(--hemsa-green-hover)] underline">AutoFirma</a> usando su certificado FNMT. 3. Suba el PDF firmado aquí.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadDraft} variant="outline" size="sm" className="rounded-full" data-testid="download-declaracion-btn">
              <Download className="h-4 w-4 mr-1" /> Descargar PDF a firmar
            </Button>
            <Button onClick={() => inputRef.current?.click()} disabled={busy} size="sm" className="hemsa-btn-primary rounded-full" data-testid="upload-fnmt-btn">
              <Upload className="h-4 w-4 mr-1" /> {busy ? "Verificando…" : "Subir PDF firmado"}
            </Button>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; e.target.value = "";
              if (f) uploadSigned(f);
            }} data-testid="fnmt-input" />
          </div>
        </div>

        <div className="p-4 rounded-lg border border-dashed border-[color:var(--hemsa-border)]">
          <div className="font-semibold text-sm text-[color:var(--hemsa-text)] mb-2 flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Aceptar declaración jurada manualmente
          </div>
          <p className="text-xs text-[color:var(--hemsa-muted)] mb-3 leading-relaxed">
            Si no dispone de certificado FNMT, puede aceptar la declaración jurada manualmente. La administración podrá requerir verificación presencial.
          </p>
          <label className="flex items-start gap-2 mb-3 cursor-pointer" data-testid="accept-jurada-check">
            <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(Boolean(v))} />
            <span className="text-xs text-[color:var(--hemsa-text)]">
              Declaro bajo juramento que todos los datos aportados son ciertos, asumiendo las responsabilidades legales que pudieran derivarse de su falsedad u omisión, conforme al art. 69 de la Ley 39/2015 del Procedimiento Administrativo Común.
            </span>
          </label>
          <Button onClick={acceptManual} disabled={!accepted || busy} variant="outline" size="sm" className="rounded-full" data-testid="accept-jurada-btn">
            Aceptar declaración jurada
          </Button>
        </div>
      </div>
    </Card>
  );
}
