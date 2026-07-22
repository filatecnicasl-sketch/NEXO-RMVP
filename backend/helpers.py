"""Shared helpers: baremo config, registry number, notifications, attachment ACL."""
import re
import uuid
from typing import Dict, Any, Optional
from fastapi import HTTPException

from deps import db, logger, now_utc
from storage_service import DEFAULT_BAREMO


REGISTRY_RE = re.compile(r'^SF-\d{4}-\d{5}$')


async def get_baremo_config() -> Dict[str, Any]:
    doc = await db.settings.find_one({'key': 'baremo'}, {'_id': 0})
    if doc and doc.get('config'):
        return doc['config']
    return DEFAULT_BAREMO


async def generate_registry_number() -> str:
    year = now_utc().year
    pattern = re.compile(rf"^SF-{year}-(\d+)$")
    cursor = db.applications.find({'numero_registro': {'$regex': f'^SF-{year}-'}}, {'numero_registro': 1, '_id': 0})
    max_seq = 0
    async for doc in cursor:
        m = pattern.match(doc.get('numero_registro', ''))
        if m:
            max_seq = max(max_seq, int(m.group(1)))
    return f"SF-{year}-{max_seq + 1:05d}"


async def create_notification(user_id: str, title: str, body: str, level: str = "info", application_id: Optional[str] = None):
    notif = {
        'notification_id': f"notif_{uuid.uuid4().hex[:12]}",
        'user_id': user_id,
        'title': title,
        'body': body,
        'level': level,
        'application_id': application_id,
        'read': False,
        'created_at': now_utc().isoformat(),
    }
    try:
        await db.notifications.insert_one(notif)
    except Exception as e:
        logger.warning(f"create_notification failed: {e}")
    return notif


async def check_attachment_ownership(application_id: str, user: Dict[str, Any]):
    app_doc = await db.applications.find_one({'application_id': application_id}, {'_id': 0, 'user_id': 1, 'application_id': 1})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")
    if user.get('role') != 'admin' and app_doc['user_id'] != user['user_id']:
        raise HTTPException(status_code=403, detail="No autorizado")
    return app_doc
