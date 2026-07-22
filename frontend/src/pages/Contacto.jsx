import React from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export default function Contacto() {
  return (
    <div className="App min-h-screen flex flex-col bg-[#f5f7f6]">
      <Header variant="public" />
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        <h1 className="font-heading text-3xl font-bold text-gray-900 mb-2">Contacto</h1>
        <p className="text-gray-500 mb-10">Información de contacto para atención presencial y telefónica.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="font-heading font-bold text-gray-900 text-xl mb-6">Datos de contacto</h2>
            <ul className="space-y-5">
              <li className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-[#e8f7f4] flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-[#00a889]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 mb-0.5">Dirección</p>
                  <p className="text-gray-500 text-sm">Avda. San Juan Bosco, 46<br />11100 San Fernando (Cádiz), España</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-[#e8f7f4] flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-[#00a889]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 mb-0.5">Teléfono</p>
                  <p className="text-gray-500 text-sm">956 945 000</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-[#e8f7f4] flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-[#00a889]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 mb-0.5">Correo electrónico</p>
                  <p className="text-gray-500 text-sm">vivienda@hemsa.es</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-[#e8f7f4] flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-[#00a889]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 mb-0.5">Horario de atención</p>
                  <p className="text-gray-500 text-sm">Lunes a viernes: 9:00 – 13:30 h</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="font-heading font-bold text-gray-900 text-xl mb-4">Información adicional</h2>
            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <p>
                <strong className="text-gray-800">Atención presencial:</strong> Se recomienda solicitar cita previa llamando al teléfono de atención ciudadana para evitar esperas.
              </p>
              <p>
                <strong className="text-gray-800">Atención telefónica:</strong> Para consultas sobre el estado de su solicitud o dudas sobre el proceso de inscripción.
              </p>
              <p>
                <strong className="text-gray-800">Correo electrónico:</strong> Para consultas no urgentes. El plazo de respuesta es de 5 días hábiles.
              </p>
              <div className="mt-6 p-4 bg-[#e8f7f4] rounded-lg">
                <p className="font-semibold text-[#007a64] mb-1">HEMSA Servicios Públicos Municipales de San Fernando, S.A.</p>
                <p className="text-[#009078] text-xs">Sociedad municipal del Excmo. Ayuntamiento de San Fernando</p>
              </div>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
