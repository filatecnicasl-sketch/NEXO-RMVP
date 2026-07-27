"""
Hemsa - Registro Municipal de Vivienda Protegida de San Fernando
FastAPI backend entrypoint. Endpoint definitions live in routers/.
"""
import os
import uuid
import logging

from fastapi import FastAPI, APIRouter, Depends
from starlette.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from deps import db, client, logger, now_utc, hash_password, require_admin, require_gerente, ADMIN_EMAIL, ADMIN_PASSWORD
from storage_service import init_storage
from gdpr_service import purge_expired_attachments, migrate_legacy_deleted_at
from routers import auth as auth_router
from routers import applications as applications_router
from routers import admin as admin_router
from routers import ocr as ocr_router
from routers import ayuda as ayuda_router

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

app = FastAPI(title="Hemsa Registro Vivienda Protegida")
api_router = APIRouter(prefix="/api")
scheduler = AsyncIOScheduler()

# Mount sub-routers
api_router.include_router(auth_router.router)
api_router.include_router(applications_router.router)
api_router.include_router(admin_router.router)
api_router.include_router(ocr_router.router)
api_router.include_router(ayuda_router.router)

# ---------- Admin: manual GDPR purge trigger ----------
@api_router.post("/admin/gdpr/purge-now")
async def admin_gdpr_purge_now(user=Depends(require_gerente)):
    """Trigger the GDPR purge job manually (does NOT wait for nightly cron)."""
    summary = await purge_expired_attachments()
    return {'ok': True, **summary}


# ---------- Startup: seed admin & indexes ----------
@app.on_event("startup")
async def seed_admin():
    existing = await db.users.find_one({'email': ADMIN_EMAIL}, {'_id': 0})
    if not existing:
        await db.users.insert_one({
            'user_id': f"user_{uuid.uuid4().hex[:12]}",
            'email': ADMIN_EMAIL,
            'name': 'Administrador Hemsa',
            'role': 'admin',
            'admin_level': 'gerente',
            'auth_provider': 'password',
            'password_hash': hash_password(ADMIN_PASSWORD),
            'created_at': now_utc().isoformat(),
        })
        logger.info(f"Admin sembrado: {ADMIN_EMAIL}")
    else:
        # Backfill: ensure the seed admin is always 'gerente' so the system never
        # locks itself out of features that require gerente.
        if existing.get('admin_level') != 'gerente':
            await db.users.update_one({'user_id': existing['user_id']}, {'$set': {'admin_level': 'gerente'}})

    # Migration: existing admin users without admin_level → 'administracion'
    await db.users.update_many(
        {'role': 'admin', 'admin_level': {'$exists': False}},
        {'$set': {'admin_level': 'administracion'}},
    )
    # Indexes
    await db.users.create_index('email', unique=True)
    await db.applications.create_index('user_id')
    await db.applications.create_index('numero_registro', unique=True, sparse=True)
    await db.user_sessions.create_index('session_token', unique=True)
    await db.attachments.create_index('application_id')
    await db.notifications.create_index([('user_id', 1), ('created_at', -1)])
    await db.notifications.create_index('notification_id', unique=True)
    await db.alegaciones.create_index([('application_id', 1), ('created_at', -1)])
    await db.alegaciones.create_index('alegacion_id', unique=True)
    await db.subsanaciones.create_index([('application_id', 1), ('created_at', -1)])
    await db.subsanaciones.create_index('subsanacion_id', unique=True)
    await db.password_resets.create_index('token', unique=True)

    # Init Emergent object storage
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.warning(f"Object storage init failed (uploads may fail): {e}")

    # Schedule GDPR purge job (daily at 03:30 UTC) + run once shortly after boot
    if not scheduler.running:
        scheduler.add_job(purge_expired_attachments, 'cron', hour=3, minute=30, id='gdpr_purge', replace_existing=True)
        scheduler.start()
        logger.info("Scheduler started: gdpr_purge daily @ 03:30 UTC")

    # One-time migration: legacy ISO-string deleted_at/purged_at -> BSON datetime
    try:
        await migrate_legacy_deleted_at()
    except Exception as e:
        logger.warning(f"deleted_at migration skipped: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    if scheduler.running:
        scheduler.shutdown(wait=False)
    client.close()


# ---------- Mount ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get(
        'CORS_ORIGINS',
        'http://localhost:3000,http://localhost:3001,http://localhost:3002'
    ).split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)