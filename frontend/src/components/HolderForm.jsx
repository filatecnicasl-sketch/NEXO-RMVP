import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SEXO_OPTIONS, TIPO_DOCUMENTO, TIPO_IRPF, GRUPOS_CODIGOS } from "@/constants/options";

export function HolderForm({ data, onChange, prefix }) {
  const set = (k, v) => onChange({ ...data, [k]: v });

  const toggleGroup = (code) => {
    const arr = Array.isArray(data.grupos_acreditacion) ? data.grupos_acreditacion : [];
    set("grupos_acreditacion", arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code]);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Nombre</Label>
          <Input value={data.nombre} onChange={(e) => set("nombre", e.target.value)} data-testid={`${prefix}-nombre`} />
        </div>
        <div>
          <Label>Primer apellido</Label>
          <Input value={data.apellido1} onChange={(e) => set("apellido1", e.target.value)} data-testid={`${prefix}-apellido1`} />
        </div>
        <div>
          <Label>Segundo apellido</Label>
          <Input value={data.apellido2} onChange={(e) => set("apellido2", e.target.value)} data-testid={`${prefix}-apellido2`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Sexo</Label>
          <Select value={data.sexo} onValueChange={(v) => set("sexo", v)}>
            <SelectTrigger data-testid={`${prefix}-sexo`}><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
            <SelectContent>
              {SEXO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo de documento</Label>
          <Select value={data.tipo_documento} onValueChange={(v) => set("tipo_documento", v)}>
            <SelectTrigger data-testid={`${prefix}-tipo-doc`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPO_DOCUMENTO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Nº de documento</Label>
          <Input value={data.numero_documento} onChange={(e) => set("numero_documento", e.target.value)} data-testid={`${prefix}-num-doc`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Nacionalidad</Label>
          <Input value={data.nacionalidad} onChange={(e) => set("nacionalidad", e.target.value)} data-testid={`${prefix}-nacionalidad`} />
        </div>
        <div>
          <Label>Fecha de nacimiento</Label>
          <Input type="date" value={data.fecha_nacimiento} onChange={(e) => set("fecha_nacimiento", e.target.value)} data-testid={`${prefix}-fnac`} />
        </div>
        <div>
          <Label>Empadronado/a en</Label>
          <Input value={data.empadronado_en} onChange={(e) => set("empadronado_en", e.target.value)} data-testid={`${prefix}-empadronado`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Label>Dirección</Label>
          <Input value={data.direccion} onChange={(e) => set("direccion", e.target.value)} data-testid={`${prefix}-direccion`} />
        </div>
        <div>
          <Label>Código postal</Label>
          <Input value={data.codigo_postal} onChange={(e) => set("codigo_postal", e.target.value)} data-testid={`${prefix}-cp`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Teléfono fijo</Label>
          <Input value={data.telefono_fijo} onChange={(e) => set("telefono_fijo", e.target.value)} data-testid={`${prefix}-tfijo`} />
        </div>
        <div>
          <Label>Teléfono móvil</Label>
          <Input value={data.telefono_movil} onChange={(e) => set("telefono_movil", e.target.value)} data-testid={`${prefix}-tmovil`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <Label>Email</Label>
          <Input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} data-testid={`${prefix}-email`} />
        </div>
        <div>
          <Label>Ingresos económicos (€)</Label>
          <Input type="number" min="0" step="0.01" value={data.ingresos_economicos} onChange={(e) => set("ingresos_economicos", parseFloat(e.target.value) || 0)} data-testid={`${prefix}-ingresos`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Declaración IRPF</Label>
            <Select value={data.tipo_declaracion_irpf} onValueChange={(v) => set("tipo_declaracion_irpf", v)}>
              <SelectTrigger data-testid={`${prefix}-irpf`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPO_IRPF.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Año</Label>
            <Input type="number" value={data.anio_ingresos} onChange={(e) => set("anio_ingresos", parseInt(e.target.value) || 0)} data-testid={`${prefix}-anio`} />
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-[color:var(--hemsa-muted)] font-semibold mb-3">Grupos de acreditación (marque los que correspondan)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {GRUPOS_CODIGOS.map((g) => {
            const checked = (data.grupos_acreditacion || []).includes(g.code);
            return (
              <label key={g.code} className="flex items-start gap-2 p-3 rounded-lg border border-[color:var(--hemsa-border)] hover:bg-[color:var(--hemsa-surface)] cursor-pointer transition-colors" data-testid={`${prefix}-grupo-${g.code}`}>
                <Checkbox checked={checked} onCheckedChange={() => {
                  const arr = data.grupos_acreditacion || [];
                  onChange({ ...data, grupos_acreditacion: checked ? arr.filter((c) => c !== g.code) : [...arr, g.code] });
                }} />
                <span className="text-xs leading-snug text-[color:var(--hemsa-text)]"><b>{g.code}</b> · {g.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}