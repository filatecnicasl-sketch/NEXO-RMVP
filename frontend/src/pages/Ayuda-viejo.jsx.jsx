import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { HelpCircle, User, ShieldCheck, ChevronDown } from "lucide-react";

/* ─── Contenido de la guía ───────────────────────────────────────── */

const GUIA_CIUDADANO = [
  {
    titulo: "1. Crear tu cuenta",
    contenido: [
      "Pulsa «Acceder» arriba a la derecha y después «Regístrate».",
      "Escribe tu nombre, tu email y una contraseña. Usa un email que consultes: ahí recibirás todos los avisos de tu expediente.",
      "Si olvidas la contraseña, en la pantalla de acceso pulsa «¿Has olvidado tu contraseña?» y sigue las instrucciones del correo.",
      "Importante: cada persona solo puede tener UNA solicitud en el Registro.",
    ],
  },
  {
    titulo: "2. Rellenar la solicitud paso a paso",
    contenido: [
      "Desde «Mi panel», pulsa «Iniciar mi solicitud». El asistente te guía por pantallas: titulares, unidad familiar, ingresos, vivienda a la que optas y circunstancias especiales.",
      "Puedes salir y continuar después: no hace falta terminarla de una vez.",
      "Marca solo las casillas que correspondan (joven, mayor de 65, monoparental, discapacidad…): cada una deberá acreditarse con un documento.",
      "Al enviarla recibirás tu número de registro (RD…/2026) y un resguardo en PDF. Guarda ese número.",
    ],
  },
  {
    titulo: "3. Seguir tu expediente",
    contenido: [
      "Entra con tu cuenta y abre «Mi panel»: verás el estado actualizado de tu solicitud.",
      "Pendiente: recibida y en cola. En revisión: la están comprobando. Subsanación: falta algo (te indican qué aportar). Aprobada: inscripción firme. Denegada: no admitida (con motivo).",
      "Recibirás un email cada vez que el estado cambie.",
      "Recuerda: la inscripción debe actualizarse; las no actualizadas en TRES AÑOS se cancelan de oficio.",
    ],
  },
  {
    titulo: "4. Documentación necesaria",
    contenido: [
      "DNI/NIE/pasaporte en vigor del solicitante y de toda la unidad familiar.",
      "Certificado de empadronamiento (máximo 3 meses de antigüedad).",
      "Última declaración de la renta o certificado de imputaciones de cada miembro con ingresos.",
      "Libro de familia si hay hijos, y certificados de las circunstancias especiales marcadas (discapacidad, violencia de género, desahucio…).",
      "Sube los documentos en PDF o foto legible. Si te falta alguno, envía la solicitud igualmente: te indicarán cómo completarla.",
    ],
  },
  {
    titulo: "5. La calculadora de ingresos",
    contenido: [
      "En la sección «Calculadora», sin necesidad de cuenta, escribe los ingresos anuales y los miembros de la unidad familiar.",
      "Al instante verás un banderín con el resultado: APTO (verde/naranja) o NO APTO (rojo) y para qué régimen.",
      "El resultado es orientativo: la comprobación definitiva la hace el Registro al verificar tu solicitud.",
    ],
  },
  {
    titulo: "6. El asistente de ayuda (chat)",
    contenido: [
      "Abajo a la derecha hay un botón verde redondo: ábrelo y pregúntale con tus palabras, a cualquier hora.",
      "Sus respuestas son orientativas; para asuntos personales, contacta con las oficinas de Hemsa.",
      "También puedes escribirnos desde la sección «Contacto» o acudir presencialmente: Avda. San Juan Bosco 46, 11100 San Fernando.",
    ],
  },
];

const GUIA_ADMIN = [
  {
    titulo: "1. Acceso y niveles",
    contenido: [
      "Entra por «Panel de gestión» (o /admin/login) con tus credenciales de administrador.",
      "Nivel Administración: gestión diaria (solicitudes, OCR, notas, estados). Nivel Gerente: además usuarios y baremo.",
      "Tras 5 intentos fallidos de contraseña, el acceso se bloquea temporalmente por seguridad.",
    ],
  },
  {
    titulo: "2. Bandeja de solicitudes",
    contenido: [
      "Filtra por estado, dormitorios o busca por número, nombre o DNI.",
      "La columna «Origen» indica cómo se dio de alta cada solicitud: Web (el ciudadano mismo) u OCR IA (un administrador desde papel).",
      "Pulsa sobre una solicitud para abrir su ficha completa.",
    ],
  },
  {
    titulo: "3. La ficha de la solicitud",
    contenido: [
      "Muestra todo el expediente, la puntuación orientativa del baremo (solo la ve el personal) y los documentos adjuntos.",
      "Cambiar estado: el ciudadano recibe un email automático. Añade una nota si procede.",
      "Notas internas: anotaciones del equipo que el ciudadano no ve.",
      "También puedes descargar el resguardo PDF y editar la solicitud.",
      "Flujo habitual: Pendiente → En revisión → (Subsanación si falta algo) → Aprobada o Denegada.",
    ],
  },
  {
    titulo: "4. Alta de ciudadanos por OCR",
    contenido: [
      "Escanea el impreso oficial en papel a PDF y súbelo en «Alta OCR».",
      "La IA extrae los datos y te los muestra en un formulario editable: revisa y corrige antes de confirmar.",
      "Al confirmar, el alta se crea al instante con su número de registro.",
      "Si algún DNI no cuadra, el alta queda marcada como «Revisión pendiente» para comprobarla.",
    ],
  },
  {
    titulo: "5. Usuarios y baremo (Gerente)",
    contenido: [
      "Usuarios: promover/revocar administradores, cambiar niveles, restablecer contraseñas y deshabilitar cuentas.",
      "Baremo: consulta y ajusta los criterios de la puntuación orientativa; documenta cada cambio con fecha y motivo.",
    ],
  },
  {
    titulo: "6. Buenas prácticas",
    contenido: [
      "Consulta solo los expedientes que tramites y no exportes datos sin necesidad justificada.",
      "Cada cambio de estado envía un email al ciudadano: redacta las notas con lenguaje apropiado.",
      "Revoca el acceso de cualquier administrador el mismo día que deje de prestar servicio.",
    ],
  },
];

/* ─── Componentes ────────────────────────────────────────────────── */

function Bloque({ titulo, contenido, abierto, onToggle }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-gray-900 hover:bg-gray-50"
      >
        <span>{titulo}</span>
        <ChevronDown className={`h-5 w-5 text-[#00a889] transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <ul className="px-5 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {contenido.map((linea, i) => (
            <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
              <span className="text-[#00a889] font-bold">•</span>
              <span>{linea}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Ayuda() {
  const { user } = useAuth();
  const esAdmin = user?.role === "admin";
  const [vista, setVista] = useState("ciudadano");
  const [abierto, setAbierto] = useState(0);

  const guia = vista === "admin" ? GUIA_ADMIN : GUIA_CIUDADANO;

  return (
    <div className="min-h-screen bg-[#f5f7f6] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <HelpCircle className="h-12 w-12 text-[#00a889] mx-auto mb-3" />
          <h1 className="font-heading text-3xl font-bold text-gray-900">Ayuda y manuales de uso</h1>
          <p className="text-gray-600 mt-2">
            Guía rápida del Registro de Vivienda Protegida de San Fernando.
            Si no encuentras tu duda, usa el <strong>asistente de chat</strong> (botón verde abajo a la derecha)
            o la sección de <Link to="/contacto" className="text-[#00a889] font-semibold hover:underline">Contacto</Link>.
          </p>
        </div>

        {/* Selector de guía */}
        {esAdmin && (
          <div className="flex gap-2 justify-center mb-6">
            <button
              onClick={() => { setVista("ciudadano"); setAbierto(0); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                vista === "ciudadano" ? "bg-[#00a889] text-white" : "bg-white text-gray-700 border border-gray-300"
              }`}
            >
              <User className="h-4 w-4" /> Guía del ciudadano
            </button>
            <button
              onClick={() => { setVista("admin"); setAbierto(0); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                vista === "admin" ? "bg-[#00a889] text-white" : "bg-white text-gray-700 border border-gray-300"
              }`}
            >
              <ShieldCheck className="h-4 w-4" /> Guía del panel de gestión
            </button>
          </div>
        )}

        <div className="space-y-3">
          {guia.map((b, i) => (
            <Bloque
              key={b.titulo}
              titulo={b.titulo}
              contenido={b.contenido}
              abierto={abierto === i}
              onToggle={() => setAbierto(abierto === i ? -1 : i)}
            />
          ))}
        </div>

        <p className="text-center text-xs text-gray-500 mt-8">
          También dispones de los manuales completos en PDF (versión ciudadano y versión administrador)
          en las oficinas de Hemsa.
        </p>
      </div>
    </div>
  );
}