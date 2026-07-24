import React, { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Calculator, Users, Home, Percent, ChevronDown, ChevronUp, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

/* ─── PARÁMETROS NORMATIVOS (editables si cambian las órdenes) ──────────────
   · IPREM 2026: 600 €/mes → 8.400 €/año (14 pagas)
   · Límites de ingresos: art. 15 Decreto 91/2020 (Plan Vive), modificado por
     Decreto-ley 1/2025 → 3,00 / 5,5 / 7,0 veces IPREM
   · INGRESOS FAMILIARES CORREGIDOS (IFC): Disposición adicional primera del
     Decreto 91/2020 → (ingresos ÷ IPREM) × coef. miembros × 0,90 por cada grupo
     de especial protección distinto; coeficiente final entre 0,70 y 1,00
   · Precio máximo: módulo básico × coeficiente territorial (Decreto-ley 1/2025:
     Grupo 1 = 1,50 · resto = 1,30) × coeficiente de régimen (art. 20: 1,5 / 1,7 / 2)
   · Anejos (garaje/trastero): 60 % del precio de referencia del m²
   · Renta máxima anual: 4,5 % del precio de referencia (5 % si alquiler con opción a compra)
   · Vivienda asequible (Ley 5/2025): coste ≤ 30 % de los ingresos
─────────────────────────────────────────────────────────────────────────── */
const PARAMS_INICIALES = {
  ipremAnual: 8400,
  moduloBasico: 870,
  coefTerritorialG1: 1.5,
  coefTerritorialG2: 1.3,
  coefRE: 1.5,
  coefRG: 1.7,
  coefPL: 2.0,
  anejosPct: 60,
  alquilerPct: 4.5,
  aocPct: 5,
  esfuerzoPct: 30,
  coefMinimo: 0.7,   // el coeficiente final nunca baja de 0,70 (Disp. adic. 1ª D. 91/2020)
};

const REGIMENES = [
  { key: "RE", nombre: "Régimen especial", mult: 3.0, desc: "Viviendas protegidas de régimen especial" },
  { key: "RG", nombre: "Régimen general", mult: 5.5, desc: "Viviendas protegidas de régimen general" },
  { key: "PL", nombre: "Precio limitado", mult: 7.0, desc: "Viviendas de precio limitado" },
];

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt2 = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; };

/* Coeficiente corrector por número de miembros (Disp. adic. 1ª D. 91/2020) */
const coefMiembros = (m) => (m <= 1 ? 1.0 : m === 2 ? 0.9 : m <= 4 ? 0.85 : 0.8);

function Campo({ label, value, onChange, suffix, min = 0, step = "any" }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[color:var(--hemsa-text)]">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number" min={min} step={step} value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00a889]"
        />
        {suffix && <span className="text-sm text-gray-500 whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  );
}

export default function CalculadoraIprem({ variant = "public" }) {
  const [ingresos, setIngresos] = useState("");
  const [miembros, setMiembros] = useState(2);
  const [grupos, setGrupos] = useState(0);
  const [grupo, setGrupo] = useState("g1");
  const [regimen, setRegimen] = useState("RG");
  const [m2Vivienda, setM2Vivienda] = useState(80);
  const [m2Anejos, setM2Anejos] = useState(25);
  const [tin, setTin] = useState(3);
  const [anos, setAnos] = useState(30);
  const [params, setParams] = useState(PARAMS_INICIALES);
  const [verParams, setVerParams] = useState(false);
  const [verHipoteca, setVerHipoteca] = useState(false);

  const r = useMemo(() => {
    const ing = num(ingresos);
    const nMiem = Math.max(1, Math.round(num(miembros)));
    const nGrupos = Math.min(8, Math.max(0, Math.round(num(grupos))));

    /* ── IFC (Disposición adicional primera, Decreto 91/2020) ── */
    const cM = coefMiembros(nMiem);
    const cG = Math.pow(0.9, nGrupos);
    const coefFinal = Math.min(1, Math.max(params.coefMinimo, cM * cG));
    const vecesIprem = params.ipremAnual > 0 ? ing / params.ipremAnual : 0;
    const ifc = vecesIprem * coefFinal;

    const limites = REGIMENES.map((reg) => ({
      ...reg,
      limiteEur: reg.mult * params.ipremAnual,
      cumple: ing > 0 && ifc <= reg.mult,
      margenVeces: reg.mult - ifc,
    }));

    /* ── Vivienda asequible (Ley 5/2025) ── */
    const cuotaMax = (ing / 12) * (params.esfuerzoPct / 100);
    const i = num(tin) / 100 / 12, n = Math.max(1, num(anos) * 12);
    const capital = i > 0 ? cuotaMax * (1 - Math.pow(1 + i, -n)) / i : cuotaMax * n;

    /* ── Precio máximo legal ── */
    const coefT = grupo === "g1" ? params.coefTerritorialG1 : params.coefTerritorialG2;
    const coefR = regimen === "RE" ? params.coefRE : regimen === "RG" ? params.coefRG : params.coefPL;
    const precioM2 = params.moduloBasico * coefT * coefR;
    const precioVivienda = precioM2 * num(m2Vivienda);
    const precioAnejos = precioM2 * (params.anejosPct / 100) * num(m2Anejos);
    const precioTotal = precioVivienda + precioAnejos;
    const rentaMes = (precioTotal * (params.alquilerPct / 100)) / 12;
    const rentaMesAoc = (precioTotal * (params.aocPct / 100)) / 12;

    return { ing, nMiem, nGrupos, cM, cG, coefFinal, vecesIprem, ifc, limites, cuotaMax, capital, precioM2, precioVivienda, precioAnejos, precioTotal, rentaMes, rentaMesAoc };
  }, [ingresos, miembros, grupos, grupo, regimen, m2Vivienda, m2Anejos, tin, anos, params]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header variant={variant} />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-xs uppercase tracking-[0.18em] text-[color:var(--hemsa-green-hover)] font-semibold">Herramienta ciudadana</div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[color:var(--hemsa-text)] mt-1 flex items-center gap-3">
          <Calculator className="h-8 w-8 text-[#00a889]" /> Calculadora IPREM · Vivienda protegida en Andalucía
        </h1>
        <p className="text-gray-600 mt-3 max-w-3xl">
          Comprueba si tus <strong>ingresos familiares corregidos (IFC)</strong> cumplen los límites para acceder
          a una vivienda protegida, qué esfuerzo mensual es asequible y cuál es el precio máximo legal
          de la vivienda según su zona. Resultados <strong>orientativos</strong>: la calificación definitiva
          corresponde al órgano competente.
        </p>

        {/* Datos de entrada */}
        <section className="bg-white rounded-xl shadow-sm p-6 mt-8">
          <h2 className="font-semibold text-lg text-[color:var(--hemsa-text)] flex items-center gap-2">
            <Users className="h-5 w-5 text-[#00a889]" /> Tus datos
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <Campo label="Bases imponibles general + del ahorro (IRPF)" value={ingresos} onChange={setIngresos} suffix="€/año" />
            <Campo label="Miembros de la unidad familiar" value={miembros} onChange={setMiembros} min={1} step={1} suffix="personas" />
            <Campo label="Grupos de especial protección distintos" value={grupos} onChange={setGrupos} min={0} step={1} suffix="grupos" />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Suma las bases imponibles (general + ahorro) de todos los miembros, del último IRPF con plazo vencido,
            aunque alguno no estuviera obligado a declarar. Grupos de especial protección: familia numerosa,
            discapacidad, víctimas de violencia de género o terrorismo, mayores de 65, jóvenes, monoparental…
            (cuenta <strong>grupos distintos</strong>, no personas).
          </p>
        </section>

        {/* 1. IFC y límites */}
        <section className="mt-8">
          <h2 className="font-semibold text-lg text-[color:var(--hemsa-text)] mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#00a889]" /> 1 · Ingresos familiares corregidos y límites
          </h2>

          {r.ing > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
              <div className="grid sm:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-xs text-gray-500">Paso 1 · Veces IPREM</div>
                  <div className="font-bold text-[color:var(--hemsa-text)]">{eur.format(r.ing)} ÷ {eur.format(params.ipremAnual)}</div>
                  <div className="text-lg font-bold text-[#00a889]">{fmt2.format(r.vecesIprem)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Paso 2 · Coef. por {r.nMiem} miembro(s)</div>
                  <div className="text-lg font-bold text-[color:var(--hemsa-text)]">{r.cM.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Paso 3 · Coef. por {r.nGrupos} grupo(s)</div>
                  <div className="text-lg font-bold text-[color:var(--hemsa-text)]">{r.cG.toFixed(2)}</div>
                </div>
                <div className="rounded-lg bg-gray-50 py-2">
                  <div className="text-xs text-gray-500">IFC final</div>
                  <div className="text-2xl font-bold text-[#00a889]">{fmt2.format(r.ifc)} <span className="text-sm font-normal text-gray-500">× IPREM</span></div>
                  <div className="text-xs text-gray-500">coef. aplicado {r.coefFinal.toFixed(2)} (mín. {params.coefMinimo.toFixed(2)})</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4">
            {r.limites.map((l) => (
              <div key={l.key} className={`bg-white rounded-xl shadow-sm p-5 border-t-4 ${r.ing === 0 ? "border-gray-200" : l.cumple ? "border-[#00a889]" : "border-red-400"}`}>
                <div className="font-semibold text-[color:var(--hemsa-text)]">{l.nombre}</div>
                <div className="text-sm text-gray-500">{l.desc}</div>
                <div className="mt-3 text-2xl font-bold text-[color:var(--hemsa-text)]">{eur.format(l.limiteEur)}</div>
                <div className="text-xs text-gray-500">límite {l.mult} × IPREM (corregido)</div>
                {r.ing > 0 && (
                  <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${l.cumple ? "text-[#00a889]" : "text-red-500"}`}>
                    {l.cumple ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {l.cumple
                      ? `Cumples · IFC ${fmt2.format(r.ifc)} ≤ ${l.mult} (margen ${fmt2.format(l.margenVeces)})`
                      : `No cumples · IFC ${fmt2.format(r.ifc)} > ${l.mult} (te pasas ${fmt2.format(-l.margenVeces)})`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 2. Vivienda asequible */}
        {r.ing > 0 && (
          <section className="bg-white rounded-xl shadow-sm p-6 mt-8">
            <h2 className="font-semibold text-lg text-[color:var(--hemsa-text)] flex items-center gap-2">
              <Percent className="h-5 w-5 text-[#00a889]" /> 2 · Vivienda asequible — regla del {params.esfuerzoPct} %
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Ley 5/2025, de Vivienda de Andalucía: el coste de la vivienda no debería superar el {params.esfuerzoPct} % de tus ingresos.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Esfuerzo mensual máximo recomendable</div>
                <div className="text-2xl font-bold text-[color:var(--hemsa-text)]">{eur2.format(r.cuotaMax)}<span className="text-sm font-normal text-gray-500">/mes</span></div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="text-sm text-gray-500">Ingresos mensuales de la unidad familiar</div>
                <div className="text-2xl font-bold text-[color:var(--hemsa-text)]">{eur2.format(r.ing / 12)}<span className="text-sm font-normal text-gray-500">/mes</span></div>
              </div>
            </div>
            <button onClick={() => setVerHipoteca(!verHipoteca)} className="mt-4 flex items-center gap-1 text-sm font-medium text-[#00a889]">
              {verHipoteca ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} Estimar hipoteca orientativa
            </button>
            {verHipoteca && (
              <div className="mt-3 rounded-lg border border-gray-200 p-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <Campo label="Tipo de interés (TIN)" value={tin} onChange={setTin} suffix="%" />
                  <Campo label="Plazo" value={anos} onChange={setAnos} min={1} step={1} suffix="años" />
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-500">Capital orientativo financiable</div>
                    <div className="text-xl font-bold text-[color:var(--hemsa-text)]">{eur.format(r.capital)}</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Cálculo francés con la cuota máxima anterior. No incluye gastos, impuestos ni el porcentaje de financiación del banco.</p>
              </div>
            )}
          </section>
        )}

        {/* 3. Precio máximo legal */}
        <section className="bg-white rounded-xl shadow-sm p-6 mt-8">
          <h2 className="font-semibold text-lg text-[color:var(--hemsa-text)] flex items-center gap-2">
            <Home className="h-5 w-5 text-[#00a889]" /> 3 · Precio máximo legal de la vivienda
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <label className="block">
              <span className="text-sm font-medium text-[color:var(--hemsa-text)]">Zona del municipio</span>
              <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00a889]">
                <option value="g1">Grupo 1 (coef. 1,50)</option>
                <option value="g2">Resto de municipios (coef. 1,30)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[color:var(--hemsa-text)]">Régimen</span>
              <select value={regimen} onChange={(e) => setRegimen(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#00a889]">
                {REGIMENES.map((reg) => <option key={reg.key} value={reg.key}>{reg.nombre}</option>)}
              </select>
            </label>
            <Campo label="Superficie útil vivienda" value={m2Vivienda} onChange={setM2Vivienda} suffix="m²" />
            <Campo label="Anejos (garaje + trastero)" value={m2Anejos} onChange={setM2Anejos} suffix="m²" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            <strong>San Fernando (Cádiz) pertenece al Grupo 1</strong>, junto a Cádiz capital, Jerez, Algeciras, El Puerto, Puerto Real, Rota, Chiclana… (Decreto-ley 1/2025).
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Precio máximo por m² útil</div>
              <div className="text-xl font-bold text-[color:var(--hemsa-text)]">{eur2.format(r.precioM2)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Precio máximo de venta (con anejos)</div>
              <div className="text-xl font-bold text-[color:var(--hemsa-text)]">{eur.format(r.precioTotal)}</div>
              <div className="text-xs text-gray-500">vivienda {eur.format(r.precioVivienda)} + anejos {eur.format(r.precioAnejos)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Renta máxima · alquiler</div>
              <div className="text-xl font-bold text-[color:var(--hemsa-text)]">{eur2.format(r.rentaMes)}<span className="text-sm font-normal text-gray-500">/mes</span></div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="text-sm text-gray-500">Renta máxima · alquiler con opción a compra</div>
              <div className="text-xl font-bold text-[color:var(--hemsa-text)]">{eur2.format(r.rentaMesAoc)}<span className="text-sm font-normal text-gray-500">/mes</span></div>
            </div>
          </div>
        </section>

        {/* Parámetros editables */}
        <section className="bg-white rounded-xl shadow-sm mt-8 overflow-hidden">
          <button onClick={() => setVerParams(!verParams)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50">
            <span className="font-semibold text-[color:var(--hemsa-text)]">Parámetros normativos aplicados</span>
            {verParams ? <ChevronUp className="h-5 w-5 text-[#00a889]" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>
          {verParams && (
            <div className="px-6 pb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Campo label="IPREM anual (€)" value={params.ipremAnual} onChange={(v) => setParams({ ...params, ipremAnual: num(v) })} />
              <Campo label="Coeficiente mínimo IFC" value={params.coefMinimo} onChange={(v) => setParams({ ...params, coefMinimo: num(v) })} />
              <Campo label="Módulo básico (€/m²)" value={params.moduloBasico} onChange={(v) => setParams({ ...params, moduloBasico: num(v) })} />
              <Campo label="Coef. territorial Grupo 1" value={params.coefTerritorialG1} onChange={(v) => setParams({ ...params, coefTerritorialG1: num(v) })} />
              <Campo label="Coef. territorial resto" value={params.coefTerritorialG2} onChange={(v) => setParams({ ...params, coefTerritorialG2: num(v) })} />
              <Campo label="Coef. régimen especial" value={params.coefRE} onChange={(v) => setParams({ ...params, coefRE: num(v) })} />
              <Campo label="Coef. régimen general" value={params.coefRG} onChange={(v) => setParams({ ...params, coefRG: num(v) })} />
              <Campo label="Coef. precio limitado" value={params.coefPL} onChange={(v) => setParams({ ...params, coefPL: num(v) })} />
              <Campo label="Anejos (% del precio)" value={params.anejosPct} onChange={(v) => setParams({ ...params, anejosPct: num(v) })} />
              <Campo label="Renta alquiler (% anual)" value={params.alquilerPct} onChange={(v) => setParams({ ...params, alquilerPct: num(v) })} />
              <Campo label="Renta AOC (% anual)" value={params.aocPct} onChange={(v) => setParams({ ...params, aocPct: num(v) })} />
              <Campo label="Esfuerzo asequible (%)" value={params.esfuerzoPct} onChange={(v) => setParams({ ...params, esfuerzoPct: num(v) })} />
            </div>
          )}
        </section>

        {/* Aviso y fuentes */}
        <section className="mt-8 text-xs text-gray-500 leading-relaxed border-t border-gray-200 pt-4">
          <p><strong>Aviso:</strong> herramienta orientativa sin efectos jurídicos. Los precios máximos se determinan en el momento de la formalización del contrato, y el cumplimiento de requisitos lo verifica el órgano competente del Registro.</p>
          <p className="mt-2"><strong>Fuentes:</strong> IPREM 2026 (600 €/mes · 8.400 €/año) · Decreto 91/2020 (Plan Vive en Andalucía), arts. 15 y 20 y Disposición adicional primera (IFC) · Decreto-ley 1/2025 (coeficientes territoriales y límites de ingresos) · Ley 5/2025, de Vivienda de Andalucía (regla del 30 %).</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}