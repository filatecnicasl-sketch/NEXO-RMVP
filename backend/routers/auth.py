"""Authentication endpoints: citizen/admin login & registration, Google OAuth, password reset."""
import os
import uuid
from datetime import timedelta, datetime, timezone
from typing import Dict, Any

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request, Response

from deps import (
    db, logger, now_utc, hash_password, verify_password, make_jwt,
    get_current_user, _admin_level,
)
from models import (
    CitizenRegister, CitizenLogin, AdminLogin, GoogleSession,
    PasswordChange, ForgotPassword, ResetPasswordPayload,
)
from email_service import notify_password_reset


router = APIRouter(tags=["auth"])


# ─── Protección anti fuerza bruta (en memoria; suficiente para pruebas) ───
from collections import defaultdict
import time as _time

_intentos_login = defaultdict(list)
MAX_INTENTOS, VENTANA_SEG = 5, 300  # 5 intentos por IP+email cada 5 minutos


def _rate_limit(request: Request, clave: str):
    ahora = _time.time()
    ip = request.client.host if request.client else '?'
    k = f"{ip}:{(clave or '').lower()}"
    _intentos_login[k] = [t for t in _intentos_login[k] if ahora - t < VENTANA_SEG]
    if len(_intentos_login[k]) >= MAX_INTENTOS:
        raise HTTPException(status_code=429, detail="Demasiados intentos. Espera 5 minutos.")
    _intentos_login[k].append(ahora)


@router.get("/")
async def root():
    return {"app": "Hemsa Registro Vivienda Protegida", "version": "1.0"}


@router.get("/auth/account-type")
async def auth_account_type(email: str):
    """Light probe used by the citizen login form to redirect admins to /admin/login
    if they accidentally try the citizen door. Returns minimal info; never reveals
    existence of citizen accounts (anti-enumeration)."""
    import re as _re
    safe = _re.escape(email.strip())[:120]
    user = await db.users.find_one({'email': {'$regex': f'^{safe}$', '$options': 'i'}}, {'_id': 0, 'role': 1, 'disabled': 1})
    if user and user.get('role') == 'admin' and not user.get('disabled'):
        return {'is_admin': True}
    return {'is_admin': False}


@router.post("/auth/citizen/register")
async def citizen_register(payload: CitizenRegister):
    existing = await db.users.find_one({'email': payload.email}, {'_id': 0})
    if existing:
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        'user_id': user_id,
        'email': payload.email,
        'name': payload.name,
        'role': 'citizen',
        'auth_provider': 'password',
        'password_hash': hash_password(payload.password),
        'created_at': now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    token = make_jwt(user_id, 'citizen')
    return {'token': token, 'user': {'user_id': user_id, 'email': payload.email, 'name': payload.name, 'role': 'citizen'}}


@router.post("/auth/citizen/login")
async def citizen_login(payload: CitizenLogin, request: Request):
    _rate_limit(request, payload.email)
    user = await db.users.find_one({'email': payload.email}, {'_id': 0})
    if not user or user.get('role') != 'citizen' or not verify_password(payload.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token = make_jwt(user['user_id'], 'citizen')
    return {'token': token, 'user': {'user_id': user['user_id'], 'email': user['email'], 'name': user['name'], 'role': 'citizen'}}


@router.post("/auth/admin/login")
async def admin_login(payload: AdminLogin, request: Request):
    _rate_limit(request, payload.email)
    user = await db.users.find_one({'email': payload.email}, {'_id': 0})
    if not user or user.get('role') != 'admin' or not verify_password(payload.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if user.get('disabled'):
        raise HTTPException(status_code=403, detail="Cuenta deshabilitada. Contacte con el administrador.")
    token = make_jwt(user['user_id'], 'admin')
    return {'token': token, 'user': {'user_id': user['user_id'], 'email': user['email'], 'name': user['name'], 'role': 'admin', 'admin_level': _admin_level(user)}}


@router.post("/auth/google/session")
async def google_session(payload: GoogleSession, response: Response):
    # El flujo de Google depende del backend demo de Emergent; desactivado por defecto.
    # Para habilitarlo con OAuth propio: GOOGLE_OAUTH_ENABLED=true en .env
    if os.environ.get('GOOGLE_OAUTH_ENABLED', 'false').lower() != 'true':
        raise HTTPException(status_code=503, detail="Acceso con Google no disponible en esta instalación. Usa email y contraseña.")
    """Exchange Emergent session_id (from auth.emergentagent.com redirect) for an internal session."""
    async with httpx.AsyncClient(timeout=20) as h:
        r = await h.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={'X-Session-ID': payload.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="No se pudo validar la sesión de Google")
    data = r.json()
    email = data['email']
    name = data.get('name', email)
    picture = data.get('picture', '')
    session_token = data['session_token']

    user = await db.users.find_one({'email': email}, {'_id': 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            'user_id': user_id,
            'email': email,
            'name': name,
            'picture': picture,
            'role': 'citizen',
            'auth_provider': 'google',
            'created_at': now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({'user_id': user['user_id']}, {'$set': {'name': name, 'picture': picture}})

    expires_at = (now_utc() + timedelta(days=7))
    await db.user_sessions.update_one(
        {'session_token': session_token},
        {'$set': {
            'user_id': user['user_id'],
            'session_token': session_token,
            'expires_at': expires_at.isoformat(),
            'created_at': now_utc().isoformat(),
        }},
        upsert=True,
    )
    response.set_cookie(
        key='session_token',
        value=session_token,
        httponly=True,
        secure=True,
        samesite='none',
        path='/',
        max_age=7 * 24 * 60 * 60,
    )
    return {'user': {'user_id': user['user_id'], 'email': email, 'name': name, 'role': 'citizen', 'picture': picture}, 'session_token': session_token}


@router.get("/auth/me")
async def auth_me(user: Dict[str, Any] = Depends(get_current_user)):
    return {
        'user_id': user['user_id'],
        'email': user['email'],
        'name': user['name'],
        'role': user.get('role', 'citizen'),
        'admin_level': _admin_level(user) if user.get('role') == 'admin' else None,
        'picture': user.get('picture', ''),
        'auth_provider': user.get('auth_provider', 'password'),
    }


@router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    session_token = request.cookies.get('session_token')
    if session_token:
        await db.user_sessions.delete_one({'session_token': session_token})
    response.delete_cookie('session_token', path='/')
    return {'ok': True}


@router.post("/auth/change-password")
async def change_password(payload: PasswordChange, user: Dict[str, Any] = Depends(get_current_user)):
    if user.get('auth_provider') != 'password':
        raise HTTPException(status_code=400, detail="Solo cuentas con contraseña pueden cambiarla aquí")
    if not verify_password(payload.current_password, user.get('password_hash', '')):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres")
    await db.users.update_one({'user_id': user['user_id']}, {'$set': {
        'password_hash': hash_password(payload.new_password),
        'updated_at': now_utc().isoformat(),
    }})
    return {'ok': True}


@router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPassword):
    user = await db.users.find_one({'email': payload.email}, {'_id': 0})
    # Never reveal whether the email exists (anti enumeration)
    if not user or user.get('auth_provider') != 'password' or user.get('disabled'):
        return {'ok': True}
    token = uuid.uuid4().hex + uuid.uuid4().hex
    expires_at = (now_utc() + timedelta(hours=1)).isoformat()
    await db.password_resets.insert_one({
        'token': token,
        'user_id': user['user_id'],
        'email': user['email'],
        'expires_at': expires_at,
        'used': False,
        'created_at': now_utc().isoformat(),
    })
    public_url = os.environ.get('APP_PUBLIC_URL', '')
    reset_url = f"{public_url}/reset-password?token={token}"
    try:
        notify_password_reset(user['email'], user.get('name', ''), reset_url)
    except Exception as e:
        logger.warning(f"Reset email failed: {e}")
    return {'ok': True}


@router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordPayload):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    rec = await db.password_resets.find_one({'token': payload.token, 'used': False}, {'_id': 0})
    if not rec:
        raise HTTPException(status_code=400, detail="Enlace inválido o ya utilizado")
    expires_at = rec['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=400, detail="El enlace ha expirado. Solicite uno nuevo.")
    await db.users.update_one({'user_id': rec['user_id']}, {'$set': {
        'password_hash': hash_password(payload.new_password),
        'auth_provider': 'password',
        'updated_at': now_utc().isoformat(),
        'password_reset_at': now_utc().isoformat(),
    }})
    await db.password_resets.update_one({'token': payload.token}, {'$set': {'used': True, 'used_at': now_utc().isoformat()}})
    return {'ok': True}