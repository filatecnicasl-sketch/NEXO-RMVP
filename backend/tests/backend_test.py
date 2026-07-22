"""
Hemsa backend regression tests (pytest).
Covers: admin auth, citizen auth, applications CRUD, admin endpoints,
exports, OCR extract + OCR admin register.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vivienda-protegida.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hemsa.es"
ADMIN_PASSWORD = "AdminHemsa2026!"

PDF_URL = "https://customer-assets.emergentagent.com/job_ab224004-7faf-44fe-b0e3-83d3a646f26e/artifacts/88snqckh_RD001_2026%202.pdf"


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(http):
    r = http.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def citizen(http):
    email = f"test_citizen_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestCiudadano2026!"
    r = http.post(f"{API}/auth/citizen/register", json={"name": "Test Ciudadano", "email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Register failed: {r.text}"
    data = r.json()
    return {"email": email, "password": password, "token": data["token"], "user_id": data["user"]["user_id"]}


@pytest.fixture(scope="session")
def pdf_bytes():
    r = requests.get(PDF_URL, timeout=60)
    assert r.status_code == 200, f"PDF download failed: {r.status_code}"
    return r.content


# ---------- Auth ----------
class TestAuth:
    def test_admin_login_ok(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_admin_login_wrong_password(self, http):
        r = http.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=20)
        assert r.status_code == 401

    def test_citizen_register_duplicate(self, http, citizen):
        r = http.post(f"{API}/auth/citizen/register", json={"name": "Dup", "email": citizen["email"], "password": "abc123"}, timeout=20)
        assert r.status_code == 400

    def test_citizen_login_ok(self, http, citizen):
        r = http.post(f"{API}/auth/citizen/login", json={"email": citizen["email"], "password": citizen["password"]}, timeout=20)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "citizen"

    def test_auth_me(self, http, citizen):
        r = http.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {citizen['token']}"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == citizen["email"]

    def test_admin_endpoint_rejects_citizen(self, http, citizen):
        r = http.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {citizen['token']}"}, timeout=20)
        assert r.status_code == 403


# ---------- Applications ----------
def _payload(email: str):
    return {
        "titular1": {
            "nombre": "Maria", "apellido1": "Gomez", "apellido2": "Lopez",
            "sexo": "F", "tipo_documento": "DNI", "numero_documento": "12345678Z",
            "nacionalidad": "Española", "fecha_nacimiento": "01/01/1985",
            "empadronado_en": "San Fernando", "direccion": "Calle Real 1",
            "domicilio": "San Fernando", "telefono_fijo": "", "telefono_movil": "600000000",
            "codigo_postal": "11100", "email": email, "ingresos_economicos": 12000,
            "tipo_declaracion_irpf": "INDIVIDUAL", "anio_ingresos": 2024,
            "grupos_acreditacion": ["JOV"],
        },
        "titular2": None,
        "otros_miembros": [],
        "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"]},
        "justificacion": {"casillas": ["JOV", "RUI"]},
        "declaracion": {"motivo_propiedad": "", "inscripcion_otros_municipios": "", "preferencia_en": "San Fernando", "autoriza_email": True, "autoriza_sms": True},
    }


class TestApplications:
    def test_create_application(self, http, citizen):
        r = http.post(f"{API}/applications", json=_payload(citizen["email"]),
                      headers={"Authorization": f"Bearer {citizen['token']}"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["numero_registro"].startswith("SF-")
        parts = body["numero_registro"].split("-")
        assert len(parts) == 3 and len(parts[2]) == 5
        assert body["status"] == "pendiente"

    def test_create_duplicate_returns_400(self, http, citizen):
        r = http.post(f"{API}/applications", json=_payload(citizen["email"]),
                      headers={"Authorization": f"Bearer {citizen['token']}"}, timeout=30)
        assert r.status_code == 400

    def test_get_my_application(self, http, citizen):
        r = http.get(f"{API}/applications/me", headers={"Authorization": f"Bearer {citizen['token']}"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["titular1"]["email"] == citizen["email"]

    def test_update_my_application(self, http, citizen):
        p = _payload(citizen["email"])
        p["titular1"]["telefono_movil"] = "611111111"
        r = http.put(f"{API}/applications/me", json=p, headers={"Authorization": f"Bearer {citizen['token']}"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["titular1"]["telefono_movil"] == "611111111"


# ---------- Admin ----------
class TestAdmin:
    def test_stats(self, http, admin_token):
        r = http.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "pendientes", "aprobadas", "denegadas"):
            assert k in d

    def test_list_apps_filters(self, http, admin_token, citizen):
        r = http.get(f"{API}/admin/applications", params={"q": "Gomez", "status": "pendiente", "page": 1, "page_size": 10},
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d

    def test_detail_status_and_note(self, http, admin_token, citizen):
        # find user's application
        r = http.get(f"{API}/admin/applications", params={"q": citizen["email"], "page_size": 5},
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        app_id = items[0]["application_id"]

        r = http.get(f"{API}/admin/applications/{app_id}", headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200

        r = http.patch(f"{API}/admin/applications/{app_id}/status", json={"status": "en_revision", "nota": "Test"},
                       headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "en_revision"

        r = http.post(f"{API}/admin/applications/{app_id}/notes", json={"texto": "Nota TEST"},
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        assert any(n["texto"] == "Nota TEST" for n in r.json()["notas_internas"])

    def test_export_csv(self, http, admin_token):
        r = http.get(f"{API}/admin/export/csv", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()

    def test_export_xlsx(self, http, admin_token):
        r = http.get(f"{API}/admin/export/xlsx", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")


# ---------- OCR ----------
class TestOCR:
    def test_ocr_extract(self, citizen, pdf_bytes):
        files = {"file": ("RD001.pdf", pdf_bytes, "application/pdf")}
        r = requests.post(
            f"{API}/ocr/extract",
            headers={"Authorization": f"Bearer {citizen['token']}"},
            files=files,
            timeout=180,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["provider"] in ("gemini-3.1-pro-preview", "claude-sonnet-4-5")
        assert "data" in d
        assert "titular1" in d["data"]

    def test_admin_ocr_register(self, admin_token, pdf_bytes):
        files = {"file": ("RD001.pdf", pdf_bytes, "application/pdf")}
        r = requests.post(
            f"{API}/admin/ocr/register",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            timeout=180,
        )
        # First time: 200; if same email already has application: 400
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            body = r.json()
            assert body["application"]["numero_registro"].startswith("SF-")
            assert body["provider"] in ("gemini-3.1-pro-preview", "claude-sonnet-4-5")
