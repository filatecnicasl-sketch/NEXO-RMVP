"""Asistente de ayuda web: responde dudas del Registro de Vivienda Protegida
usando Gemini, con el conocimiento del registro incluido en el prompt.

Endpoint PÚBLICO (sin login) pensado para el widget de chat de la web.
Incluye un límite sencillo por IP para evitar abusos.
"""
import os
import time
from collections import defaultdict
from typing import List

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(tags=["ayuda"])

# ─── Límite de uso por IP (endpoint público) ────────────────────────
_intentos = defaultdict(list)
MAX_PREGUNTAS = 15
VENTANA_SEG = 600  # 10 minutos

CONOCIMIENTO_REGISTRO = """
CONOCIMIENTO DEL REGISTRO (úsalo para responder; no inventes más allá de esto):

QUÉ ES: El Registro Público Municipal de Demandantes de Vivienda Protegida de San
Fernando (Cádiz) es el instrumento para gestionar las solicitudes de vivienda
protegida en el municipio, con publicidad, objetividad e igualdad. Ordena a los
solicitantes mediante una baremación objetiva según circunstancias personales,
familiares y económicas. Lo gestiona Hemsa (Hub Empresa Municipal de San Fernando
MP, S.A.), con oficinas en Avda. San Juan Bosco 46, 11100 San Fernando.

REQUISITOS DE INSCRIPCIÓN:
- Ser mayor de 18 años o estar emancipado legalmente.
- Estar empadronado en San Fernando.
- No ser titular de vivienda protegida o libre en territorio nacional.
- No superar los límites de ingresos de la normativa de vivienda protegida de Andalucía.
- No haber sido excluido del Registro por causa legal.

DOCUMENTACIÓN HABITUAL:
- DNI, NIE o pasaporte en vigor del solicitante y de toda la unidad familiar.
- Certificado de empadronamiento (máximo 3 meses de antigüedad).
- Última declaración de la renta o certificado de imputaciones de IRPF.
- Libro de familia (si procede).
- Certificado de discapacidad (si procede).
- Acreditación de situaciones especiales (violencia de género, desahucio, etc.).

CÓMO INSCRIBIRSE (online):
1. Crear cuenta en la web (botón «Iniciar mi solicitud») con email y contraseña.
2. Rellenar la solicitud guiada: titulares, unidad familiar, ingresos y vivienda
   a la que se opta. Se puede guardar y continuar después.
3. Adjuntar la documentación en PDF o foto.
4. Al enviarla se recibe el número de registro (RD…/año) y confirmación por email.
5. El estado del expediente se consulta en «Mi panel» y se notifica por email.
También se puede inscribir presencialmente en las oficinas de Hemsa con el impreso
oficial cumplimentado y la documentación.

DESPUÉS DE INSCRIBIRSE:
- La solicitud queda «pendiente» mientras Hemsa verifica la documentación.
- Si falta algo, se notifica una subsanación para corregirla.
- La inscripción debe actualizarse: las no actualizadas por los titulares en TRES
  AÑOS se cancelan de oficio.
- En las adjudicaciones se atiende la ordenación objetiva del Registro.

SECCIONES DE LA WEB que puedes recomendar:
- /informacion → qué es, requisitos, documentación, pasos para inscribirse.
- /normativa → ordenanza y normas reguladoras.
- /calculadora → calculadora de ingresos según IPREM para saber si entra en límites.
- /faq → preguntas frecuentes.
- /contacto → formulario de contacto con Hemsa.

GRUPOS ESPECIALES del formulario: jóvenes (JOV), mayores de 65 (MAY), familias
monoparentales (FMP), víctimas de violencia de género (VVG) y de terrorismo (VT),
rupturas de unidad familiar (RUP), emigrantes retornados (EMI), dependencia (DEP),
discapacidad (DIS), riesgo de exclusión social (RIE), unidades con menores (UF),
ingresos bajo umbral de pobreza (FI), desahucios (DP), otras exclusiones (CAS).
Cada casilla marcada debe acreditarse documentalmente.
"""

PROMPT_ASISTENTE = f"""Eres el asistente virtual de ayuda del Registro Municipal de
Vivienda Protegida de San Fernando. Respondes dudas de ciudadanos dentro de la web
oficial del registro.

REGLAS:
- Responde SIEMPRE en español, con tono cercano, claro y respetuoso.
- Respuestas breves (máximo 6-8 líneas). Si la duda es compleja, resume y orienta.
- Responde SOLO con la información del conocimiento facilitado. Si no lo sabes,
  dilo con honestidad y deriva a las oficinas de Hemsa o a la sección /contacto.
- NUNCA inventes normas, plazos, teléfonos ni horarios. No des consejo legal
  vinculante: tus respuestas son orientativas.
- Si preguntan por su expediente concreto, explíales que se consulta en «Mi panel»
  tras entrar con su cuenta, o en las oficinas de Hemsa.
- Si preguntan por ingresos límites, sugiere la sección /calculadora.
- No hables de puntuaciones ni baremos internos.
- Cuando sea útil, indica la sección de la web donde profundizar (con su ruta).

{CONOCIMIENTO_REGISTRO}
"""


class ChatMensaje(BaseModel):
    rol: str      # 'usuario' o 'asistente'
    texto: str


class ChatPeticion(BaseModel):
    mensaje: str
    historial: List[ChatMensaje] = []


def _rate_limit(ip: str):
    ahora = time.time()
    _intentos[ip] = [t for t in _intentos[ip] if ahora - t < VENTANA_SEG]
    if len(_intentos[ip]) >= MAX_PREGUNTAS:
        raise HTTPException(
            status_code=429,
            detail="Has hecho muchas preguntas seguidas. Espera unos minutos e inténtalo de nuevo.",
        )
    _intentos[ip].append(ahora)


@router.post("/ayuda/chat")
async def ayuda_chat(payload: ChatPeticion, request: Request):
    if not os.environ.get('GEMINI_API_KEY'):
        raise HTTPException(status_code=503, detail="El asistente no está configurado en este servidor.")
    _rate_limit(request.client.host if request.client else "desconocida")

    mensaje = (payload.mensaje or "").strip()
    if not mensaje:
        raise HTTPException(status_code=400, detail="Mensaje vacío.")
    if len(mensaje) > 800:
        raise HTTPException(status_code=400, detail="Mensaje demasiado largo (máx. 800 caracteres).")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])
    model = os.environ.get('GEMINI_MODEL', 'gemini-3-flash-preview')

    contenidos = []
    for m in payload.historial[-6:]:
        rol = 'user' if m.rol == 'usuario' else 'model'
        contenidos.append(types.Content(role=rol, parts=[types.Part.from_text(text=m.texto[:800])]))
    contenidos.append(types.Content(role='user', parts=[types.Part.from_text(text=mensaje)]))

    try:
        resp = await client.aio.models.generate_content(
            model=model,
            contents=contenidos,
            config=types.GenerateContentConfig(
                system_instruction=PROMPT_ASISTENTE,
                temperature=0.3,
            ),
        )
        return {'respuesta': (resp.text or '').strip()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"El asistente no puede responder ahora mismo: {str(e)[:120]}")