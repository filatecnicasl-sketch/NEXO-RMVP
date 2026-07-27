"""Admin-only endpoints: applications, stats, exports, status, notes, users,
baremo configuration, score adjustments, alegaciones, subsanaciones, FNMT approval."""
import os
import io
import re
import csv
import uuid
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

from deps import db, logger, now_utc, hash_password, require_admin, require_writer, require_gerente, _admin_level, ADMIN_LEVELS
from models import (
    ApplicationCreate, StatusUpdate, AdminNote, ScoreAdjustment, BaremoConfig,
    AlegacionResponse, UserCreate, UserUpdate, PasswordReset, SubsanacionReject,
)
from helpers import get_baremo_config, create_notification
from storage_service import compute_score, put_object, get_object, DEFAULT_BAREMO
from pdf_gen import generate_application_pdf
from email_service import notify_status_change
from fnmt_service import validate_pdf_signature


router = APIRouter(tags=["admin"])


# ---------- Stats & Listing ----------
@router.get("/admin/stats")
async def admin_stats(user=Depends(require_admin)):
    pipeline_status = [{'$group': {'_id': '$status', 'count': {'$sum': 1}}}]
    pipeline_month = [
        {'$group': {
            '_id': {'$substr': ['$created_at', 0, 7]},
            'count': {'$sum': 1}
        }},
        {'$sort': {'_id': 1}},
        {'$limit': 12},
    ]
    by_status = {s['_id']: s['count'] async for s in db.applications.aggregate(pipeline_status)}
    by_month = [{'mes': s['_id'], 'count': s['count']} async for s in db.applications.aggregate(pipeline_month)]
    total = sum(by_status.values())
    return {
        'total': total,
        'pendientes': by_status.get('pendiente', 0),
        'en_revision': by_status.get('en_revision', 0),
        'aprobadas': by_status.get('aprobada', 0),
        'denegadas': by_status.get('denegada', 0),
        'por_mes': by_month,
        'por_estado': [{'estado': k, 'count': v} for k, v in by_status.items()],
    }


@router.get("/admin/applications")
async def admin_list_applications(
    user=Depends(require_admin),
    q: Optional[str] = None,
    status: Optional[str] = None,
    dormitorios: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
):
    query: Dict[str, Any] = {}
    if status and status != 'todas':
        query['status'] = status
    if dormitorios:
        query['vivienda.dormitorios'] = dormitorios
    if q:
        rx = {'$regex': re.escape(q), '$options': 'i'}
        query['$or'] = [
            {'numero_registro': rx},
            {'titular1.nombre': rx},
            {'titular1.apellido1': rx},
            {'titular1.apellido2': rx},
            {'titular1.numero_documento': rx},
            {'titular1.email': rx},
        ]
    total = await db.applications.count_documents(query)
    cursor = db.applications.find(query, {'_id': 0}).sort('created_at', -1).skip((page - 1) * page_size).limit(page_size)
    items = await cursor.to_list(page_size)

    # Marca el origen del alta: 'ocr' si el usuario se creó desde el alta OCR
    # del administrador (auth_provider 'ocr_admin'); en otro caso, 'web'.
    user_ids = [it.get('user_id') for it in items if it.get('user_id')]
    origen_por_user = {}
    if user_ids:
        usuarios = await db.users.find(
            {'user_id': {'$in': user_ids}},
            {'_id': 0, 'user_id': 1, 'auth_provider': 1},
        ).to_list(len(user_ids))
        origen_por_user = {
            u['user_id']: ('ocr' if u.get('auth_provider') == 'ocr_admin' else 'web')
            for u in usuarios
        }
    for it in items:
        origen = origen_por_user.get(it.get('user_id'))
        if not origen:
            # Respaldo: mirar el historial de la propia solicitud
            creada_ocr = any(h.get('event') == 'creada_por_ocr' for h in (it.get('historial') or []))
            origen = 'ocr' if creada_ocr else 'web'
        it['origen_alta'] = origen

    return {'total': total, 'page': page, 'page_size': page_size, 'items': items}


@router.get("/admin/applications/{application_id}")
async def admin_get_application(application_id: str, user=Depends(require_admin)):
    doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    return doc


@router.put("/admin/applications/{application_id}")
async def admin_update_application(application_id: str, payload: ApplicationCreate, user=Depends(require_writer)):
    """Permite al administrador editar TODOS los datos de una solicitud,
    independientemente del estado. Queda registrado en el historial."""
    existing = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
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
    await db.applications.update_one(
        {'application_id': application_id},
        {'$set': update,
         '$push': {'historial': {'at': now_utc().isoformat(), 'event': 'editada_por_admin', 'by': user['user_id'], 'by_name': user.get('name', '')}}},
    )
    doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    await create_notification(
        existing['user_id'],
        title="Solicitud actualizada por la administración",
        body=f"Hemsa ha modificado los datos de su solicitud {existing.get('numero_registro','')}.",
        level="info",
        application_id=application_id,
    )
    return doc


@router.patch("/admin/applications/{application_id}/status")
async def admin_update_status(application_id: str, payload: StatusUpdate, user=Depends(require_writer)):
    if payload.status not in ('pendiente', 'recepcionada', 'en_revision', 'aprobada', 'denegada'):
        raise HTTPException(status_code=400, detail="Estado inválido")
    res = await db.applications.update_one(
        {'application_id': application_id},
        {
            '$set': {'status': payload.status, 'updated_at': now_utc().isoformat()},
            '$push': {'historial': {'at': now_utc().isoformat(), 'event': f'status:{payload.status}', 'by': user['user_id'], 'nota': payload.nota or ''}},
        },
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    t1 = doc.get('titular1') or {}
    titular_email = (t1.get('email') or '').strip()
    titular_name = f"{t1.get('nombre','')} {t1.get('apellido1','')}".strip() or "ciudadano/a"
    try:
        pdf_bytes = generate_application_pdf(doc)
    except Exception:
        pdf_bytes = None
    signed_attach = None
    if doc.get('firma_admin', {}).get('archivo_storage_path'):
        try:
            data, _ = get_object(doc['firma_admin']['archivo_storage_path'])
            signed_attach = (doc['firma_admin'].get('original_filename') or f"aprobacion_firmada_{doc.get('numero_registro')}.pdf", data)
        except Exception as e:
            logger.warning(f"Could not load signed approval PDF: {e}")
    if titular_email and (doc.get('declaracion') or {}).get('autoriza_email', True):
        try:
            notify_status_change(titular_email, titular_name, doc.get('numero_registro', ''), payload.status, payload.nota, pdf_bytes, signed_attach)
        except Exception as e:
            logger.warning(f"Status change email failed: {e}")
    await create_notification(
        doc['user_id'],
        title=f"Solicitud {payload.status.replace('_',' ')}",
        body=f"Su solicitud {doc.get('numero_registro','')} ha cambiado a estado: {payload.status}. {payload.nota or ''}".strip(),
        level={"aprobada": "success", "denegada": "error", "recepcionada": "info", "en_revision": "info"}.get(payload.status, "info"),
        application_id=application_id,
    )
    return doc


@router.post("/admin/applications/{application_id}/notes")
async def admin_add_note(application_id: str, payload: AdminNote, user=Depends(require_writer)):
    note = {'at': now_utc().isoformat(), 'by': user['user_id'], 'by_name': user.get('name', ''), 'texto': payload.texto}
    res = await db.applications.update_one(
        {'application_id': application_id},
        {'$push': {'notas_internas': note}, '$set': {'updated_at': now_utc().isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    return doc


# ---------- Admin PDF resguardo ----------
@router.get("/admin/applications/{application_id}/pdf")
async def admin_application_pdf(application_id: str, user=Depends(require_admin)):
    doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    pdf = generate_application_pdf(doc)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="resguardo_{doc.get("numero_registro","solicitud")}.pdf"'
    })


# ---------- Exports ----------
def _flatten_for_export(doc: Dict[str, Any]) -> Dict[str, Any]:
    t1 = doc.get('titular1') or {}
    t2 = doc.get('titular2') or {}
    v = doc.get('vivienda') or {}
    return {
        'numero_registro': doc.get('numero_registro', ''),
        'status': doc.get('status', ''),
        'created_at': doc.get('created_at', ''),
        'titular1_nombre': f"{t1.get('nombre', '')} {t1.get('apellido1', '')} {t1.get('apellido2', '')}".strip(),
        'titular1_documento': t1.get('numero_documento', ''),
        'titular1_email': t1.get('email', ''),
        'titular1_telefono': t1.get('telefono_movil', ''),
        'titular1_ingresos': t1.get('ingresos_economicos', 0),
        'titular2_nombre': f"{t2.get('nombre', '')} {t2.get('apellido1', '')} {t2.get('apellido2', '')}".strip() if t2 else '',
        'miembros_unidad_familiar': len(doc.get('otros_miembros', [])) + (1 if t2 else 0) + 1,
        'regimen': ', '.join(v.get('regimen', [])),
        'dormitorios': ', '.join(v.get('dormitorios', [])),
        'movilidad_reducida': v.get('movilidad_reducida', False),
        'silla_ruedas': v.get('silla_ruedas', False),
    }


@router.get("/admin/export/csv")
async def admin_export_csv(user=Depends(require_admin)):
    cursor = db.applications.find({}, {'_id': 0}).sort('created_at', -1)
    rows = [_flatten_for_export(d) async for d in cursor]
    buf = io.StringIO()
    if rows:
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        buf.write('numero_registro,status\n')
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': 'attachment; filename="solicitudes_hemsa.csv"'},
    )


@router.get("/admin/export/xlsx")
async def admin_export_xlsx(user=Depends(require_admin)):
    cursor = db.applications.find({}, {'_id': 0}).sort('created_at', -1)
    rows = [_flatten_for_export(d) async for d in cursor]
    wb = Workbook()
    ws = wb.active
    ws.title = "Solicitudes"
    if rows:
        headers = list(rows[0].keys())
        ws.append(headers)
        for r in rows:
            ws.append([r.get(h, '') for h in headers])
    else:
        ws.append(['numero_registro', 'status'])
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return StreamingResponse(
        out,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="solicitudes_hemsa.xlsx"'},
    )


# ---------- FNMT signature (admin side) ----------
@router.post("/admin/applications/{application_id}/sign-approval")
async def admin_sign_approval(application_id: str, file: UploadFile = File(...), user=Depends(require_gerente)):
    """Admin uploads the FNMT-signed approval document. Stored and emailed to the citizen.
    Restricted to GERENTE level only (only the manager has legal capacity to sign in name of Hemsa)."""
    app_doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    data = await file.read()
    if not data.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="El archivo no es un PDF válido")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF demasiado grande (máx 20 MB)")
    result = validate_pdf_signature(data)
    if not result.get('valid'):
        raise HTTPException(status_code=400, detail=result.get('error', 'PDF sin firma válida'))
    path = f"{os.environ.get('STORAGE_APP_NAME','hemsa-sf')}/applications/{application_id}/firma_admin_{uuid.uuid4().hex[:8]}.pdf"
    try:
        put_object(path, data, "application/pdf")
    except Exception as e:
        logger.warning(f"Could not save admin-signed PDF: {e}")
    firma = {
        'firmado': True,
        'fnmt': bool(result.get('fnmt')),
        'chain_validated': bool(result.get('chain_validated')),
        'firmado_at': now_utc().isoformat(),
        'signers': result.get('signers', []),
        'admin_user_id': user['user_id'],
        'admin_name': user.get('name', ''),
        'original_filename': file.filename,
        'archivo_storage_path': path,
    }
    await db.applications.update_one(
        {'application_id': application_id},
        {'$set': {'firma_admin': firma, 'updated_at': now_utc().isoformat()},
         '$push': {
            'firmas_admin': firma,
            'historial': {'at': now_utc().isoformat(), 'event': 'firma_admin', 'by': user['user_id'], 'fnmt': bool(result.get('fnmt')), 'chain_validated': bool(result.get('chain_validated'))},
         }},
    )
    return {'ok': True, 'firma': firma}


# ---------- Baremo configuration & manual score adjustment ----------
@router.post("/admin/applications/{application_id}/recompute-score")
async def admin_recompute_score(application_id: str, user=Depends(require_writer)):
    doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    info = compute_score(doc, await get_baremo_config())
    await db.applications.update_one({'application_id': application_id}, {'$set': {'score': info['score'], 'score_breakdown': info['breakdown'], 'updated_at': now_utc().isoformat()}})
    doc['score'] = info['score']; doc['score_breakdown'] = info['breakdown']
    return doc


@router.get("/admin/baremo-config")
async def admin_get_baremo_config(user=Depends(require_admin)):
    cfg = await get_baremo_config()
    return {'config': cfg, 'is_default': cfg == DEFAULT_BAREMO}


@router.put("/admin/baremo-config")
async def admin_set_baremo_config(payload: BaremoConfig, user=Depends(require_gerente)):
    await db.settings.update_one(
        {'key': 'baremo'},
        {'$set': {'key': 'baremo', 'config': payload.model_dump(), 'updated_at': now_utc().isoformat(), 'updated_by': user['user_id']}},
        upsert=True,
    )
    return {'ok': True, 'config': payload.model_dump()}


@router.post("/admin/baremo-config/reset")
async def admin_reset_baremo(user=Depends(require_gerente)):
    await db.settings.delete_one({'key': 'baremo'})
    return {'ok': True, 'config': DEFAULT_BAREMO}


@router.post("/admin/baremo/recompute-all")
async def admin_recompute_all(user=Depends(require_writer)):
    from pymongo import UpdateOne
    cfg = await get_baremo_config()
    cursor = db.applications.find({}, {'_id': 0})
    ops = []
    BATCH = 500
    count = 0
    async for doc in cursor:
        info = compute_score(doc, cfg)
        ops.append(UpdateOne(
            {'application_id': doc['application_id']},
            {'$set': {'score': info['score'], 'score_breakdown': info['breakdown']}},
        ))
        if len(ops) >= BATCH:
            await db.applications.bulk_write(ops, ordered=False)
            count += len(ops)
            ops = []
    if ops:
        await db.applications.bulk_write(ops, ordered=False)
        count += len(ops)
    return {'ok': True, 'updated': count}


@router.patch("/admin/applications/{application_id}/score-adjustment")
async def admin_set_score_adjustment(application_id: str, payload: ScoreAdjustment, user=Depends(require_gerente)):
    doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    doc['score_adjustment'] = {'points': int(payload.points), 'reason': payload.reason, 'by': user['user_id'], 'at': now_utc().isoformat()}
    info = compute_score(doc, await get_baremo_config())
    await db.applications.update_one(
        {'application_id': application_id},
        {'$set': {
            'score_adjustment': doc['score_adjustment'],
            'score': info['score'],
            'score_breakdown': info['breakdown'],
            'updated_at': now_utc().isoformat(),
        },
         '$push': {'historial': {'at': now_utc().isoformat(), 'event': f'ajuste_baremo:{payload.points:+d}', 'by': user['user_id'], 'nota': payload.reason}}},
    )
    return {'application_id': application_id, 'score': info['score'], 'score_breakdown': info['breakdown'], 'score_adjustment': doc['score_adjustment']}


# ---------- Alegaciones (admin side) ----------
@router.get("/admin/applications/{application_id}/alegaciones")
async def admin_list_alegaciones(application_id: str, user=Depends(require_admin)):
    cursor = db.alegaciones.find({'application_id': application_id}, {'_id': 0}).sort('created_at', -1)
    return await cursor.to_list(200)


@router.post("/admin/alegaciones/{alegacion_id}/respond")
async def admin_respond_alegacion(alegacion_id: str, payload: AlegacionResponse, user=Depends(require_writer)):
    aleg = await db.alegaciones.find_one({'alegacion_id': alegacion_id}, {'_id': 0})
    if not aleg:
        raise HTTPException(status_code=404, detail="Alegación no encontrada")
    if not payload.texto.strip():
        raise HTTPException(status_code=400, detail="La respuesta no puede estar vacía")
    await db.alegaciones.update_one(
        {'alegacion_id': alegacion_id},
        {'$set': {
            'status': 'contestada',
            'admin_response': payload.texto.strip(),
            'admin_response_at': now_utc().isoformat(),
            'admin_response_by': user['user_id'],
            'admin_response_by_name': user.get('name', ''),
        }},
    )
    await create_notification(
        aleg['user_id'],
        "Alegación respondida",
        f"Hemsa ha respondido a su alegación de la solicitud {aleg.get('numero_registro','')}.",
        level="info",
        application_id=aleg['application_id'],
    )
    return await db.alegaciones.find_one({'alegacion_id': alegacion_id}, {'_id': 0})


# ---------- Subsanaciones (admin side) ----------
@router.get("/admin/applications/{application_id}/subsanaciones")
async def admin_list_subsanaciones(application_id: str, user=Depends(require_admin)):
    cursor = db.subsanaciones.find({'application_id': application_id}, {'_id': 0}).sort('created_at', -1)
    return await cursor.to_list(100)


@router.post("/admin/subsanaciones/{subsanacion_id}/approve")
async def admin_approve_subsanacion(subsanacion_id: str, user=Depends(require_writer)):
    subs = await db.subsanaciones.find_one({'subsanacion_id': subsanacion_id}, {'_id': 0})
    if not subs:
        raise HTTPException(status_code=404, detail="Subsanación no encontrada")
    if subs['status'] != 'pendiente':
        raise HTTPException(status_code=400, detail=f"La subsanación ya está {subs['status']}")
    existing = await db.applications.find_one({'application_id': subs['application_id']}, {'_id': 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    proposed = subs['proposed_data']
    update = {
        'titular1': proposed.get('titular1'),
        'titular2': proposed.get('titular2'),
        'otros_miembros': proposed.get('otros_miembros') or [],
        'vivienda': proposed.get('vivienda') or {},
        'justificacion': proposed.get('justificacion') or {},
        'declaracion': proposed.get('declaracion') or {},
        'updated_at': now_utc().isoformat(),
    }
    score_info = compute_score({**existing, **update}, await get_baremo_config())
    update['score'] = score_info['score']
    update['score_breakdown'] = score_info['breakdown']
    await db.applications.update_one(
        {'application_id': subs['application_id']},
        {'$set': update,
         '$push': {'historial': {'at': now_utc().isoformat(), 'event': 'subsanacion_aprobada', 'by': user['user_id'], 'by_name': user.get('name',''), 'subsanacion_id': subsanacion_id}}},
    )
    await db.subsanaciones.update_one({'subsanacion_id': subsanacion_id}, {'$set': {
        'status': 'aprobada',
        'admin_response_at': now_utc().isoformat(),
        'admin_response_by': user['user_id'],
        'admin_response_by_name': user.get('name', ''),
    }})
    await create_notification(subs['user_id'], "Subsanación aprobada", f"Sus modificaciones a la solicitud {subs.get('numero_registro','')} han sido aplicadas.", level="success", application_id=subs['application_id'])
    return await db.subsanaciones.find_one({'subsanacion_id': subsanacion_id}, {'_id': 0})


@router.post("/admin/subsanaciones/{subsanacion_id}/reject")
async def admin_reject_subsanacion(subsanacion_id: str, payload: SubsanacionReject, user=Depends(require_writer)):
    subs = await db.subsanaciones.find_one({'subsanacion_id': subsanacion_id}, {'_id': 0})
    if not subs:
        raise HTTPException(status_code=404, detail="Subsanación no encontrada")
    if subs['status'] != 'pendiente':
        raise HTTPException(status_code=400, detail=f"La subsanación ya está {subs['status']}")
    await db.subsanaciones.update_one({'subsanacion_id': subsanacion_id}, {'$set': {
        'status': 'rechazada',
        'admin_response': payload.motivo.strip(),
        'admin_response_at': now_utc().isoformat(),
        'admin_response_by': user['user_id'],
        'admin_response_by_name': user.get('name', ''),
    }})
    await db.applications.update_one(
        {'application_id': subs['application_id']},
        {'$push': {'historial': {'at': now_utc().isoformat(), 'event': 'subsanacion_rechazada', 'by': user['user_id'], 'by_name': user.get('name',''), 'subsanacion_id': subsanacion_id, 'motivo': payload.motivo}}},
    )
    await create_notification(subs['user_id'], "Subsanación rechazada", f"Hemsa ha rechazado sus modificaciones de la solicitud {subs.get('numero_registro','')}. Motivo: {payload.motivo[:120]}", level="error", application_id=subs['application_id'])
    return await db.subsanaciones.find_one({'subsanacion_id': subsanacion_id}, {'_id': 0})


# ---------- User Management ----------
def _user_public(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'user_id': u.get('user_id'),
        'name': u.get('name', ''),
        'email': u.get('email', ''),
        'role': u.get('role', 'citizen'),
        'admin_level': _admin_level(u) if u.get('role') == 'admin' else None,
        'auth_provider': u.get('auth_provider', 'password'),
        'disabled': bool(u.get('disabled', False)),
        'created_at': u.get('created_at', ''),
        'picture': u.get('picture', ''),
    }


@router.get("/admin/users")
async def admin_list_users(
    user=Depends(require_admin),
    role: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
):
    query: Dict[str, Any] = {}
    if role:
        query['role'] = role
    if q:
        rx = {'$regex': re.escape(q), '$options': 'i'}
        query['$or'] = [{'email': rx}, {'name': rx}]
    cursor = db.users.find(query, {'_id': 0, 'password_hash': 0}).sort('created_at', -1).limit(limit)
    items = await cursor.to_list(limit)
    return {'items': [_user_public(u) for u in items], 'total': await db.users.count_documents(query)}


@router.post("/admin/users")
async def admin_create_user(payload: UserCreate, user=Depends(require_gerente)):
    if payload.role not in ('admin', 'citizen'):
        raise HTTPException(status_code=400, detail="Rol inválido")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    existing = await db.users.find_one({'email': payload.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")
    admin_lvl = (payload.admin_level or 'administracion').lower()
    if payload.role == 'admin' and admin_lvl not in ADMIN_LEVELS:
        raise HTTPException(status_code=400, detail=f"Nivel de admin inválido. Use uno de: {', '.join(ADMIN_LEVELS)}")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        'user_id': user_id,
        'email': payload.email,
        'name': payload.name,
        'role': payload.role,
        'auth_provider': 'password',
        'password_hash': hash_password(payload.password),
        'created_at': now_utc().isoformat(),
        'created_by': user['user_id'],
        'disabled': False,
    }
    if payload.role == 'admin':
        doc['admin_level'] = admin_lvl
    await db.users.insert_one(doc)
    return _user_public(doc)


@router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, payload: UserUpdate, user=Depends(require_gerente)):
    target = await db.users.find_one({'user_id': user_id}, {'_id': 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    updates: Dict[str, Any] = {}
    if payload.name is not None:
        updates['name'] = payload.name
    if payload.role is not None:
        if payload.role not in ('admin', 'citizen'):
            raise HTTPException(status_code=400, detail="Rol inválido")
        updates['role'] = payload.role
    if payload.admin_level is not None:
        lvl = payload.admin_level.lower()
        if lvl not in ADMIN_LEVELS:
            raise HTTPException(status_code=400, detail=f"Nivel inválido. Use: {', '.join(ADMIN_LEVELS)}")
        # Protect last gerente: don't allow downgrading if it's the only gerente.
        if target.get('admin_level') == 'gerente' and lvl != 'gerente':
            others = await db.users.count_documents({'role': 'admin', 'admin_level': 'gerente', 'user_id': {'$ne': user_id}, 'disabled': {'$ne': True}})
            if others == 0:
                raise HTTPException(status_code=400, detail="No se puede degradar al único Gerente activo. Antes promueva a otro usuario.")
        updates['admin_level'] = lvl
    if payload.disabled is not None:
        if target['user_id'] == user['user_id'] and payload.disabled:
            raise HTTPException(status_code=400, detail="No puede deshabilitarse a sí mismo")
        updates['disabled'] = bool(payload.disabled)
    if not updates:
        return _user_public(target)
    updates['updated_at'] = now_utc().isoformat()
    await db.users.update_one({'user_id': user_id}, {'$set': updates})
    target = await db.users.find_one({'user_id': user_id}, {'_id': 0})
    return _user_public(target)


@router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, payload: PasswordReset, user=Depends(require_gerente)):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    target = await db.users.find_one({'user_id': user_id}, {'_id': 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await db.users.update_one({'user_id': user_id}, {'$set': {
        'password_hash': hash_password(payload.new_password),
        'auth_provider': 'password',
        'updated_at': now_utc().isoformat(),
        'password_reset_by': user['user_id'],
        'password_reset_at': now_utc().isoformat(),
    }})
    return {'ok': True}


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, user=Depends(require_gerente)):
    target = await db.users.find_one({'user_id': user_id}, {'_id': 0})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target['user_id'] == user['user_id']:
        raise HTTPException(status_code=400, detail="No puede eliminarse a sí mismo")
    if target.get('role') == 'admin' and target.get('admin_level') == 'gerente':
        others = await db.users.count_documents({'role': 'admin', 'admin_level': 'gerente', 'user_id': {'$ne': user_id}, 'disabled': {'$ne': True}})
        if others == 0:
            raise HTTPException(status_code=400, detail="No se puede eliminar al único Gerente activo. Antes promueva a otro usuario.")
    await db.users.update_one({'user_id': user_id}, {'$set': {'disabled': True, 'deleted_at': now_utc()}})
    return {'ok': True}
