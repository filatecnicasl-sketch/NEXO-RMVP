import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const SUGERENCIAS = [
  "¿Qué requisitos necesito para inscribirme?",
  "¿Qué documentación tengo que llevar?",
  "¿Cómo sigo el estado de mi solicitud?",
];

const SALUDO = {
  rol: "asistente",
  texto:
    "¡Hola! Soy el asistente del Registro de Vivienda Protegida de San Fernando. " +
    "Puedo resolver tus dudas sobre requisitos, documentación y cómo inscribirte. " +
    "Mis respuestas son orientativas; para asuntos personales, contacta con las oficinas de Hemsa.",
};

export function AyudaChat() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([SALUDO]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const finRef = useRef(null);

  useEffect(() => {
    if (abierto && finRef.current) {
      finRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajes, abierto]);

  const enviar = async (texto) => {
    const limpio = (texto || "").trim();
    if (!limpio || cargando) return;
    const nuevos = [...mensajes, { rol: "usuario", texto: limpio }];
    setMensajes(nuevos);
    setEntrada("");
    setCargando(true);
    try {
      const historial = nuevos.slice(-7, -1).map((m) => ({ rol: m.rol, texto: m.texto }));
      const { data } = await api.post("/ayuda/chat", { mensaje: limpio, historial }, { timeout: 45000 });
      setMensajes([...nuevos, { rol: "asistente", texto: data.respuesta }]);
    } catch (err) {
      const detalle = err?.response?.data?.detail;
      setMensajes([
        ...nuevos,
        {
          rol: "asistente",
          texto: detalle
            ? `Lo siento, no puedo responder ahora: ${detalle}`
            : "Lo siento, no puedo responder ahora mismo. Inténtalo de nuevo en unos minutos o contacta con las oficinas de Hemsa.",
        },
      ]);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-[#00a889] hover:bg-[#009078] text-white shadow-lg flex items-center justify-center transition-colors"
          aria-label="Abrir asistente de ayuda"
          title="¿Dudas? Pregunta al asistente"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Panel de chat */}
      {abierto && (
        <div className="fixed z-50 bottom-0 right-0 sm:bottom-5 sm:right-5 w-full sm:w-96 h-[80vh] sm:h-[540px] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Cabecera */}
          <div className="bg-[#00a889] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <div className="font-semibold text-sm">Asistente de ayuda</div>
              <div className="text-xs opacity-80">Registro de Vivienda Protegida · respuestas orientativas</div>
            </div>
            <button onClick={() => setAbierto(false)} className="p-1 hover:bg-white/20 rounded" aria-label="Cerrar chat">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-[#f5f7f6]">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.rol === "usuario" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.rol === "usuario"
                      ? "bg-[#00a889] text-white rounded-br-sm"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                  }`}
                >
                  {m.texto}
                </div>
              </div>
            ))}
            {cargando && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#00a889]" />
                </div>
              </div>
            )}
            <div ref={finRef} />
          </div>

          {/* Sugerencias (solo al principio) */}
          {mensajes.length === 1 && !cargando && (
            <div className="px-3 pb-2 flex flex-wrap gap-2 bg-[#f5f7f6]">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="text-xs bg-white border border-[#00a889] text-[#00a889] rounded-full px-3 py-1 hover:bg-[#e6f7f3] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Entrada */}
          <div className="border-t border-gray-200 p-2 flex items-center gap-2 flex-shrink-0 bg-white">
            <input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar(entrada)}
              placeholder="Escribe tu duda…"
              maxLength={800}
              className="flex-1 text-sm px-3 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-[#00a889]"
            />
            <button
              onClick={() => enviar(entrada)}
              disabled={cargando || !entrada.trim()}
              className="h-9 w-9 rounded-full bg-[#00a889] hover:bg-[#009078] disabled:opacity-40 text-white flex items-center justify-center transition-colors"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}