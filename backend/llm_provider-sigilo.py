"""Extracción OCR de PDF con proveedores LLM directos (sin emergentintegrations).

Orden de intento (según las claves configuradas en .env):
  1. GEMINI_API_KEY     → Google Gemini
  2. ANTHROPIC_API_KEY  → Claude
  3. LLM_API_KEY        → cualquier API compatible con OpenAI (OpenAI, Moonshot/Kimi...)

Estrategia: en lugar de enviar el PDF en bruto, cada página se renderiza a
imagen JPEG con PyMuPDF y se envían las imágenes. Motivo: algunos PDFs de
escáner (p. ej. Canon iR-ADV) llevan la página partida en decenas de
fragmentos superpuestos y los lectores internos de PDF de los LLM no los
procesan bien; PyMuPDF los renderiza siempre correctamente y las imágenes
son la entrada más fiable para todos los proveedores.

Todos devuelven (datos_dict, nombre_proveedor) o lanzan excepción.
Los errores transitorios (503/429/timeouts) se reintentan automáticamente.
"""
import os
import re
import json
import base64
import asyncio
from typing import Dict, Any, Tuple, List

import httpx

USER_INSTRUCTION = (
    "Extrae los datos del formulario que ves en las imágenes y devuélvelos "
    "en JSON estricto siguiendo el esquema especificado."
)

INTENTOS_MAX = 3
ESPERA_BASE_SEG = 6


def _es_transitorio(err: Exception) -> bool:
    """Errores de saturación/red que merecen reintento automático."""
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


def _pdf_a_imagenes(pdf_path: str, escala: float = 2.0, calidad: int = 85, max_paginas: int = 1) -> List[bytes]:
    """Renderiza páginas del PDF a JPEG con PyMuPDF (soporta cualquier
    PDF, incluidos escaneados con estructura fragmentada).
    Por defecto solo la página 1: todos los datos del formulario están ahí;
    la página 2 es texto legal y firmas. Procesar solo 1 página reduce
    casi a la mitad el tiempo de respuesta del OCR."""
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    imagenes = []
    for page in doc:
        if len(imagenes) >= max_paginas:
            break
        pix = page.get_pixmap(matrix=fitz.Matrix(escala, escala))
        imagenes.append(pix.tobytes('jpg', jpg_quality=calidad))
    doc.close()
    return imagenes


# ─── 1. Google Gemini ────────────────────────────────────────────────
async def _extract_gemini(pdf_path: str, system_prompt: str) -> Tuple[Dict[str, Any], str]:
    from google import genai
    from google.genai import types

    model = os.environ.get('GEMINI_MODEL', 'gemini-3-flash-preview')
    client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])
    imagenes = _pdf_a_imagenes(pdf_path)
    parts = [
        types.Part.from_bytes(data=img, mime_type='image/jpeg')
        for img in imagenes
    ]
    parts.append(types.Part.from_text(text=USER_INSTRUCTION))
    resp = await client.aio.models.generate_content(
        model=model,
        contents=[types.Content(parts=parts)],
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0,
        ),
    )
    return _parse_json(resp.text), f"gemini-imagenes ({model})"


# ─── 2. Anthropic Claude ─────────────────────────────────────────────
async def _extract_anthropic(pdf_path: str, system_prompt: str) -> Tuple[Dict[str, Any], str]:
    model = os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-4-5')
    imagenes = _pdf_a_imagenes(pdf_path)
    contenido = [
        {'type': 'image', 'source': {
            'type': 'base64', 'media_type': 'image/jpeg',
            'data': base64.b64encode(img).decode()}}
        for img in imagenes
    ]
    contenido.append({'type': 'text', 'text': USER_INSTRUCTION})
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
                'messages': [{'role': 'user', 'content': contenido}],
            },
        )
        resp.raise_for_status()
        body = resp.json()
    text = ''.join(p.get('text', '') for p in body.get('content', []))
    return _parse_json(text), f"claude-imagenes ({model})"


# ─── 3. API compatible con OpenAI (OpenAI, Moonshot/Kimi, etc.) ──────
async def _extract_openai_compatible(pdf_path: str, system_prompt: str) -> Tuple[Dict[str, Any], str]:
    from openai import AsyncOpenAI

    model = os.environ.get('LLM_MODEL', 'gpt-4o')
    client = AsyncOpenAI(
        api_key=os.environ['LLM_API_KEY'],
        base_url=os.environ.get('LLM_BASE_URL') or None,
    )
    imagenes = _pdf_a_imagenes(pdf_path)
    contenido = [{'type': 'text', 'text': USER_INSTRUCTION}]
    contenido += [
        {'type': 'image_url', 'image_url': {
            'url': f'data:image/jpeg;base64,{base64.b64encode(img).decode()}'}}
        for img in imagenes
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
    """Prueba los proveedores configurados en orden, con reintentos
    automáticos ante errores transitorios. Lanza la última excepción si todos fallan."""
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
                    await asyncio.sleep(ESPERA_BASE_SEG * intento)
                    continue
                errores.append(f'{nombre}: {str(e)[:150]}')
                break
    raise RuntimeError('Todos los proveedores OCR fallaron → ' + ' | '.join(errores))