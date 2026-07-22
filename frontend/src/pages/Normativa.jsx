import React from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BookOpen, ExternalLink } from "lucide-react";

export default function Normativa() {
  return (
    <div className="App min-h-screen flex flex-col bg-[#f5f7f6]">
      <Header variant="public" />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <h1 className="font-heading text-3xl font-bold text-gray-900 mb-2">Normativa aplicable</h1>
        <p className="text-gray-500 mb-10">Marco legal que regula el Registro Municipal de Vivienda Protegida.</p>

        <div className="space-y-5">
          {[
            {
              titulo: "Decreto 1/2012, de 10 de enero",
              descripcion: "Reglamento de los Registros Públicos Municipales de Demandantes de Vivienda Protegida de la Comunidad Autónoma de Andalucía.",
              url: "https://www.juntadeandalucia.es",
            },
            {
              titulo: "Ley 1/2010, de 8 de marzo",
              descripcion: "Reguladora del derecho a la vivienda en Andalucía. Establece el marco general para el acceso a la vivienda protegida.",
              url: "https://www.juntadeandalucia.es",
            },
            {
              titulo: "Plan de Vivienda y Rehabilitación de Andalucía 2020-2030",
              descripcion: "Marco estratégico autonómico para las políticas de vivienda protegida en Andalucía.",
              url: "https://www.juntadeandalucia.es",
            },
            {
              titulo: "Real Decreto 42/2022, de 18 de enero",
              descripcion: "Reglamento de los Registros Públicos de demandantes de vivienda protegida. Normativa estatal de referencia.",
              url: "https://www.boe.es",
            },
            {
              titulo: "Reglamento (UE) 2016/679 – RGPD",
              descripcion: "Reglamento General de Protección de Datos. Regula el tratamiento de los datos personales de los solicitantes.",
              url: "https://eur-lex.europa.eu",
            },
            {
              titulo: "Ordenanza Municipal – San Fernando RD 001/2026",
              descripcion: "Ordenanza local que adapta la normativa autonómica al municipio de San Fernando y establece el baremo específico de adjudicación.",
              url: null,
            },
          ].map((norma) => (
            <div key={norma.titulo} className="bg-white rounded-xl shadow-sm p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-[#e8f7f4] flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-5 w-5 text-[#00a889]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{norma.titulo}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{norma.descripcion}</p>
              </div>
              {norma.url && (
                <a
                  href={norma.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00a889] hover:underline flex items-center gap-1 text-sm flex-shrink-0 mt-1"
                >
                  Ver <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
