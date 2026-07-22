import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { GRUPOS_CODIGOS } from "@/constants/options";
import { Sliders, RotateCcw, Save, RefreshCw, Plus, Trash2 } from "lucide-react";

const FLAG_LABELS = {
  silla_ruedas: "Silla de ruedas",
  movilidad_reducida: "Movilidad reducida",
  precariedad: "Precariedad habitacional",
  necesidad_vivienda_adaptada: "Vivienda adaptada",
  alojamiento_otros_familiares: "Alojamiento c/ familiares",
  vivienda_inadecuada_superficie: "Superficie inadecuada",
  renta_elevada: "Renta elevada",
  nueva_unidad_familiar: "Nueva unidad familiar",
};

export default function AdminBaremo() {
  const [config, setConfig] = useState(null);
  const [isDefault, setIsDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const load = async () => {
    const r = await api.get("/admin/baremo-config");
    setConfig(r.data.config);
    setIsDefault(r.data.is_default);
  };

  useEffect(() => { load().catch(() => toast.error("No se pudo cargar la configuración")); }, []);

  if (!config) {
    return (
      <div className="App"><Header variant="admin" /><main className="max-w-5xl mx-auto px-6 py-16 text-[color:var(--hemsa-muted)]">Cargando…</main></div>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/admin/baremo-config", config);
      toast.success("Configuración guardada");
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo guardar"); }
    setBusy(false);
  };

  const reset = async () => {
    if (!window.confirm("¿Restablecer a valores por defecto?")) return;
    setBusy(true);
    try {
      const r = await api.post("/admin/baremo-config/reset");
      setConfig(r.data.config);
      setIsDefault(true);
      toast.success("Restablecido a valores por defecto");
    } catch { toast.error("No se pudo restablecer"); }
    setBusy(false);
  };

  const recomputeAll = async () => {
    if (!window.confirm("Recalcular el baremo de TODAS las solicitudes con la configuración actual?")) return;
    setRecomputing(true);
    try {
      const r = await api.post("/admin/baremo/recompute-all");
      toast.success(`Recalculadas ${r.data.updated} solicitudes`);
    } catch { toast.error("No se pudo recalcular"); }
    setRecomputing(false);
  };

  const setCasilla = (code, val) => setConfig({ ...config, casillas: { ...config.casillas, [code]: parseInt(val) || 0 } });
  const setFlag = (key, val) => setConfig({ ...config, vivienda_flags: { ...config.vivienda_flags, [key]: parseInt(val) || 0 } });
  const setBracket = (i, field, val) => {
    const list = [...config.income_brackets];
    list[i] = { ...list[i], [field]: field === "label" ? val : (parseInt(val) || 0) };
    setConfig({ ...config, income_brackets: list });
  };
  const addBracket = () => setConfig({ ...config, income_brackets: [...config.income_brackets, { max: 0, points: 0, label: "Nuevo tramo" }] });
  const removeBracket = (i) => setConfig({ ...config, income_brackets: config.income_brackets.filter((_, idx) => idx !== i) });

  return (
    <div className="App">
      <Header variant="admin" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 page-enter">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--hemsa-green-hover)] font-semibold">Configuración</div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[color:var(--hemsa-text)] mt-1 flex items-center gap-3">
              <Sliders className="h-7 w-7 text-[color:var(--hemsa-green)]" /> Baremo
            </h1>
            <p className="mt-2 text-sm text-[color:var(--hemsa-muted)] max-w-2xl">
              Configure los pesos del baremo según las prioridades de Hemsa. Los cambios afectan a nuevas solicitudes y a las existentes si pulsa "Recalcular todas".
              {isDefault && <span className="ml-1 text-[color:var(--hemsa-green-hover)] font-semibold">(Valores por defecto)</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} variant="outline" className="rounded-full" disabled={busy} data-testid="baremo-reset-btn">
              <RotateCcw className="h-4 w-4 mr-1" /> Restablecer
            </Button>
            <Button onClick={recomputeAll} variant="outline" className="rounded-full" disabled={recomputing} data-testid="baremo-recompute-all-btn">
              <RefreshCw className="h-4 w-4 mr-1" /> {recomputing ? "Recalculando…" : "Recalcular todas"}
            </Button>
            <Button onClick={save} className="hemsa-btn-primary rounded-full" disabled={busy} data-testid="baremo-save-btn">
              <Save className="h-4 w-4 mr-1" /> {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>

        <Card className="p-6 border-[color:var(--hemsa-border)] mb-6">
          <div className="text-sm font-semibold text-[color:var(--hemsa-text)] mb-4">Casillas de justificación (códigos RD001/2026)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GRUPOS_CODIGOS.map((g) => (
              <div key={g.code} className="p-3 rounded-lg border border-[color:var(--hemsa-border)]">
                <div className="text-xs text-[color:var(--hemsa-muted)]"><b className="text-[color:var(--hemsa-text)]">{g.code}</b> · {g.label}</div>
                <Input type="number" className="mt-2 h-9" value={config.casillas[g.code] ?? 0} onChange={(e) => setCasilla(g.code, e.target.value)} data-testid={`baremo-casilla-${g.code}`} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 border-[color:var(--hemsa-border)] mb-6">
          <div className="text-sm font-semibold text-[color:var(--hemsa-text)] mb-4">Flags de vivienda / situación</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.keys(FLAG_LABELS).map((k) => (
              <div key={k} className="p-3 rounded-lg border border-[color:var(--hemsa-border)]">
                <Label className="text-xs">{FLAG_LABELS[k]}</Label>
                <Input type="number" className="mt-1 h-9" value={config.vivienda_flags[k] ?? 0} onChange={(e) => setFlag(k, e.target.value)} data-testid={`baremo-flag-${k}`} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 border-[color:var(--hemsa-border)] mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-[color:var(--hemsa-text)]">Tramos de ingresos del Titular 1</div>
            <Button size="sm" variant="outline" onClick={addBracket} className="rounded-full" data-testid="baremo-add-bracket-btn">
              <Plus className="h-4 w-4 mr-1" /> Añadir tramo
            </Button>
          </div>
          <div className="space-y-3">
            {config.income_brackets.map((b, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 rounded-lg border border-[color:var(--hemsa-border)]">
                <div className="md:col-span-3"><Label className="text-xs">Ingresos máx (€)</Label>
                  <Input type="number" value={b.max} onChange={(e) => setBracket(i, "max", e.target.value)} data-testid={`baremo-bracket-max-${i}`} />
                </div>
                <div className="md:col-span-2"><Label className="text-xs">Puntos</Label>
                  <Input type="number" value={b.points} onChange={(e) => setBracket(i, "points", e.target.value)} data-testid={`baremo-bracket-points-${i}`} />
                </div>
                <div className="md:col-span-6"><Label className="text-xs">Etiqueta visible</Label>
                  <Input value={b.label || ""} onChange={(e) => setBracket(i, "label", e.target.value)} />
                </div>
                <div className="md:col-span-1">
                  <Button size="sm" variant="ghost" onClick={() => removeBracket(i)} className="text-[color:var(--hemsa-error)]" data-testid={`baremo-bracket-remove-${i}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 border-[color:var(--hemsa-border)]">
          <div className="text-sm font-semibold text-[color:var(--hemsa-text)] mb-4">Miembros unidad familiar</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Puntos por miembro adicional</Label>
              <Input type="number" value={config.miembros_per_person} onChange={(e) => setConfig({ ...config, miembros_per_person: parseInt(e.target.value) || 0 })} data-testid="baremo-miembros-per" />
            </div>
            <div>
              <Label>Bonus máximo por miembros</Label>
              <Input type="number" value={config.miembros_max_bonus} onChange={(e) => setConfig({ ...config, miembros_max_bonus: parseInt(e.target.value) || 0 })} data-testid="baremo-miembros-max" />
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
