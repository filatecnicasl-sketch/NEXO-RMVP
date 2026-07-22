"""Citizen-facing endpoints: applications, attachments, notifications, alegaciones,
subsanaciones, FNMT signature, PDF receipt, signed approval download."""
import os
import io
import json
import zipfile
import uuid
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, Response
from fastapi.responses import StreamingResponse

from deps import db, logger, now_utc, get_current_user
from models import (
    ApplicationCreate, AlegacionCreate, SubsanacionCreate,
)
from helpers import (
    REGISTRY_RE, generate_registry_number, get_baremo_config,
    create_notification, check_attachment_ownership,
)
from storage_service import compute_score, put_object, get_object
from pdf_gen import generate_application_pdf
from email_service import notify_application_created
from fnmt_service import validate_pdf_signature


router = APIRouter(tags=["applications"])


ATTACH_ALLOWED_MIME = {
    "application/pdf", "image/jpeg", "image/png", "image/webp",
}
ATTACH_MAX_MB = 15


# ---------- Applications (citizen) ----------
@router.post("/applications")
async def create_application(payload: ApplicationCreate, user: Dict[str, Any] = Depends(get_current_user)):
    existing = await db.applications.find_one({'user_id': user['user_id']}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una solicitud asociada a esta cuenta")
    app_id = f"app_{uuid.uuid4().hex[:12]}"
    prev = (payload.numero_registro_previo or "").strip()
    numero = prev if REGISTRY_RE.match(prev) else await generate_registry_number()
    doc = {
        'application_id': app_id,
        'user_id': user['user_id'],
        'numero_registro': numero,
        'status': 'pendiente',
        'titular1': payload.titular1.model_dump(),
        'titular2': payload.titular2.model_dump() if payload.titular2 else None,
        'otros_miembros': [m.model_dump() for m in payload.otros_miembros],
        'vivienda': payload.vivienda.model_dump(),
        'justificacion': payload.justificacion.model_dump(),
        'declaracion': payload.declaracion.model_dump(),
        'notas_internas': [],
        'historial': [{'at': now_utc().isoformat(), 'event': 'creada', 'by': user['user_id']}],
        'created_at': now_utc().isoformat(),
        'updated_at': now_utc().isoformat(),
    }
    score_info = compute_score(doc, await get_baremo_config())
    doc['score'] = score_info['score']
    doc['score_breakdown'] = score_info['breakdown']
    await db.applications.insert_one(doc)
    doc.pop('_id', None)
    titular_email = (payload.titular1.email or '').strip() or user.get('email', '')
    titular_name = f"{payload.titular1.nombre} {payload.titular1.apellido1}".strip() or user.get('name', '')
    try:
        pdf_bytes = generate_application_pdf(doc)
    except Exception:
        pdf_bytes = None
    if titular_email:
        try:
            notify_application_created(titular_email, titular_name, numero, pdf_bytes)
        except Exception as e:
            logger.warning(f"Notification email failed: {e}")
    await create_notification(
        user['user_id'],
        title="Solicitud enviada",
        body=f"Su solicitud {numero} ha sido enviada correctamente y está pendiente de recepción.",
        level="success",
        application_id=app_id,
    )
    return doc


@router.get("/applications/me")
async def get_my_application(user: Dict[str, Any] = Depends(get_current_user)):
    doc = await db.applications.find_one({'user_id': user['user_id']}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No hay solicitud para este usuario")
    return doc


@router.put("/applications/me")
async def update_my_application(payload: ApplicationCreate, user: Dict[str, Any] = Depends(get_current_user)):
    existing = await db.applications.find_one({'user_id': user['user_id']}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="No hay solicitud para actualizar")
    if existing.get('status') not in ('pendiente',):
        raise HTTPException(status_code=400, detail="Solo se puede modificar una solicitud en estado pendiente")
    update = {
        'titular1': payload.titular1.model_dump(),
        'titular2': payload.titular2.model_dump() if payload.titular2 else None,
        'otros_miembros': [m.model_dump() for m in payload.otros_miembros],
        'vivienda': payload.vivienda.model_dump(),
        'justificacion': payload.justificacion.model_dump(),
        'declaracion': payload.declaracion.model_dump(),
        'updated_at': now_utc().isoformat(),
    }
    score_info = compute_score({**existing, **update}, await get_baremo_config())
    update['score'] = score_info['score']
    update['score_breakdown'] = score_info['breakdown']
    await db.applications.update_one({'application_id': existing['application_id']}, {'$set': update, '$push': {'historial': {'at': now_utc().isoformat(), 'event': 'actualizada', 'by': user['user_id']}}})
    doc = await db.applications.find_one({'application_id': existing['application_id']}, {'_id': 0})
    return doc


@router.get("/applications/me/pdf")
async def my_application_pdf(user: Dict[str, Any] = Depends(get_current_user)):
    doc = await db.applications.find_one({'user_id': user['user_id']}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No hay solicitud")
    pdf = generate_application_pdf(doc)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="resguardo_{doc.get("numero_registro","solicitud")}.pdf"'
    })


# ---------- GDPR Art. 20 — Data Portability Export ----------
def _scrub_user(u: Dict[str, Any]) -> Dict[str, Any]:
    """Strip sensitive auth fields from a user document before exporting it."""
    safe = {k: v for k, v in u.items() if k not in ('password_hash', '_id')}
    return safe


@router.get("/applications/me/export")
async def my_data_export(user: Dict[str, Any] = Depends(get_current_user)):
    """RGPD Art. 20 (derecho a la portabilidad). Devuelve un ZIP con:
       - expediente.json: perfil + solicitud + alegaciones + subsanaciones + notificaciones + adjuntos (metadatos)
       - resguardo.pdf: PDF oficial del resguardo
       - adjuntos/: ficheros adjuntos no purgados
       - aprobacion_firmada.pdf: si la administración firmó la aprobación
    """
    application = await db.applications.find_one({'user_id': user['user_id']}, {'_id': 0})
    if not application:
        raise HTTPException(status_code=404, detail="No hay solicitud asociada a este usuario")

    alegaciones = await db.alegaciones.find({'user_id': user['user_id']}, {'_id': 0}).sort('created_at', -1).to_list(500)
    subsanaciones = await db.subsanaciones.find({'user_id': user['user_id']}, {'_id': 0}).sort('created_at', -1).to_list(500)
    notifications = await db.notifications.find({'user_id': user['user_id']}, {'_id': 0}).sort('created_at', -1).to_list(2000)
    attachments = await db.attachments.find(
        {'application_id': application['application_id'], 'is_deleted': False},
        {'_id': 0},
    ).to_list(500)

    bundle = {
        'meta': {
            'exported_at': now_utc().isoformat(),
            'exported_for_user_id': user['user_id'],
            'format_version': '1.0',
            'regulation': 'RGPD Art. 20 (UE) 2016/679 — Portabilidad de datos personales',
            'controller': 'Hemsa, Servicios Públicos Municipales de San Fernando',
        },
        'usuario': _scrub_user(user),
        'solicitud': application,
        'alegaciones': alegaciones,
        'subsanaciones': subsanaciones,
        'notificaciones': notifications,
        'adjuntos_metadatos': attachments,
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('expediente.json', json.dumps(bundle, ensure_ascii=False, indent=2, default=str))
        zf.writestr('README.txt', (
            f"Exportación RGPD - Art. 20 (Portabilidad de datos)\n"
            f"Fecha: {now_utc().isoformat()}\n"
            f"Usuario: {user.get('email','')}\n"
            f"Número de registro: {application.get('numero_registro','')}\n\n"
            f"Contenido:\n"
            f"  - expediente.json: todos sus datos personales y de tramitación.\n"
            f"  - resguardo.pdf: resguardo oficial de la solicitud.\n"
            f"  - adjuntos/: ficheros que adjuntó al expediente.\n"
            f"  - aprobacion_firmada.pdf (si existe): aprobación firmada digitalmente por la administración.\n"
        ))
        try:
            pdf = generate_application_pdf(application)
            zf.writestr('resguardo.pdf', pdf)
        except Exception as e:
            logger.warning(f"Could not generate resguardo for export: {e}")
        firma_admin = application.get('firma_admin') or {}
        if firma_admin.get('archivo_storage_path'):
            try:
                data, _ = get_object(firma_admin['archivo_storage_path'])
                zf.writestr('aprobacion_firmada.pdf', data)
            except Exception as e:
                logger.warning(f"Could not include signed approval in export: {e}")
        for att in attachments:
            try:
                data, _ = get_object(att['storage_path'])
                safe_name = (att.get('original_filename') or att['attachment_id']).replace('/', '_').replace('\\', '_')
                zf.writestr(f"adjuntos/{att['attachment_id']}__{safe_name}", data)
            except Exception as e:
                logger.warning(f"Skipping attachment {att.get('attachment_id')} in export: {e}")
    buf.seek(0)
    filename = f"hemsa_export_{application.get('numero_registro','solicitud')}.zip"
    return StreamingResponse(buf, media_type="application/zip", headers={
        "Content-Disposition": f'attachment; filename="{filename}"'
    })


# ---------- Notifications (in-app) ----------
@router.get("/notifications")
async def list_notifications(user: Dict[str, Any] = Depends(get_current_user), unread: Optional[bool] = None, limit: int = Query(50, ge=1, le=200)):
    query: Dict[str, Any] = {'user_id': user['user_id']}
    if unread is True:
        query['read'] = False
    cursor = db.notifications.find(query, {'_id': 0}).sort('created_at', -1).limit(limit)
    items = await cursor.to_list(limit)
    unread_count = await db.notifications.count_documents({'user_id': user['user_id'], 'read': False})
    return {'items': items, 'unread_count': unread_count}


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    res = await db.notifications.update_one({'notification_id': notification_id, 'user_id': user['user_id']}, {'$set': {'read': True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    return {'ok': True}


@router.patch("/notifications/read-all")
async def mark_all_read(user: Dict[str, Any] = Depends(get_current_user)):
    await db.notifications.update_many({'user_id': user['user_id'], 'read': False}, {'$set': {'read': True}})
    return {'ok': True}


# ---------- FNMT Signature (citizen side) ----------
@router.post("/applications/me/sign-citizen")
async def sign_citizen_declaration(file: UploadFile = File(...), user: Dict[str, Any] = Depends(get_current_user)):
    """Citizen uploads their FNMT-signed declaración jurada (PDF). We validate signature and attach signer info."""
    app_doc = await db.applications.find_one({'user_id': user['user_id']}, {'_id': 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="No hay solicitud asociada")
    data = await file.read()
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="El archivo no es un PDF válido")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF demasiado grande (máx 20 MB)")
    result = validate_pdf_signature(data)
    if not result.get('valid'):
        raise HTTPException(status_code=400, detail=result.get('error', 'PDF sin firma válida'))
    path = f"{os.environ.get('STORAGE_APP_NAME','hemsa-sf')}/applications/{app_doc['application_id']}/firma_ciudadano_{uuid.uuid4().hex[:8]}.pdf"
    try:
        put_object(path, data, "application/pdf")
    except Exception as e:
        logger.warning(f"Could not save signed PDF: {e}")
    firma = {
        'firmado': True,
        'fnmt': bool(result.get('fnmt')),
        'chain_validated': bool(result.get('chain_validated')),
        'firmado_at': now_utc().isoformat(),
        'signers': result.get('signers', []),
        'num_signatures': result.get('num_signatures', 0),
        'original_filename': file.filename,
        'archivo_storage_path': path,
    }
    await db.applications.update_one(
        {'application_id': app_doc['application_id']},
        {'$set': {'firma_ciudadano': firma, 'updated_at': now_utc().isoformat()},
         '$push': {
            'firmas_ciudadano': firma,
            'historial': {'at': now_utc().isoformat(), 'event': 'firma_ciudadano', 'by': user['user_id'], 'fnmt': bool(result.get('fnmt')), 'chain_validated': bool(result.get('chain_validated'))},
         }},
    )
    return {'ok': True, 'firma': firma}


@router.post("/applications/me/sign-citizen-manual")
async def sign_citizen_manual(user: Dict[str, Any] = Depends(get_current_user)):
    """Citizen accepts the sworn declaration without FNMT signature (check box equivalent)."""
    app_doc = await db.applications.find_one({'user_id': user['user_id']}, {'_id': 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="No hay solicitud asociada")
    existing = app_doc.get('firma_ciudadano') or {}
    if existing.get('firmado') and existing.get('fnmt'):
        raise HTTPException(status_code=400, detail="La declaración ya está firmada con certificado FNMT")
    firma = {
        'firmado': True,
        'fnmt': False,
        'tipo': 'manual',
        'firmado_at': now_utc().isoformat(),
        'declaracion_aceptada': True,
    }
    await db.applications.update_one(
        {'application_id': app_doc['application_id']},
        {'$set': {'firma_ciudadano': firma, 'updated_at': now_utc().isoformat()},
         '$push': {
            'firmas_ciudadano': firma,
            'historial': {'at': now_utc().isoformat(), 'event': 'declaracion_jurada_manual', 'by': user['user_id']},
         }},
    )
    return {'ok': True, 'firma': firma}


@router.get("/applications/{application_id}/signed-approval")
async def download_signed_approval(application_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    app_doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if user.get('role') != 'admin' and app_doc['user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="No autorizado")
    firma = app_doc.get('firma_admin') or {}
    if not firma.get('archivo_storage_path'):
        raise HTTPException(status_code=404, detail="No hay documento firmado")
    try:
        data, ct = get_object(firma['archivo_storage_path'])
    except Exception:
        raise HTTPException(status_code=500, detail="No se pudo recuperar el documento firmado")
    return Response(content=data, media_type=ct or "application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{firma.get("original_filename") or "aprobacion_firmada.pdf"}"'
    })


# ---------- Attachments (object storage) ----------
@router.post("/applications/{application_id}/attachments")
async def upload_attachment(
    application_id: str,
    file: UploadFile = File(...),
    categoria: str = Query("otros", description="dni|libro_familia|certificado_discapacidad|certificado_renta|otros"),
    user: Dict[str, Any] = Depends(get_current_user),
):
    await check_attachment_ownership(application_id, user)
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ATTACH_ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Tipo de archivo no permitido (PDF, JPG, PNG, WEBP)")
    data = await file.read()
    if len(data) > ATTACH_MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Archivo demasiado grande (máx {ATTACH_MAX_MB} MB)")
    try:
        import magic as _magic
        detected_mime = _magic.from_buffer(data, mime=True)
        if detected_mime not in ATTACH_ALLOWED_MIME:
            raise HTTPException(status_code=400, detail=f"Contenido real del archivo no permitido: {detected_mime}")
        content_type = detected_mime
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"magic-bytes check skipped: {e}")
    ext = (file.filename or "").split(".")[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{os.environ.get('STORAGE_APP_NAME','hemsa-sf')}/applications/{application_id}/{uuid.uuid4().hex}.{ext}"
    try:
        result = put_object(path, data, content_type)
    except Exception as e:
        logger.exception("Storage upload failed")
        raise HTTPException(status_code=500, detail=f"No se pudo subir el archivo: {str(e)[:120]}")
    attachment_id = f"att_{uuid.uuid4().hex[:12]}"
    rec = {
        'attachment_id': attachment_id,
        'application_id': application_id,
        'uploaded_by': user['user_id'],
        'storage_path': result.get('path', path),
        'original_filename': file.filename,
        'content_type': content_type,
        'size': result.get('size', len(data)),
        'categoria': categoria,
        'is_deleted': False,
        'created_at': now_utc().isoformat(),
    }
    await db.attachments.insert_one(rec)
    rec.pop('_id', None)
    return rec


@router.get("/applications/{application_id}/attachments")
async def list_attachments(application_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    await check_attachment_ownership(application_id, user)
    cursor = db.attachments.find({'application_id': application_id, 'is_deleted': False}, {'_id': 0}).sort('created_at', -1)
    return await cursor.to_list(500)


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(attachment_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    rec = await db.attachments.find_one({'attachment_id': attachment_id, 'is_deleted': False}, {'_id': 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    await check_attachment_ownership(rec['application_id'], user)
    try:
        data, ct = get_object(rec['storage_path'])
    except Exception:
        logger.exception("Storage download failed")
        raise HTTPException(status_code=500, detail="No se pudo descargar el archivo")
    return Response(
        content=data,
        media_type=rec.get('content_type', ct or 'application/octet-stream'),
        headers={"Content-Disposition": f'inline; filename="{rec.get("original_filename","archivo")}"'},
    )


@router.delete("/attachments/{attachment_id}")
async def delete_attachment(attachment_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    rec = await db.attachments.find_one({'attachment_id': attachment_id, 'is_deleted': False}, {'_id': 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")
    await check_attachment_ownership(rec['application_id'], user)
    # Note: deleted_at uses BSON datetime (not ISO string) so GDPR's $lt cutoff query
    # is robust against format drift. See gdpr_service.purge_expired_attachments.
    await db.attachments.update_one(
        {'attachment_id': attachment_id},
        {'$set': {'is_deleted': True, 'deleted_at': now_utc()}},
    )
    return {'ok': True}


# ---------- Alegaciones (citizen side) ----------
@router.post("/applications/me/alegaciones")
async def citizen_create_alegacion(payload: AlegacionCreate, user: Dict[str, Any] = Depends(get_current_user)):
    app_doc = await db.applications.find_one({'user_id': user['user_id']}, {'_id': 0, 'application_id': 1, 'numero_registro': 1, 'titular1': 1})
    if not app_doc:
        raise HTTPException(status_code=404, detail="No hay solicitud asociada")
    if not payload.texto.strip():
        raise HTTPException(status_code=400, detail="El texto de la alegación no puede estar vacío")
    alegacion_id = f"aleg_{uuid.uuid4().hex[:12]}"
    doc = {
        'alegacion_id': alegacion_id,
        'application_id': app_doc['application_id'],
        'numero_registro': app_doc.get('numero_registro', ''),
        'user_id': user['user_id'],
        'texto': payload.texto.strip(),
        'attachment_ids': payload.attachment_ids or [],
        'status': 'enviada',
        'admin_response': None,
        'admin_response_at': None,
        'admin_response_by': None,
        'created_at': now_utc().isoformat(),
    }
    await db.alegaciones.insert_one(doc)
    doc.pop('_id', None)
    async for admin in db.users.find({'role': 'admin'}, {'_id': 0, 'user_id': 1}):
        await create_notification(admin['user_id'], "Nueva alegación recibida", f"Solicitud {app_doc.get('numero_registro','')} ha presentado una alegación.", level="info", application_id=app_doc['application_id'])
    return doc


@router.get("/applications/me/alegaciones")
async def citizen_list_alegaciones(user: Dict[str, Any] = Depends(get_current_user)):
    cursor = db.alegaciones.find({'user_id': user['user_id']}, {'_id': 0}).sort('created_at', -1)
    return await cursor.to_list(200)


# ---------- Subsanaciones (citizen side) ----------
def _proposed_payload(p: ApplicationCreate) -> Dict[str, Any]:
    return {
        'titular1': p.titular1.model_dump(),
        'titular2': p.titular2.model_dump() if p.titular2 else None,
        'otros_miembros': [m.model_dump() for m in p.otros_miembros],
        'vivienda': p.vivienda.model_dump(),
        'justificacion': p.justificacion.model_dump(),
        'declaracion': p.declaracion.model_dump(),
    }


@router.post("/applications/me/subsanaciones")
async def citizen_create_subsanacion(payload: SubsanacionCreate, user: Dict[str, Any] = Depends(get_current_user)):
    app_doc = await db.applications.find_one({'user_id': user['user_id']}, {'_id': 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="No hay solicitud asociada")
    if app_doc.get('status') == 'pendiente':
        raise HTTPException(status_code=400, detail="Su solicitud aún está pendiente: edítela directamente en lugar de presentar subsanación")
    if not payload.motivo.strip():
        raise HTTPException(status_code=400, detail="Indique el motivo de la subsanación")
    pending = await db.subsanaciones.find_one({'application_id': app_doc['application_id'], 'status': 'pendiente'}, {'_id': 0})
    if pending:
        raise HTTPException(status_code=400, detail="Ya tiene una subsanación pendiente de revisión")
    subs_id = f"subs_{uuid.uuid4().hex[:12]}"
    doc = {
        'subsanacion_id': subs_id,
        'application_id': app_doc['application_id'],
        'numero_registro': app_doc.get('numero_registro', ''),
        'user_id': user['user_id'],
        'motivo': payload.motivo.strip(),
        'proposed_data': _proposed_payload(payload.proposed_data),
        'status': 'pendiente',
        'admin_response': None,
        'created_at': now_utc().isoformat(),
    }
    await db.subsanaciones.insert_one(doc)
    doc.pop('_id', None)
    await db.applications.update_one(
        {'application_id': app_doc['application_id']},
        {'$push': {'historial': {'at': now_utc().isoformat(), 'event': 'subsanacion_solicitada', 'by': user['user_id'], 'subsanacion_id': subs_id}}},
    )
    async for admin in db.users.find({'role': 'admin'}, {'_id': 0, 'user_id': 1}):
        await create_notification(admin['user_id'], "Nueva subsanación solicitada", f"Solicitud {app_doc.get('numero_registro','')} pide modificaciones pendientes de aprobación.", level="info", application_id=app_doc['application_id'])
    return doc


@router.get("/applications/me/subsanaciones")
async def citizen_list_subsanaciones(user: Dict[str, Any] = Depends(get_current_user)):
    cursor = db.subsanaciones.find({'user_id': user['user_id']}, {'_id': 0}).sort('created_at', -1)
    return await cursor.to_list(100)
