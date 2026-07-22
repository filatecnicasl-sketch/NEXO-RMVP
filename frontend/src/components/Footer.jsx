import React from "react";
import { LOGO_URL } from "@/constants/options";

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--hemsa-border)] bg-white mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Columna 1: Logo */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <img src={LOGO_URL} alt="Hemsa" className="h-16 w-16 object-contain" />
            <div className="font-heading font-bold text-[15px] text-[color:var(--hemsa-text)] leading-snug">
              Registro de Vivienda Protegida · San Fernando
            </div>
          </div>
          <p className="text-sm text-[color:var(--hemsa-muted)] max-w-xs">
            Registro Público Municipal de Demandantes de Vivienda Protegida del Excmo. Ayuntamiento de San Fernando.
          </p>
        </div>

        {/* Columna 2: Información — centrada */}
        <div className="flex flex-col items-center text-center">
          <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-[color:var(--hemsa-text)] mb-3">Información</h4>
          <ul className="space-y-1 text-sm text-[color:var(--hemsa-muted)]">
            <li>Avda. San Juan Bosco, 46</li>
            <li>11100 San Fernando (Cádiz)</li>
            <li>Teléfono: 956 945 000</li>
            <li>Lun – Vie: 9:00 – 13:30</li>
          </ul>
        </div>

        {/* Columna 3: Accesibilidad */}
        <div>
          <h4 className="font-heading font-semibold text-sm uppercase tracking-wider text-[color:var(--hemsa-text)] mb-3">Accesibilidad</h4>
          <p className="text-sm text-[color:var(--hemsa-muted)]">
            Sitio diseñado conforme a las pautas WCAG 2.1 nivel AA. Si necesita asistencia, llame al 956 945 000.
          </p>
        </div>
      </div>
      <div className="border-t border-[color:var(--hemsa-border)] py-4 text-center text-xs text-[color:var(--hemsa-muted)]">
        © {new Date().getFullYear()} Hemsa — Excmo. Ayuntamiento de San Fernando.
      </div>
    </footer>
  );
}
