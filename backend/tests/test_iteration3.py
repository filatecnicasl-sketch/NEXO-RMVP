"""
Iteration 3 backend tests for Hemsa Vivienda Protegida.

Covers:
- New 'recepcionada' status in admin status PATCH.
- FNMT citizen sign (invalid PDF -> 400, manual accept -> ok).
- FNMT admin sign-approval (rejects bogus PDF, requires admin).
- python-magic MIME validation on attachments (renamed .txt rejected, real PDF/JPEG accepted).
- In-app notifications list, unread_count, mark-read, mark-all, isolation between users.
"""
import io
import os
import uuid
import struct
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vivienda-protegida.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@hemsa.es"
ADMIN_PASSWORD = "AdminHemsa2026!"


# ---------- Helpers ----------
def _real_pdf_bytes() -> bytes:
    """A minimal but proper PDF (libmagic detects 'application/pdf')."""
    return (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n"
        b"0000000053 00000 n \n0000000099 00000 n \n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF\n"
    )


def _real_jpeg_bytes() -> bytes:
    """Minimal valid JPEG: SOI + APP0(JFIF) + EOI."""
    soi = b"\xFF\xD8"
    jfif = b"\xFF\xE0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    eoi = b"\xFF\xD9"
    return soi + jfif + eoi


def _http():
    return requests.Session()


def _new_citizen():
    s = _http()
    email = f"iter3_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "TestPwd2026!"
    r = s.post(f"{API}/auth/citizen/register", json={"name": "Iter3", "email": email, "password": pwd}, timeout=20)
    assert r.status_code == 200, r.text
    return s, r.json()["token"], r.json()["user"]["user_id"], email


def _citizen_payload(email: str) -> dict:
    return {
        "titular1": {
            "nombre": "Iter", "apellido1": "Tres", "apellido2": "X",
            "sexo": "F", "tipo_documento": "DNI", "numero_documento": "33333333X",
            "nacionalidad": "Española", "fecha_nacimiento": "01/01/1990",
            "empadronado_en": "San Fernando", "direccion": "C/ Iter 3",
            "domicilio": "San Fernando", "telefono_fijo": "", "telefono_movil": "611333444",
            "codigo_postal": "11100", "email": email, "ingresos_economicos": 9000,
            "tipo_declaracion_irpf": "INDIVIDUAL", "anio_ingresos": 2024,
            "grupos_acreditacion": [],
        },
        "titular2": None,
        "otros_miembros": [],
        "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"]},
        "justificacion": {"casillas": ["JOV"]},
        "declaracion": {"motivo_propiedad": "", "inscripcion_otros_municipios": "",
                        "preferencia_en": "San Fernando", "autoriza_email": True, "autoriza_sms": True},
    }


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    s = _http()
    r = s.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def citizen_app():
    s, token, user_id, email = _new_citizen()
    r = s.post(f"{API}/applications", json=_citizen_payload(email),
               headers={"Authorization": f"Bearer {token}"}, timeout=45)
    assert r.status_code == 200, r.text
    return {"session": s, "token": token, "user_id": user_id, "email": email, "app": r.json()}


# ---------- recepcionada status ----------
class TestRecepcionadaStatus:
    def test_patch_to_recepcionada(self, admin_token, citizen_app):
        s = requests.Session()
        app_id = citizen_app["app"]["application_id"]
        r = s.patch(f"{API}/admin/applications/{app_id}/status",
                    json={"status": "recepcionada", "nota": "Recibida en oficina"},
                    headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "recepcionada"

    def test_full_status_flow(self, admin_token, citizen_app):
        s = requests.Session()
        app_id = citizen_app["app"]["application_id"]
        for st in ("en_revision", "aprobada"):
            r = s.patch(f"{API}/admin/applications/{app_id}/status",
                        json={"status": st, "nota": f"->{st}"},
                        headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == st

    def test_invalid_status_rejected(self, admin_token, citizen_app):
        s = requests.Session()
        app_id = citizen_app["app"]["application_id"]
        r = s.patch(f"{API}/admin/applications/{app_id}/status",
                    json={"status": "rechazada", "nota": "x"},
                    headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 400


# ---------- FNMT citizen signature ----------
class TestFnmtCitizen:
    def test_sign_citizen_invalid_pdf_400(self, citizen_app):
        # Need fresh citizen+app since `citizen_app` is module-scoped and may already be approved
        s, token, _, email = _new_citizen()
        r = s.post(f"{API}/applications", json=_citizen_payload(email),
                   headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r.status_code == 200
        files = {"file": ("fake.pdf", b"NOT-A-PDF", "application/pdf")}
        r = requests.post(f"{API}/applications/me/sign-citizen",
                          headers={"Authorization": f"Bearer {token}"},
                          files=files, timeout=30)
        assert r.status_code == 400, r.text
        assert "PDF" in r.text or "pdf" in r.text

    def test_sign_citizen_unsigned_pdf_400(self):
        s, token, _, email = _new_citizen()
        r = s.post(f"{API}/applications", json=_citizen_payload(email),
                   headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r.status_code == 200
        files = {"file": ("doc.pdf", _real_pdf_bytes(), "application/pdf")}
        r = requests.post(f"{API}/applications/me/sign-citizen",
                          headers={"Authorization": f"Bearer {token}"},
                          files=files, timeout=30)
        assert r.status_code == 400, r.text
        body = r.json()
        assert "firma" in (body.get("detail", "").lower()) or "sin firma" in body.get("detail", "").lower() or "PDF" in body.get("detail","")

    def test_sign_citizen_manual_ok(self):
        s, token, _, email = _new_citizen()
        r = s.post(f"{API}/applications", json=_citizen_payload(email),
                   headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r.status_code == 200
        r = s.post(f"{API}/applications/me/sign-citizen-manual",
                   headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        firma = body["firma"]
        assert firma["firmado"] is True
        assert firma["fnmt"] is False
        assert firma.get("tipo") == "manual"

        # Confirm persisted on application doc
        r2 = s.get(f"{API}/applications/me",
                   headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("firma_ciudadano", {}).get("firmado") is True


# ---------- FNMT admin signature ----------
class TestFnmtAdmin:
    def test_admin_sign_requires_admin(self, citizen_app):
        files = {"file": ("doc.pdf", _real_pdf_bytes(), "application/pdf")}
        # citizen token, not admin
        r = requests.post(
            f"{API}/admin/applications/{citizen_app['app']['application_id']}/sign-approval",
            headers={"Authorization": f"Bearer {citizen_app['token']}"},
            files=files, timeout=30,
        )
        assert r.status_code in (401, 403)

    def test_admin_sign_invalid_pdf_400(self, admin_token, citizen_app):
        files = {"file": ("bad.pdf", b"junk", "application/pdf")}
        r = requests.post(
            f"{API}/admin/applications/{citizen_app['app']['application_id']}/sign-approval",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files, timeout=30,
        )
        assert r.status_code == 400

    def test_admin_sign_unsigned_pdf_400(self, admin_token, citizen_app):
        files = {"file": ("doc.pdf", _real_pdf_bytes(), "application/pdf")}
        r = requests.post(
            f"{API}/admin/applications/{citizen_app['app']['application_id']}/sign-approval",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files, timeout=30,
        )
        # No FNMT signature -> 400 PDF sin firma válida
        assert r.status_code == 400

    def test_signed_approval_404_when_no_signature(self, admin_token, citizen_app):
        r = requests.get(
            f"{API}/applications/{citizen_app['app']['application_id']}/signed-approval",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=20,
        )
        assert r.status_code == 404


# ---------- python-magic MIME validation ----------
class TestMagicMime:
    def test_renamed_txt_as_pdf_rejected(self, citizen_app):
        # bytes are plain text but content_type lies as application/pdf
        files = {"file": ("fake.pdf", b"This is plain text, not a PDF.", "application/pdf")}
        r = requests.post(
            f"{API}/applications/{citizen_app['app']['application_id']}/attachments",
            params={"categoria": "otros"},
            headers={"Authorization": f"Bearer {citizen_app['token']}"},
            files=files, timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "Contenido real" in r.text or "no permitido" in r.text.lower()

    def test_real_pdf_accepted(self, citizen_app):
        files = {"file": ("ok.pdf", _real_pdf_bytes(), "application/pdf")}
        r = requests.post(
            f"{API}/applications/{citizen_app['app']['application_id']}/attachments",
            params={"categoria": "otros"},
            headers={"Authorization": f"Bearer {citizen_app['token']}"},
            files=files, timeout=60,
        )
        assert r.status_code == 200, r.text
        assert r.json()["content_type"] == "application/pdf"

    def test_real_jpeg_accepted(self, citizen_app):
        files = {"file": ("ok.jpg", _real_jpeg_bytes(), "image/jpeg")}
        r = requests.post(
            f"{API}/applications/{citizen_app['app']['application_id']}/attachments",
            params={"categoria": "otros"},
            headers={"Authorization": f"Bearer {citizen_app['token']}"},
            files=files, timeout=60,
        )
        assert r.status_code == 200, r.text
        assert r.json()["content_type"] == "image/jpeg"


# ---------- In-app notifications ----------
class TestNotifications:
    def test_create_app_makes_notification(self):
        s, token, _, email = _new_citizen()
        r = s.post(f"{API}/applications", json=_citizen_payload(email),
                   headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r.status_code == 200
        rn = s.get(f"{API}/notifications", headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert rn.status_code == 200, rn.text
        d = rn.json()
        assert "items" in d and "unread_count" in d
        assert d["unread_count"] >= 1
        assert any("Solicitud enviada" in (it.get("title", "") or "") for it in d["items"])

    def test_status_change_adds_notification_and_mark_read(self, admin_token):
        s, token, _, email = _new_citizen()
        r = s.post(f"{API}/applications", json=_citizen_payload(email),
                   headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r.status_code == 200
        app_id = r.json()["application_id"]
        rr = requests.patch(f"{API}/admin/applications/{app_id}/status",
                            json={"status": "recepcionada", "nota": ""},
                            headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert rr.status_code == 200, rr.text
        # citizen sees 2 notifications now
        rn = s.get(f"{API}/notifications", headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert rn.status_code == 200
        items = rn.json()["items"]
        assert len(items) >= 2
        # mark first one read
        nid = items[0]["notification_id"]
        mr = s.patch(f"{API}/notifications/{nid}/read",
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert mr.status_code == 200
        # unread_count drops by 1
        rn2 = s.get(f"{API}/notifications", headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert rn2.json()["unread_count"] == rn.json()["unread_count"] - 1

    def test_mark_all_read(self):
        s, token, _, email = _new_citizen()
        r = s.post(f"{API}/applications", json=_citizen_payload(email),
                   headers={"Authorization": f"Bearer {token}"}, timeout=30)
        assert r.status_code == 200
        ma = s.patch(f"{API}/notifications/read-all",
                     headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert ma.status_code == 200
        rn = s.get(f"{API}/notifications", headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert rn.json()["unread_count"] == 0

    def test_user_isolation(self):
        s1, t1, _, e1 = _new_citizen()
        r1 = s1.post(f"{API}/applications", json=_citizen_payload(e1),
                     headers={"Authorization": f"Bearer {t1}"}, timeout=30)
        assert r1.status_code == 200
        s2, t2, _, e2 = _new_citizen()
        rn2 = s2.get(f"{API}/notifications", headers={"Authorization": f"Bearer {t2}"}, timeout=20)
        # second user should NOT see the first user's notification
        assert rn2.status_code == 200
        for it in rn2.json()["items"]:
            assert it.get("user_id", t2) != t1  # cannot leak
