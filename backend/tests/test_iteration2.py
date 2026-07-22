"""
Iteration 2 backend tests: PDF download, Attachments (object storage),
Baremo (score), Email notification code path.

Reuses fixtures from backend_test.py (admin_token, citizen) via conftest.
"""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vivienda-protegida.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hemsa.es"
ADMIN_PASSWORD = "AdminHemsa2026!"


# ----- local fixtures (independent run) -----
@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    return s


@pytest.fixture(scope="module")
def admin_token(http):
    r = http.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def citizen_with_app(http):
    """A citizen with score-rich application."""
    email = f"test_baremo_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "TestPwd2026!"
    r = http.post(f"{API}/auth/citizen/register",
                  json={"name": "Baremo User", "email": email, "password": pwd}, timeout=20)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    user_id = r.json()["user"]["user_id"]

    payload = {
        "titular1": {
            "nombre": "Ana", "apellido1": "Score", "apellido2": "Test",
            "sexo": "F", "tipo_documento": "DNI", "numero_documento": "11111111H",
            "nacionalidad": "Española", "fecha_nacimiento": "01/01/1980",
            "empadronado_en": "San Fernando", "direccion": "Calle Score 1",
            "domicilio": "San Fernando", "telefono_fijo": "", "telefono_movil": "611222333",
            "codigo_postal": "11100", "email": email, "ingresos_economicos": 7000,
            "tipo_declaracion_irpf": "INDIVIDUAL", "anio_ingresos": 2024,
            "grupos_acreditacion": [],
        },
        "titular2": None,
        "otros_miembros": [],
        "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"], "silla_ruedas": True},
        "justificacion": {"casillas": ["DIS", "VVG"]},
        "declaracion": {"motivo_propiedad": "", "inscripcion_otros_municipios": "",
                        "preferencia_en": "San Fernando", "autoriza_email": True, "autoriza_sms": True},
    }
    r = http.post(f"{API}/applications", json=payload,
                  headers={"Authorization": f"Bearer {token}"}, timeout=30)
    assert r.status_code == 200, r.text
    app = r.json()
    return {"email": email, "password": pwd, "token": token, "user_id": user_id, "app": app}


def _tiny_pdf_bytes() -> bytes:
    # Minimal valid PDF
    return (b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
            b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]>>endobj\n"
            b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n"
            b"0000000053 00000 n \n0000000099 00000 n \n"
            b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF\n")


# ---------- P2 Baremo ----------
class TestBaremo:
    def test_application_has_score(self, citizen_with_app):
        app = citizen_with_app["app"]
        assert "score" in app and isinstance(app["score"], (int, float))
        # casillas DIS(20) + VVG(25) + silla_ruedas(15) + ingresos<8000(20) = 80
        assert app["score"] >= 70, f"Expected score>=70, got {app['score']}"
        assert "score_breakdown" in app
        assert isinstance(app["score_breakdown"], list) and len(app["score_breakdown"]) >= 3
        labels = " ".join([str(b.get("label", "")) for b in app["score_breakdown"]])
        assert "VVG" in labels or "DIS" in labels or "Casilla" in labels

    def test_admin_recompute_score(self, http, admin_token, citizen_with_app):
        app_id = citizen_with_app["app"]["application_id"]
        r = http.post(f"{API}/admin/applications/{app_id}/recompute-score",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "score" in d and d["score"] == citizen_with_app["app"]["score"]
        assert "score_breakdown" in d

    def test_admin_list_includes_score(self, http, admin_token, citizen_with_app):
        r = http.get(f"{API}/admin/applications", params={"q": citizen_with_app["email"], "page_size": 5},
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        assert "score" in items[0]


# ---------- P0 PDF ----------
class TestPDF:
    def test_citizen_pdf_download(self, http, citizen_with_app):
        r = http.get(f"{API}/applications/me/pdf",
                     headers={"Authorization": f"Bearer {citizen_with_app['token']}"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF-")
        assert len(r.content) > 1000

    def test_citizen_pdf_404_when_no_app(self, http):
        email = f"nopdf_{uuid.uuid4().hex[:8]}@example.com"
        rr = http.post(f"{API}/auth/citizen/register",
                       json={"name": "No App", "email": email, "password": "Pwd2026!"}, timeout=20)
        assert rr.status_code == 200
        tok = rr.json()["token"]
        r = http.get(f"{API}/applications/me/pdf",
                     headers={"Authorization": f"Bearer {tok}"}, timeout=20)
        assert r.status_code == 404

    def test_admin_pdf_download(self, http, admin_token, citizen_with_app):
        app_id = citizen_with_app["app"]["application_id"]
        r = http.get(f"{API}/admin/applications/{app_id}/pdf",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF-")


# ---------- P1 Attachments ----------
class TestAttachments:
    @pytest.fixture(scope="class")
    def uploaded_attachment(self, citizen_with_app):
        app_id = citizen_with_app["app"]["application_id"]
        files = {"file": ("doc.pdf", _tiny_pdf_bytes(), "application/pdf")}
        r = requests.post(
            f"{API}/applications/{app_id}/attachments",
            params={"categoria": "dni"},
            headers={"Authorization": f"Bearer {citizen_with_app['token']}"},
            files=files, timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("attachment_id", "storage_path", "original_filename", "size", "content_type"):
            assert k in data, f"Missing key {k} in {data}"
        assert data["original_filename"] == "doc.pdf"
        assert data["content_type"] == "application/pdf"
        return data

    def test_upload_attachment_ok(self, uploaded_attachment):
        assert uploaded_attachment["attachment_id"].startswith("att_")

    def test_reject_invalid_mime(self, citizen_with_app):
        app_id = citizen_with_app["app"]["application_id"]
        files = {"file": ("bad.exe", b"MZ\x90\x00", "application/x-msdownload")}
        r = requests.post(f"{API}/applications/{app_id}/attachments",
                          params={"categoria": "otros"},
                          headers={"Authorization": f"Bearer {citizen_with_app['token']}"},
                          files=files, timeout=30)
        assert r.status_code == 400

    def test_reject_oversize(self, citizen_with_app):
        app_id = citizen_with_app["app"]["application_id"]
        big = b"%PDF-" + b"x" * (16 * 1024 * 1024)
        files = {"file": ("big.pdf", big, "application/pdf")}
        r = requests.post(f"{API}/applications/{app_id}/attachments",
                          params={"categoria": "otros"},
                          headers={"Authorization": f"Bearer {citizen_with_app['token']}"},
                          files=files, timeout=120)
        assert r.status_code == 400

    def test_citizen_cannot_upload_to_other_app(self, http, citizen_with_app):
        # create second citizen and attempt upload to first citizen's app
        email = f"other_{uuid.uuid4().hex[:8]}@example.com"
        rr = http.post(f"{API}/auth/citizen/register",
                       json={"name": "Other", "email": email, "password": "Pwd2026!"}, timeout=20)
        assert rr.status_code == 200
        tok = rr.json()["token"]
        app_id = citizen_with_app["app"]["application_id"]
        files = {"file": ("doc.pdf", _tiny_pdf_bytes(), "application/pdf")}
        r = requests.post(f"{API}/applications/{app_id}/attachments",
                          params={"categoria": "otros"},
                          headers={"Authorization": f"Bearer {tok}"},
                          files=files, timeout=30)
        assert r.status_code == 403

    def test_admin_can_upload_to_any(self, http, admin_token, citizen_with_app):
        app_id = citizen_with_app["app"]["application_id"]
        files = {"file": ("admin.pdf", _tiny_pdf_bytes(), "application/pdf")}
        r = requests.post(f"{API}/applications/{app_id}/attachments",
                          params={"categoria": "otros"},
                          headers={"Authorization": f"Bearer {admin_token}"},
                          files=files, timeout=60)
        assert r.status_code == 200

    def test_list_excludes_deleted(self, http, citizen_with_app, uploaded_attachment):
        app_id = citizen_with_app["app"]["application_id"]
        r = http.get(f"{API}/applications/{app_id}/attachments",
                     headers={"Authorization": f"Bearer {citizen_with_app['token']}"}, timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert any(it["attachment_id"] == uploaded_attachment["attachment_id"] for it in items)
        for it in items:
            assert it.get("is_deleted") is False

    def test_download_attachment(self, http, citizen_with_app, uploaded_attachment):
        r = http.get(f"{API}/attachments/{uploaded_attachment['attachment_id']}/download",
                     headers={"Authorization": f"Bearer {citizen_with_app['token']}"}, timeout=60)
        assert r.status_code == 200, r.text
        assert r.content.startswith(b"%PDF-")

    def test_delete_attachment_softdelete(self, http, citizen_with_app, uploaded_attachment):
        app_id = citizen_with_app["app"]["application_id"]
        att_id = uploaded_attachment["attachment_id"]
        r = http.delete(f"{API}/attachments/{att_id}",
                        headers={"Authorization": f"Bearer {citizen_with_app['token']}"}, timeout=20)
        assert r.status_code == 200
        # verify excluded
        r2 = http.get(f"{API}/applications/{app_id}/attachments",
                      headers={"Authorization": f"Bearer {citizen_with_app['token']}"}, timeout=20)
        assert r2.status_code == 200
        assert not any(it["attachment_id"] == att_id for it in r2.json())


# ---------- P1 Email (best-effort: no 500 on application create or status change) ----------
class TestEmailCodePath:
    def test_create_application_does_not_500(self, http):
        # creating a fresh citizen + app exercises notify_application_created path
        email = f"mail_{uuid.uuid4().hex[:8]}@example.com"
        r = http.post(f"{API}/auth/citizen/register",
                      json={"name": "Mail Test", "email": email, "password": "Pwd2026!"}, timeout=20)
        assert r.status_code == 200
        token = r.json()["token"]
        payload = {
            "titular1": {
                "nombre": "Mar", "apellido1": "Mail", "apellido2": "Test",
                "sexo": "F", "tipo_documento": "DNI", "numero_documento": "22222222H",
                "nacionalidad": "Española", "fecha_nacimiento": "01/01/1985",
                "empadronado_en": "San Fernando", "direccion": "C/ Mail 2",
                "domicilio": "San Fernando", "telefono_fijo": "", "telefono_movil": "600111222",
                "codigo_postal": "11100", "email": email, "ingresos_economicos": 12000,
                "tipo_declaracion_irpf": "INDIVIDUAL", "anio_ingresos": 2024,
                "grupos_acreditacion": [],
            },
            "titular2": None, "otros_miembros": [],
            "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"]},
            "justificacion": {"casillas": ["JOV"]},
            "declaracion": {"motivo_propiedad": "", "inscripcion_otros_municipios": "",
                            "preferencia_en": "San Fernando", "autoriza_email": True, "autoriza_sms": True},
        }
        rr = http.post(f"{API}/applications", json=payload,
                       headers={"Authorization": f"Bearer {token}"}, timeout=45)
        assert rr.status_code == 200, rr.text
        return rr.json()["application_id"]

    def test_status_change_does_not_500(self, http, admin_token, citizen_with_app):
        app_id = citizen_with_app["app"]["application_id"]
        r = http.patch(f"{API}/admin/applications/{app_id}/status",
                       json={"status": "aprobada", "nota": "Email test"},
                       headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "aprobada"
