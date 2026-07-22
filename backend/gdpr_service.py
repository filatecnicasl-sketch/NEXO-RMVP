"""GDPR purge job: physically deletes from object storage attachments that have
been soft-deleted for more than RETENTION_DAYS (default 30 days).

Runs every 24h via APScheduler started in server.py startup.

Timestamps `deleted_at` and `purged_at` are stored as BSON datetime (not ISO strings)
so the `$lt` cutoff comparison is robust against any future writer that may use a
different ISO format (naive vs aware, with/without 'Z' suffix, etc.).
"""
import os
import logging
from datetime import timedelta, datetime
from typing import Dict, Any

from deps import db, now_utc
from storage_service import delete_object

logger = logging.getLogger("hemsa.gdpr")

RETENTION_DAYS = int(os.environ.get("GDPR_RETENTION_DAYS", "30"))


async def purge_expired_attachments() -> Dict[str, Any]:
    """Find attachments with is_deleted=True and deleted_at older than RETENTION_DAYS.
    Physically remove from storage and mark them as purged in DB.
    Returns a summary dict for logging."""
    cutoff = now_utc() - timedelta(days=RETENTION_DAYS)
    query = {
        'is_deleted': True,
        'deleted_at': {'$lt': cutoff},
        'purged_at': {'$exists': False},
    }
    purged = 0
    failed = 0
    cursor = db.attachments.find(query, {'_id': 0})
    async for rec in cursor:
        path = rec.get('storage_path')
        if not path:
            continue
        ok = False
        try:
            ok = delete_object(path)
        except Exception as e:
            logger.warning(f"purge failed for {path}: {e}")
        if ok:
            await db.attachments.update_one(
                {'attachment_id': rec['attachment_id']},
                {'$set': {'purged_at': now_utc()}, '$unset': {'storage_path': ""}},
            )
            purged += 1
        else:
            failed += 1
    summary = {'purged': purged, 'failed': failed, 'cutoff': cutoff.isoformat(), 'retention_days': RETENTION_DAYS}
    if purged or failed:
        logger.info(f"GDPR purge run: {summary}")
    return summary


async def migrate_legacy_deleted_at() -> int:
    """One-time idempotent migration: convert string `deleted_at` / `purged_at` to
    BSON datetime on existing attachment records. Returns rows touched."""
    touched = 0
    cursor = db.attachments.find({
        '$or': [
            {'deleted_at': {'$type': 'string'}},
            {'purged_at': {'$type': 'string'}},
        ]
    }, {'_id': 1, 'deleted_at': 1, 'purged_at': 1})
    async for rec in cursor:
        updates: Dict[str, Any] = {}
        for field in ('deleted_at', 'purged_at'):
            v = rec.get(field)
            if isinstance(v, str) and v:
                try:
                    updates[field] = datetime.fromisoformat(v.replace('Z', '+00:00'))
                except Exception:
                    pass
        if updates:
            await db.attachments.update_one({'_id': rec['_id']}, {'$set': updates})
            touched += 1
    if touched:
        logger.info(f"Migrated {touched} legacy deleted_at/purged_at fields to datetime BSON")
    return touched
