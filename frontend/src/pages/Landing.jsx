import React from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { CalendarCheck, FileText, RefreshCw, BookOpen, ArrowRight, ChevronRight } from "lucide-react";
import { LANDING } from "@/constants/testIds";

export default function Landing() {
  return (
    <div className="App min-h-screen flex flex-col bg-[#f5f7f6]">
      <Header variant="public" />

      {/* HERO + SIDEBAR */}
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Hero principal */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-8 sm:p-10" data-testid={LANDING.hero}>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-5">
                Registro Municipal de<br />Vivienda Protegida
              </h1>
              <p className="text-gray-600 text-base leading-relaxed mb-3">
                El Registro Municipal de Vivienda Protegida de San Fernando tiene como objetivo garantizar la
                transparencia y la igualdad de oportunidades en el acceso a la vivienda protegida.
              </p>
              <p className="text-gray-600 text-base mb-8">
                Infórmate, inscríbete y mantén tus datos actualizados.
              </p>

              <div className="flex flex-wrap gap-3 mb-6">
                <Button
                  asChild
                  className="bg-[#00a889] hover:bg-[#009078] text-white rounded px-6 h-11 text-sm font-semibold uppercase tracking-wide"
                  data-testid={LANDING.ctaRegistro}
                >
                  <Link to="/registro">Acceder al Registro</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-[#00a889] text-[#00a889] hover:bg-[#e8f7f4] rounded px-6 h-11 text-sm font-semibold uppercase tracking-wide"
                >
                  <Link to="/informacion">Más información</Link>
                </Button>
              </div>

              <p className="text-sm text-gray-500">
                ¿Ya estás registrado?{" "}
                <Link to="/login" className="text-[#00a889] font-medium hover:underline" data-testid={LANDING.ctaGoogle}>
                  Inicia sesión
                </Link>
              </p>
            </div>

            {/* Sidebar info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-heading font-bold text-gray-900 text-lg mb-4 border-b border-gray-100 pb-3">
                Información importante
              </h2>
              <ul className="space-y-4">
                {[
                  {
                    icon: <CalendarCheck className="h-5 w-5 text-[#00a889] mt-0.5 flex-shrink-0" />,
                    title: "¿Quién puede inscribirse?",
                    text: "Pueden inscribirse las personas físicas que cumplan los requisitos establecidos en la normativa vigente.",
                  },
                  {
                    icon: <FileText className="h-5 w-5 text-[#00a889] mt-0.5 flex-shrink-0" />,
                    title: "Mantén tus datos actualizados",
                    text: "Es responsabilidad de la persona inscrita mantener sus datos actualizados en el Registro.",
                  },
                  {
                    icon: <RefreshCw className="h-5 w-5 text-[#00a889] mt-0.5 flex-shrink-0" />,
                    title: "Plazos y vigencia",
                    text: "La inscripción deberá renovarse cada tres años para mantenerla activa.",
                  },
                  {
                    icon: <BookOpen className="h-5 w-5 text-[#00a889] mt-0.5 flex-shrink-0" />,
                    title: "Normativa aplicable",
                    text: "Consulta la normativa vigente sobre vivienda protegida en Andalucía.",
                  },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-3 border-b border-gray-50 pb-4 last:border-0 last:pb-0">
                    {item.icon}
                    <div>
                      <p className="font-semibold text-gray-800 text-sm mb-0.5">{item.title}</p>
                      <p className="text-gray-500 text-sm leading-snug">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 3 tarjetas informativas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pb-2">
            {[
              {
                title: "¿Qué es el Registro?",
                text: "El Registro Municipal de Vivienda Protegida es el instrumento que permite gestionar las solicitudes de vivienda protegida en el municipio de San Fernando, conforme a los principios de publicidad, objetividad e igualdad.",
                link: "/informacion",
                label: "Saber más",
              },
              {
                title: "Requisitos de inscripción",
                text: "Para inscribirse es necesario cumplir los requisitos establecidos en la normativa vigente en materia de vivienda protegida y presentar la documentación requerida.",
                link: "/informacion#requisitos",
                label: "Ver requisitos",
              },
              {
                title: "Preguntas frecuentes",
                text: "Resuelve las dudas más habituales sobre el proceso de inscripción, requisitos, documentación, renovación y otros aspectos del registro.",
                link: "/faq",
                label: "Ver preguntas frecuentes",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-xl shadow-sm p-6 border-t-4 border-[#00a889] flex flex-col"
              >
                <h3 className="font-heading font-bold text-gray-900 text-lg mb-3">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed flex-1">{card.text}</p>
                <Link
                  to={card.link}
                  className="mt-5 inline-flex items-center gap-1 text-[#00a889] font-semibold text-sm hover:underline uppercase tracking-wide"
                >
                  {card.label} <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
