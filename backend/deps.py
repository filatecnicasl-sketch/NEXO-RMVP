"""Shared dependencies: DB client, env config, auth helpers."""
import os
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import bcrypt
import jwt as pyjwt
from dotenv import load_dotenv
from fastapi import HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
JWT_ALG = 'HS256'
JWT_DAYS = 7
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@hemsa.es')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'AdminHemsa2026!')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

logger = logging.getLogger("hemsa")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def make_jwt(user_id: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_DAYS),
        'iat': datetime.now(timezone.utc),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_jwt(token: str) -> Optional[Dict[str, Any]]:
    try:
        return pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        return None


async def get_current_user(request: Request) -> Dict[str, Any]:
    """Resolve current user. Bearer JWT/session takes precedence over cookie session.

    Why this order: an explicit Authorization header indicates the client is
    actively asserting an identity for THIS request (e.g. admin login from the
    same browser that previously held a citizen Google cookie). The cookie is
    treated as ambient credentials and only used when no Bearer is present.
    """
    # 1. Try Bearer (JWT or session_token in header)
    auth = request.headers.get('Authorization') or ''
    if auth.lower().startswith('bearer '):
        token = auth.split(' ', 1)[1].strip()
        # First try as session_token in DB (Google flow via header too)
        sess = await db.user_sessions.find_one({'session_token': token}, {'_id': 0})
        if sess:
            expires_at = sess['expires_at']
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= now_utc():
                user = await db.users.find_one({'user_id': sess['user_id']}, {'_id': 0})
                if user and not user.get('disabled'):
                    return user
        # Then try JWT
        payload = decode_jwt(token)
        if payload and payload.get('user_id'):
            user = await db.users.find_one({'user_id': payload['user_id']}, {'_id': 0})
            if user and not user.get('disabled'):
                return user

    # 2. Fallback: cookie (Google session)
    session_token = request.cookies.get('session_token')
    if session_token:
        sess = await db.user_sessions.find_one({'session_token': session_token}, {'_id': 0})
        if sess:
            expires_at = sess['expires_at']
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= now_utc():
                user = await db.users.find_one({'user_id': sess['user_id']}, {'_id': 0})
                if user and not user.get('disabled'):
                    return user

    raise HTTPException(status_code=401, detail="No autenticado")


async def require_admin(request: Request) -> Dict[str, Any]:
    user = await get_current_user(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
    return user


# ---------- Admin sub-levels (gerente / administracion / lector) ----------
ADMIN_LEVELS = ("gerente", "administracion", "lector")


def _admin_level(user: Dict[str, Any]) -> str:
    """Resolve the admin level for an admin user. Defaults to 'administracion'
    for legacy admins without the field, so existing accounts keep their power."""
    lvl = (user.get('admin_level') or '').strip().lower()
    return lvl if lvl in ADMIN_LEVELS else 'administracion'


async def require_writer(request: Request) -> Dict[str, Any]:
    """Allow gerente or administracion. Blocks lector."""
    user = await require_admin(request)
    if _admin_level(user) == 'lector':
        raise HTTPException(status_code=403, detail="Su perfil es de solo lectura. Esta acción requiere permisos de Administración o Gerencia.")
    return user


async def require_gerente(request: Request) -> Dict[str, Any]:
    """Only the highest-privileged admin level: gerente."""
    user = await require_admin(request)
    if _admin_level(user) != 'gerente':
        raise HTTPException(status_code=403, detail="Esta acción está reservada a la Gerencia.")
    return user
