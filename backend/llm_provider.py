"""Extracción OCR de PDF con proveedores LLM directos (sin emergentintegrations).

Orden de intento (según las claves configuradas en .env):
  1. GEMINI_API_KEY     → Google Gemini (admite PDF directamente, también escaneado)
  2. ANTHROPIC_API_KEY  → Claude (admite PDF en base64)
  3. LLM_API_KEY        → cualquier API compatible con OpenAI (OpenAI, Moonshot/Kimi...)
                          convirtiendo las páginas del PDF a imágenes (PyMuPDF)

Todos devuelven (datos_dict, nombre_proveedor) o lanzan excepción.
Incluye reintento automático ante errores transitorios (503/429/saturación).
"""
import os
import re
import json
import base64
import asyncio
from typing import Dict, Any, Tuple

import httpx

USER_INSTRUCTION = (
    "Extrae los datos del PDF y devuélvelos en JSON estricto siguiendo "
    "el esquema especificado."
)

# Reintentos ante saturación puntual del proveedor (503 "high demand", 429...)
INTENTOS_MAX = 3
ESPERA_BASE_SEG = 6


def _es_transitorio(err: Exception) -> bool:
    msg = str(err).lower()
    return any(p in msg for p in (
        '503', '429', 'unavailable', 'overload', 'high demand',
        'temporar', 'timeout', 'timed out', 'deadline', 'rate limit',
    ))


def _parse_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    start, end = text.find('{'), text.rfind('}')
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


# ─── 1. Google Gemini ────────────────────────────────────────────────
async def _extract_gemini(pdf_path: str, system_prompt: str) -> Tuple[Dict[str, Any], str]:
    from google import genai
    from google.genai import types

    model = os.environ.get('GEMINI_MODEL', 'gemini-3-flash-preview')
    client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
    resp = await client.aio.models.generate_content(
        model=model,
        contents=[
            types.Content(parts=[
                types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf'),
                types.Part.from_text(text=USER_INSTRUCTION),
            ])
        ],
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0,
        ),
    )
    return _parse_json(resp.text), f"gemini-directo ({model})"


# ─── 2. Anthropic Claude ─────────────────────────────────────────────
async def _extract_anthropic(pdf_path: str, system_prompt: str) -> Tuple[Dict[str, Any], str]:
    model = os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-4-5')
    with open(pdf_path, 'rb') as f:
        pdf_b64 = base64.b64encode(f.read()).decode()
    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': os.environ['ANTHROPIC_API_KEY'],
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            json={
                'model': model,
                'max_tokens': 4096,
                'system': system_prompt,
                'messages': [{'role': 'user', 'content': [
                    {'type': 'document', 'source': {
                        'type': 'base64', 'media_type': 'application/pdf', 'data': pdf_b64}},
                    {'type': 'text', 'text': USER_INSTRUCTION},
                ]}],
            },
        )
        resp.raise_for_status()
        body = resp.json()
    text = ''.join(p.get('text', '') for p in body.get('content', []))
    return _parse_json(text), f"claude-directo ({model})"


# ─── 3. API compatible con OpenAI (OpenAI, Moonshot/Kimi, etc.) ──────
def _pdf_a_imagenes_b64(pdf_path: str, escala: float = 2.5) -> list:
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    imagenes = []
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(escala, escala))
        imagenes.append(base64.b64encode(pix.tobytes('png')).decode())
    return imagenes


async def _extract_openai_compatible(pdf_path: str, system_prompt: str) -> Tuple[Dict[str, Any], str]:
    from openai import AsyncOpenAI

    model = os.environ.get('LLM_MODEL', 'gpt-4o')
    client = AsyncOpenAI(
        api_key=os.environ['LLM_API_KEY'],
        base_url=os.environ.get('LLM_BASE_URL') or None,
    )
    imagenes = _pdf_a_imagenes_b64(pdf_path)
    contenido = [{'type': 'text', 'text': USER_INSTRUCTION}]
    contenido += [
        {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{b64}'}}
        for b64 in imagenes
    ]
    resp = await client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': contenido},
        ],
    )
    return _parse_json(resp.choices[0].message.content), f"openai-compatible ({model})"


# ─── Punto de entrada ────────────────────────────────────────────────
async def extract_pdf_data(pdf_path: str, system_prompt: str) -> Tuple[Dict[str, Any], str]:
    """Prueba los proveedores configurados en orden, con reintento automático
    ante errores transitorios (503/429/saturación). Lanza la última excepción si todos fallan."""
    errores = []
    cadena = []
    if os.environ.get('GEMINI_API_KEY'):
        cadena.append(('Gemini', _extract_gemini))
    if os.environ.get('ANTHROPIC_API_KEY'):
        cadena.append(('Claude', _extract_anthropic))
    if os.environ.get('LLM_API_KEY'):
        cadena.append(('OpenAI-compatible', _extract_openai_compatible))

    if not cadena:
        raise RuntimeError(
            'OCR no configurado: define GEMINI_API_KEY, ANTHROPIC_API_KEY o '
            'LLM_API_KEY (+LLM_BASE_URL/LLM_MODEL) en backend/.env'
        )

    for nombre, fn in cadena:
        for intento in range(1, INTENTOS_MAX + 1):
            try:
                return await fn(pdf_path, system_prompt)
            except Exception as e:
                if _es_transitorio(e) and intento < INTENTOS_MAX:
                    # Saturación puntual: esperamos y reintentamos en silencio
                    await asyncio.sleep(ESPERA_BASE_SEG * intento)
                    continue
                errores.append(f'{nombre}: {str(e)[:150]}')
                break  # error definitivo → siguiente proveedor
    raise RuntimeError('Todos los proveedores OCR fallaron → ' + ' | '.join(errores))