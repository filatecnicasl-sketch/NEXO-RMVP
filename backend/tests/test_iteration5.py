"""Iteration 5 tests — FNMT CA chain cryptographic validation (P0).

Verifies:
  - /app/backend/certs/fnmt/ trust roots load (2 roots).
  - sign-citizen / sign-approval endpoints store chain_validated.
  - Self-signed PDF: signature_intact=true, chain_valid=false, chain_error=null
    (i.e. no asyncio.run loop conflict, runs in ThreadPoolExecutor).
  - Bogus PDF -> 400.
  - Concurrent uploads don't trigger event loop issues.
  - Old firma_ciudadano docs (no chain_validated field) still serializable.
"""
import os
import io
import uuid
import time
import threading
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@hemsa.es"
ADMIN_PASSWORD = "AdminHemsa2026!"
SELF_SIGNED_PDF_PATH = "/tmp/signed.pdf"


# ---------- Module fixtures ----------
@pytest.fixture(scope="module")
def signed_pdf_bytes():
    if not os.path.exists(SELF_SIGNED_PDF_PATH):
        pytest.skip("/tmp/signed.pdf not present; main agent must regenerate it")
    with open(SELF_SIGNED_PDF_PATH, "rb") as f:
        return f.read()


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{API}/auth/admin/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
def citizen_with_app():
    """Fresh citizen + minimal application."""
    suffix = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"
    email = f"iter5_{suffix}@example.com"
    pw = "Citizen2026!"
    r = requests.post(f"{API}/auth/citizen/register",
                      json={"name": f"Iter5 {suffix}", "email": email, "password": pw},
                      timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    body = {
        "titular1": {"nombre": "Iter5", "apellido1": "Test", "numero_documento": "12345678Z",
                     "email": email, "ingresos_economicos": 12000},
        "otros_miembros": [],
        "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"], "silla_ruedas": False},
        "justificacion": {"casillas": ["VVG"]},
        "declaracion": {"autoriza_email": True, "autoriza_sms": True},
    }
    r2 = requests.post(f"{API}/applications", json=body, headers=h, timeout=30)
    assert r2.status_code == 200, r2.text
    return tok, h, email, r2.json()["application_id"]


# ---------- Module load checks ----------
class TestTrustRoots:
    """Backend startup: 2 FNMT trust roots loaded."""

    def test_trust_roots_loaded_count(self):
        from fnmt_service import _TRUST_ROOTS  # noqa
        # If import path differs, fallback: import via direct path
        assert len(_TRUST_ROOTS) == 2

    def test_trust_roots_subjects_are_fnmt(self):
        from fnmt_service import _TRUST_ROOTS
        subjects = " ".join(t.subject.human_friendly for t in _TRUST_ROOTS).upper()
        assert "FNMT-RCM" in subjects
        assert "AC RAIZ FNMT-RCM" in subjects
        assert "AC ADMINISTRACI" in subjects  # AC Administración Pública


# ---------- Citizen sign endpoint ----------
class TestCitizenSign:
    def test_bogus_pdf_rejected_400(self, citizen_with_app):
        _, h, _, _ = citizen_with_app
        files = {"file": ("bogus.pdf", b"%PDF-1.4 hello", "application/pdf")}
        r = requests.post(f"{API}/applications/me/sign-citizen",
                          files=files, headers=h, timeout=30)
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        assert ("inválido" in detail) or ("invalido" in detail) or ("no contiene firmas" in detail) or ("sin firmas" in detail)

    def test_self_signed_pdf_returns_chain_false_no_loop_error(self, citizen_with_app, signed_pdf_bytes):
        _, h, _, app_id = citizen_with_app
        files = {"file": ("signed.pdf", signed_pdf_bytes, "application/pdf")}
        r = requests.post(f"{API}/applications/me/sign-citizen",
                          files=files, headers=h, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        firma = body.get("firma") or {}
        signers = firma.get("signers") or []
        assert firma.get("firmado") is True
        assert firma.get("fnmt") is False
        assert firma.get("chain_validated") is False
        assert len(signers) >= 1
        s0 = signers[0]
        assert s0.get("signature_intact") is True
        assert s0.get("chain_valid") is False
        # The key regression fix: chain_error must NOT be the asyncio.run-from-running-loop message
        ce = s0.get("chain_error")
        assert ce is None or "asyncio.run" not in str(ce).lower(), f"chain_error leaks asyncio loop bug: {ce}"

    def test_history_event_includes_chain_validated_flag(self, citizen_with_app, signed_pdf_bytes, admin_h):
        tok, h, _, app_id = citizen_with_app
        files = {"file": ("signed.pdf", signed_pdf_bytes, "application/pdf")}
        r = requests.post(f"{API}/applications/me/sign-citizen", files=files, headers=h, timeout=60)
        assert r.status_code == 200
        # Fetch via admin for full history
        a = requests.get(f"{API}/admin/applications/{app_id}", headers=admin_h, timeout=15).json()
        events = [e for e in (a.get("historial") or []) if e.get("event") == "firma_ciudadano"]
        assert events, "Missing firma_ciudadano history event"
        # Must include chain_validated key (False here for self-signed PDF)
        assert "chain_validated" in events[-1]
        assert events[-1]["chain_validated"] is False


# ---------- Admin sign-approval ----------
class TestAdminSignApproval:
    def test_admin_sign_approval_self_signed(self, citizen_with_app, signed_pdf_bytes, admin_h):
        _, _, _, app_id = citizen_with_app
        files = {"file": ("signed.pdf", signed_pdf_bytes, "application/pdf")}
        r = requests.post(f"{API}/admin/applications/{app_id}/sign-approval",
                          files=files, headers=admin_h, timeout=60)
        assert r.status_code == 200, r.text
        firma = (r.json().get("firma") or {})
        assert firma.get("firmado") is True
        assert firma.get("fnmt") is False
        assert firma.get("chain_validated") is False
        # Verify persisted via GET
        a = requests.get(f"{API}/admin/applications/{app_id}", headers=admin_h, timeout=15).json()
        fa = a.get("firma_admin") or {}
        assert fa.get("firmado") is True
        assert fa.get("chain_validated") is False

    def test_admin_endpoint_blocked_for_citizens(self, citizen_with_app, signed_pdf_bytes):
        _, h, _, app_id = citizen_with_app
        files = {"file": ("signed.pdf", signed_pdf_bytes, "application/pdf")}
        r = requests.post(f"{API}/admin/applications/{app_id}/sign-approval",
                          files=files, headers=h, timeout=30)
        assert r.status_code in (401, 403)


# ---------- Concurrency ----------
class TestConcurrency:
    def test_concurrent_uploads_no_event_loop_conflict(self, signed_pdf_bytes):
        """Run 4 parallel sign-citizen requests; none should error with asyncio loop conflict."""
        # Setup 4 fresh citizens
        sessions = []
        for _ in range(4):
            suffix = f"{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
            email = f"iter5c_{suffix}@example.com"
            r = requests.post(f"{API}/auth/citizen/register",
                              json={"name": "C", "email": email, "password": "Pw2026!"},
                              timeout=30)
            tok = r.json()["token"]
            h = {"Authorization": f"Bearer {tok}"}
            body = {
                "titular1": {"nombre": "X", "apellido1": "Y", "numero_documento": "12345678Z",
                             "email": email, "ingresos_economicos": 10000},
                "otros_miembros": [],
                "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"], "silla_ruedas": False},
                "justificacion": {"casillas": ["VVG"]},
                "declaracion": {"autoriza_email": True, "autoriza_sms": True},
            }
            requests.post(f"{API}/applications", json=body, headers=h, timeout=30)
            sessions.append(h)

        results = [None] * len(sessions)

        def _upload(idx, headers):
            try:
                files = {"file": ("signed.pdf", signed_pdf_bytes, "application/pdf")}
                resp = requests.post(f"{API}/applications/me/sign-citizen",
                                     files=files, headers=headers, timeout=60)
                results[idx] = (resp.status_code, resp.text[:200])
            except Exception as e:
                results[idx] = ("EXC", str(e))

        threads = [threading.Thread(target=_upload, args=(i, h)) for i, h in enumerate(sessions)]
        for t in threads: t.start()
        for t in threads: t.join(timeout=90)

        for i, r in enumerate(results):
            assert r is not None and r[0] == 200, f"req {i} failed: {r}"
            assert "asyncio.run" not in r[1].lower()


# ---------- Backward compat ----------
class TestBackwardCompat:
    def test_existing_app_without_chain_validated_loads(self, citizen_with_app, admin_h):
        """Simulate a legacy firma_ciudadano doc without chain_validated; admin GET must still work."""
        from pymongo import MongoClient
        from dotenv import dotenv_values
        env = dotenv_values("/app/backend/.env")
        mongo_url = os.environ.get("MONGO_URL") or env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or env.get("DB_NAME")
        if not mongo_url or not db_name:
            pytest.skip("MONGO_URL/DB_NAME not configured")
        cli = MongoClient(mongo_url)
        db = cli[db_name]
        _, _, _, app_id = citizen_with_app
        # Inject legacy firma object (no chain_validated key)
        db.applications.update_one(
            {"application_id": app_id},
            {"$set": {"firma_ciudadano": {
                "firmado": True,
                "fnmt": False,
                "tipo": "fnmt_pdf",
                "signers": [{"cn": "Legacy Signer", "is_fnmt": False}],
                "firmado_at": "2026-01-01T00:00:00",
            }}},
        )
        r = requests.get(f"{API}/admin/applications/{app_id}", headers=admin_h, timeout=15)
        assert r.status_code == 200
        fc = r.json().get("firma_ciudadano") or {}
        assert fc.get("firmado") is True
        # chain_validated may be absent or null/false — UI treats undefined as false
        assert fc.get("chain_validated") in (None, False)
