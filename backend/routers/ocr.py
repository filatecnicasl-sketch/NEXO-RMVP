"""OCR endpoints: citizen extract + admin OCR-driven registration."""
import os
import json
import re
import tempfile
import uuid
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

# emergentintegrations is internal to Emergent. When running locally without it
# installed, the rest of the application (login, admin, applications) still works;
# only the OCR endpoints will respond with a clear "OCR not configured" error.
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
    EMERGENT_OCR_AVAILABLE = True
except Exception:
    LlmChat = UserMessage = FileContentWithMimeType = None
    EMERGENT_OCR_AVAILABLE = False

from deps import db, logger, now_utc, get_current_user, require_admin, require_writer, EMERGENT_LLM_KEY
from helpers import REGISTRY_RE, generate_registry_number, get_baremo_config
from storage_service import compute_score
from llm_provider import extract_pdf_data


router = APIRouter(tags=["ocr"])


_DNI_LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE'


def _dni_ok(documento: str) -> bool:
    """Valida la letra de control de un DNI español (8 dígitos + letra)."""
    m = re.match(r'^(\d{8})([A-Z])$', (documento or '').replace('-', '').replace(' ', '').upper())
    return bool(m) and _DNI_LETRAS[int(m.group(1)) % 23] == m.group(2)


OCR_SYSTEM_PROMPT = """Eres un asistente experto en extracción estructurada de datos de formularios oficiales de la administración española.
Te entregaré un PDF de la SOLICITUD DE INSCRIPCIÓN del Registro Público Municipal de Demandantes de Vivienda Protegida (San Fernando).
Extrae TODOS los campos del documento y devuélvelos en JSON ESTRICTO siguiendo exactamente este esquema. Si un campo no existe, usa cadena vacía o lista vacía.

Esquema JSON (responde SOLO con este JSON, sin texto extra, sin markdown):
{
  "numero_registro_previo": "",
  "titular1": {
    "nombre": "",
    "apellido1": "",
    "apellido2": "",
    "sexo": "",
    "tipo_documento": "DNI",
    "numero_documento": "",
    "nacionalidad": "",
    "fecha_nacimiento": "",
    "empadronado_en": "",
    "direccion": "",
    "domicilio": "",
    "telefono_fijo": "",
    "telefono_movil": "",
    "codigo_postal": "",
    "email": "",
    "ingresos_economicos": 0,
    "tipo_declaracion_irpf": "INDIVIDUAL",
    "anio_ingresos": 2024,
    "grupos_acreditacion": []
  },
  "titular2": null,
  "otros_miembros": [
    {"nombre_completo":"","nif":"","fecha_nacimiento":"","nacionalidad":"","sexo":"","ingresos_economicos":0,"tipo_declaracion":"No la Hace","anio_ingresos":2024,"grupos_acreditacion":[]}
  ],
  "vivienda": {
    "regimen": [],
    "dormitorios": [],
    "silla_ruedas": false,
    "movilidad_reducida": false,
    "cooperativa": false,
    "alojamiento_otros_familiares": false,
    "vivienda_inadecuada_superficie": false,
    "renta_elevada": false,
    "necesidad_vivienda_adaptada": false,
    "precariedad": false,
    "nueva_unidad_familiar": false,
    "otros": false,
    "otros_detalle": ""
  },
  "justificacion": {
    "casillas": []
  },
  "declaracion": {
    "motivo_propiedad": "",
    "inscripcion_otros_municipios": "",
    "preferencia_en": "",
    "autoriza_email": true,
    "autoriza_sms": true
  }
}

Notas:
- "regimen" puede contener "Propiedad","Alquiler","Alquiler con opción a compra".
- "dormitorios" puede contener "1","2","3","4".
- "grupos_acreditacion" / "casillas" son códigos: JOV, MAY, FMP, VVG, VT, RUP, EMI, DEP, DIS, RIE, UF, FI, DP, CAS, RUI, DES.
- "fecha_nacimiento" en formato DD/MM/YYYY si es posible.
- Si encuentras un número de registro previamente asignado en el documento, ponlo en "numero_registro_previo"."""


async def _extract_with_provider(pdf_path: str, provider: str, model: str) -> Dict[str, Any]:
    if not EMERGENT_OCR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="OCR no disponible en esta instalación (falta el paquete emergentintegrations).",
        )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ocr-{uuid.uuid4().hex[:8]}",
        system_message=OCR_SYSTEM_PROMPT,
    ).with_model(provider, model)
    file_content = FileContentWithMimeType(file_path=pdf_path, mime_type="application/pdf")
    msg = UserMessage(
        text="Extrae los datos del PDF y devuélvelos en JSON estricto siguiendo el esquema especificado.",
        file_contents=[file_content],
    )
    raw = await chat.send_message(msg)
    text = raw if isinstance(raw, str) else str(raw)
    text = text.strip()
    if text.startswith('```'):
        text = re.sub(r'^```(json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        text = text[start:end+1]
    return json.loads(text)


async def _extract_any(pdf_path: str):
    """Cadena de extracción: primero la vía Emergent (si está instalada y con clave),
    después los proveedores directos configurados en .env (llm_provider)."""
    if EMERGENT_OCR_AVAILABLE and EMERGENT_LLM_KEY:
        try:
            data = await _extract_with_provider(pdf_path, "gemini", "gemini-3.1-pro-preview")
            return data, "gemini-3.1-pro-preview"
        except Exception as e:
            logger.warning(f"Gemini OCR (Emergent) falló, probando Claude (Emergent): {e}")
            try:
                data = await _extract_with_provider(pdf_path, "anthropic", "claude-sonnet-4-5-20250929")
                return data, "claude-sonnet-4-5"
            except Exception as e2:
                logger.warning(f"Claude OCR (Emergent) falló, probando proveedores directos: {e2}")
    return await extract_pdf_data(pdf_path, OCR_SYSTEM_PROMPT)


@router.post("/ocr/extract")
async def ocr_extract(file: UploadFile = File(...), user: Dict[str, Any] = Depends(get_current_user)):
    if file.content_type not in ('application/pdf', 'application/octet-stream') and not (file.filename or '').lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Debe ser un archivo PDF")
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (máx 20 MB)")
    tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
    tmp.write(contents)
    tmp.flush()
    tmp.close()
    try:
        data, provider_used = await _extract_any(tmp.name)
        return {'provider': provider_used, 'data': data}
    except Exception as e:
        logger.exception("OCR failed")
        raise HTTPException(status_code=500, detail=f"Error al procesar el PDF con IA: {str(e)[:200]}")
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


@router.post("/admin/ocr/register")
async def admin_ocr_register(file: UploadFile = File(...), user=Depends(require_admin)):
    """Admin uploads PDF, extracts and creates application linked to a synthetic user (or none)."""
    if not (file.filename or '').lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Debe ser un PDF")
    contents = await file.read()
    tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
    tmp.write(contents)
    tmp.flush()
    tmp.close()
    try:
        data, provider_used = await _extract_any(tmp.name)
        email = (data.get('titular1') or {}).get('email') or f"sin-email-{uuid.uuid4().hex[:6]}@hemsa.local"
        existing_user = await db.users.find_one({'email': email}, {'_id': 0})
        if existing_user:
            target_user_id = existing_user['user_id']
            already = await db.applications.find_one({'user_id': target_user_id}, {'_id': 0})
            if already:
                raise HTTPException(status_code=400, detail=f"El ciudadano {email} ya tiene una solicitud (Nº {already.get('numero_registro')})")
        else:
            target_user_id = f"user_{uuid.uuid4().hex[:12]}"
            t1 = data.get('titular1') or {}
            await db.users.insert_one({
                'user_id': target_user_id,
                'email': email,
                'name': f"{t1.get('nombre','')} {t1.get('apellido1','')}".strip() or 'Ciudadano OCR',
                'role': 'citizen',
                'auth_provider': 'ocr_admin',
                'created_at': now_utc().isoformat(),
            })
        numero = (data.get('numero_registro_previo') or "").strip()
        if not REGISTRY_RE.match(numero):
            numero = await generate_registry_number()
        app_id = f"app_{uuid.uuid4().hex[:12]}"
        doc = {
            'application_id': app_id,
            'user_id': target_user_id,
            'numero_registro': numero,
            'status': 'pendiente',
            'titular1': data.get('titular1') or {},
            'titular2': data.get('titular2'),
            'otros_miembros': data.get('otros_miembros') or [],
            'vivienda': data.get('vivienda') or {},
            'justificacion': data.get('justificacion') or {},
            'declaracion': data.get('declaracion') or {},
            'notas_internas': [{'at': now_utc().isoformat(), 'by': user['user_id'], 'by_name': user.get('name',''), 'texto': f'Alta vía OCR ({provider_used})'}],
            'historial': [{'at': now_utc().isoformat(), 'event': 'creada_por_ocr', 'by': user['user_id'], 'provider': provider_used}],
            'created_at': now_utc().isoformat(),
            'updated_at': now_utc().isoformat(),
        }
        # Revisión automática: validación de DNI y campos críticos vacíos.
        # El alta se crea igualmente, pero marcada para revisión humana.
        avisos = []
        for etiqueta, t in (('titular 1', doc['titular1']), ('titular 2', doc.get('titular2') or {})):
            if not t:
                continue
            nd = (t.get('numero_documento') or '').strip()
            if not nd:
                avisos.append(f"documento {etiqueta} en blanco")
            elif (t.get('tipo_documento') or 'DNI').upper() == 'DNI' and not _dni_ok(nd):
                avisos.append(f"DNI {etiqueta} no supera validación ({nd})")
        if avisos:
            doc['revision_pendiente'] = True
            doc['notas_internas'].append({
                'at': now_utc().isoformat(), 'by': user['user_id'], 'by_name': user.get('name', ''),
                'texto': 'REVISIÓN OCR: ' + '; '.join(avisos),
            })
        score_info = compute_score(doc, await get_baremo_config())
        doc['score'] = score_info['score']
        doc['score_breakdown'] = score_info['breakdown']
        await db.applications.insert_one(doc)
        doc.pop('_id', None)
        return {'application': doc, 'provider': provider_used}
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass

# ─── Alta OCR con datos ya revisados/editados (sin releer el PDF) ───
from fastapi import Body


@router.post("/admin/ocr/register-data")
async def admin_ocr_register_data(payload: Dict[str, Any] = Body(...), user=Depends(require_admin)):
    """Crea el alta usando los datos de la vista previa (ya editados por el operario).
    No vuelve a llamar a la IA: la creacion es instantanea."""
    data = payload or {}
    provider_used = 'edicion manual'
    email = (data.get('titular1') or {}).get('email') or f"sin-email-{uuid.uuid4().hex[:6]}@hemsa.local"
    existing_user = await db.users.find_one({'email': email}, {'_id': 0})
    if existing_user:
        target_user_id = existing_user['user_id']
        already = await db.applications.find_one({'user_id': target_user_id}, {'_id': 0})
        if already:
            raise HTTPException(status_code=400, detail=f"El ciudadano {email} ya tiene una solicitud (Nº {already.get('numero_registro')})")
    else:
        target_user_id = f"user_{uuid.uuid4().hex[:12]}"
        t1 = data.get('titular1') or {}
        await db.users.insert_one({
            'user_id': target_user_id,
            'email': email,
            'name': f"{t1.get('nombre', '')} {t1.get('apellido1', '')}".strip() or 'Ciudadano OCR',
            'role': 'citizen',
            'auth_provider': 'ocr_admin',
            'created_at': now_utc().isoformat(),
        })
    numero = (data.get('numero_registro_previo') or "").strip()
    if not REGISTRY_RE.match(numero):
        numero = await generate_registry_number()
    app_id = f"app_{uuid.uuid4().hex[:12]}"
    doc = {
        'application_id': app_id,
        'user_id': target_user_id,
        'numero_registro': numero,
        'status': 'pendiente',
        'titular1': data.get('titular1') or {},
        'titular2': data.get('titular2'),
        'otros_miembros': data.get('otros_miembros') or [],
        'vivienda': data.get('vivienda') or {},
        'justificacion': data.get('justificacion') or {},
        'declaracion': data.get('declaracion') or {},
        'notas_internas': [{'at': now_utc().isoformat(), 'by': user['user_id'], 'by_name': user.get('name', ''), 'texto': 'Alta via OCR (datos revisados y confirmados manualmente)'}],
        'historial': [{'at': now_utc().isoformat(), 'event': 'creada_por_ocr', 'by': user['user_id'], 'provider': provider_used}],
        'created_at': now_utc().isoformat(),
        'updated_at': now_utc().isoformat(),
    }
    avisos = []
    for etiqueta, t in (('titular 1', doc['titular1']), ('titular 2', doc.get('titular2') or {})):
        if not t:
            continue
        nd = (t.get('numero_documento') or '').strip()
        if not nd:
            avisos.append(f"documento {etiqueta} en blanco")
        elif (t.get('tipo_documento') or 'DNI').upper() == 'DNI' and not _dni_ok(nd):
            avisos.append(f"DNI {etiqueta} no supera validación ({nd})")
    if avisos:
        doc['revision_pendiente'] = True
        doc['notas_internas'].append({
            'at': now_utc().isoformat(), 'by': user['user_id'], 'by_name': user.get('name', ''),
            'texto': 'REVISIÓN OCR: ' + '; '.join(avisos),
        })
    score_info = compute_score(doc, await get_baremo_config())
    doc['score'] = score_info['score']
    doc['score_breakdown'] = score_info['breakdown']
    await db.applications.insert_one(doc)
    doc.pop('_id', None)
    return {'application': doc, 'provider': provider_used}