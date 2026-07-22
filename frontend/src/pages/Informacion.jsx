import React from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Informacion() {
  return (
    <div className="App min-h-screen flex flex-col bg-[#f5f7f6]">
      <Header variant="public" />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <h1 className="font-heading text-3xl font-bold text-gray-900 mb-2">Información del Registro</h1>
        <p className="text-gray-500 mb-10">Todo lo que necesitas saber sobre el Registro Municipal de Vivienda Protegida de San Fernando.</p>

        {/* Qué es */}
        <section className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <h2 className="font-heading text-xl font-bold text-gray-900 mb-4">¿Qué es el Registro Municipal de Vivienda Protegida?</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            El Registro Municipal de Vivienda Protegida es el instrumento que permite gestionar las solicitudes de vivienda
            protegida en el municipio de San Fernando, conforme a los principios de publicidad, objetividad e igualdad.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Su objetivo es garantizar la transparencia y la igualdad de oportunidades en el acceso a la vivienda protegida,
            estableciendo un sistema de baremación objetivo que ordena a los solicitantes según sus circunstancias personales,
            familiares y económicas.
          </p>
        </section>

        {/* Requisitos */}
        <section id="requisitos" className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <h2 className="font-heading text-xl font-bold text-gray-900 mb-4">Requisitos de inscripción</h2>
          <p className="text-gray-600 mb-5">Para inscribirse es necesario cumplir todos los siguientes requisitos:</p>
          <ul className="space-y-3">
            {[
              "Ser mayor de 18 años o estar emancipado legalmente.",
              "Estar empadronado en el municipio de San Fernando.",
              "No ser titular de una vivienda protegida o libre en todo el territorio nacional.",
              "No superar los límites de ingresos establecidos por la normativa de vivienda protegida de Andalucía.",
              "No haber sido excluido del Registro por causa legal.",
            ].map((req) => (
              <li key={req} className="flex items-start gap-3 text-sm text-gray-700">
                <CheckCircle2 className="h-5 w-5 text-[#00a889] mt-0.5 flex-shrink-0" />
                {req}
              </li>
            ))}
          </ul>
        </section>

        {/* Documentación */}
        <section className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <h2 className="font-heading text-xl font-bold text-gray-900 mb-4">Documentación necesaria</h2>
          <ul className="space-y-3">
            {[
              "DNI, NIE o pasaporte en vigor del solicitante y de todos los miembros de la unidad familiar.",
              "Certificado de empadronamiento (no más de 3 meses de antigüedad).",
              "Última declaración de la renta o certificado de imputaciones de IRPF.",
              "Libro de familia (si procede).",
              "Certificado de discapacidad (si procede).",
              "Documentación acreditativa de situaciones especiales (víctimas de violencia de género, desahuciados, etc.).",
            ].map((doc) => (
              <li key={doc} className="flex items-start gap-3 text-sm text-gray-700">
                <CheckCircle2 className="h-5 w-5 text-[#00a889] mt-0.5 flex-shrink-0" />
                {doc}
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div className="text-center mt-8">
          <Button asChild className="bg-[#00a889] hover:bg-[#009078] text-white rounded px-8 h-11 text-sm font-semibold uppercase">
            <Link to="/registro">Iniciar mi solicitud <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
