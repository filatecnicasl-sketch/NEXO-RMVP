import React, { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChevronDown, ChevronUp } from "lucide-react";

const FAQS = [
  {
    pregunta: "¿Quién puede inscribirse en el Registro?",
    respuesta: "Pueden inscribirse las personas físicas mayores de 18 años, empadronadas en San Fernando, que no sean propietarias de vivienda en España y cuyos ingresos no superen los límites establecidos en la normativa de vivienda protegida de Andalucía.",
  },
  {
    pregunta: "¿Cuánto cuesta inscribirse?",
    respuesta: "La inscripción en el Registro es completamente gratuita.",
  },
  {
    pregunta: "¿Cuánto tarda en tramitarse la inscripción?",
    respuesta: "Una vez presentada la documentación completa, la inscripción se tramita en un plazo máximo de 3 meses. Recibirá una notificación con el resultado.",
  },
  {
    pregunta: "¿Cada cuánto tiempo hay que renovar la inscripción?",
    respuesta: "La inscripción tiene una vigencia de 3 años. Antes de que venza, recibirá un aviso para que la renueve si sigue necesitando vivienda protegida.",
  },
  {
    pregunta: "¿Qué ocurre si cambian mis circunstancias?",
    respuesta: "Está obligado a comunicar cualquier cambio relevante (cambio de ingresos, nuevos miembros de la unidad familiar, adquisición de vivienda, etc.) en el plazo de 3 meses desde que se produzca el cambio.",
  },
  {
    pregunta: "¿Cómo se determina el orden de adjudicación?",
    respuesta: "El orden de adjudicación se establece mediante un baremo objetivo que valora las circunstancias personales, familiares, económicas y sociales de los solicitantes. A mayor puntuación en el baremo, mayor prioridad en la adjudicación.",
  },
  {
    pregunta: "¿Puedo estar inscrito en más de un municipio?",
    respuesta: "Sí, puede inscribirse en los registros de todos los municipios de Andalucía donde cumpla los requisitos. Sin embargo, si acepta una vivienda en un municipio, deberá causar baja en todos los demás registros.",
  },
  {
    pregunta: "¿Qué tipos de vivienda protegida puedo solicitar?",
    respuesta: "Puede solicitar vivienda protegida en régimen de compra, alquiler, o alquiler con opción a compra. También puede indicar sus preferencias respecto al número de dormitorios y si necesita adaptaciones para movilidad reducida.",
  },
  {
    pregunta: "¿Puedo subir una solicitud en papel en PDF?",
    respuesta: "Sí. Si ya dispone de una solicitud en papel con número de registro previo, puede subirla en formato PDF y el sistema la procesará automáticamente mediante reconocimiento de texto (OCR).",
  },
  {
    pregunta: "¿Mis datos están protegidos?",
    respuesta: "Sí. El tratamiento de sus datos personales se realiza conforme al Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica 3/2018. Solo se utilizarán para la gestión del Registro Municipal.",
  },
];

function FaqItem({ pregunta, respuesta }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 pr-4">{pregunta}</span>
        {open ? <ChevronUp className="h-5 w-5 text-[#00a889] flex-shrink-0" /> : <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
          {respuesta}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="App min-h-screen flex flex-col bg-[#f5f7f6]">
      <Header variant="public" />
      <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-heading text-3xl font-bold text-gray-900 mb-2">Preguntas frecuentes</h1>
        <p className="text-gray-500 mb-10">Resuelve las dudas más habituales sobre el Registro Municipal de Vivienda Protegida.</p>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <FaqItem key={faq.pregunta} pregunta={faq.pregunta} respuesta={faq.respuesta} />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
