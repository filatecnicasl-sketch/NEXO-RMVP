"""
Iteration 9 — RGPD Art. 20 data portability export.

Coverage:
- 404 when no application
- 200 ZIP for authenticated citizen with an application
- ZIP contains expediente.json, README.txt, resguardo.pdf
- expediente.json has expected top-level keys and NO password_hash
- export contains alegaciones and subsanaciones the citizen created
- requires authentication (401 without token)
"""
import io
import json
import os
import uuid
import zipfile
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vivienda-protegida.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hemsa.es"
ADMIN_PASSWORD = "AdminHemsa2026!"


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _new_citizen(http):
    email = f"iter9_{uuid.uuid4().hex[:8]}@example.com"
    r = http.post(f"{API}/auth/citizen/register",
                  json={"name": "Iter9", "email": email, "password": "TestPass2026!"},
                  timeout=20)
    assert r.status_code == 200, r.text
    return {"email": email, "token": r.json()["token"], "user_id": r.json()["user"]["user_id"]}


def _app_payload(email):
    return {
        "titular1": {
            "nombre": "Test", "apellido1": "Export", "email": email,
            "numero_documento": "00000000T", "ingresos_economicos": 15000,
        },
        "otros_miembros": [],
        "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"]},
        "justificacion": {"casillas": ["DES"]},
        "declaracion": {"autoriza_email": True},
    }


class TestExport:
    def test_unauthenticated_returns_401(self, http):
        r = http.get(f"{API}/applications/me/export", timeout=20)
        # Reset header-state since the session uses Content-Type but no Authorization
        assert r.status_code in (401, 403)

    def test_no_application_returns_404(self, http):
        c = _new_citizen(http)
        r = http.get(f"{API}/applications/me/export",
                     headers={"Authorization": f"Bearer {c['token']}"}, timeout=30)
        assert r.status_code == 404

    def test_export_returns_zip_with_expected_files(self, http):
        c = _new_citizen(http)
        ar = http.post(f"{API}/applications", json=_app_payload(c["email"]),
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=30)
        assert ar.status_code == 200, ar.text

        r = http.get(f"{API}/applications/me/export",
                     headers={"Authorization": f"Bearer {c['token']}"}, timeout=60)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/zip")
        z = zipfile.ZipFile(io.BytesIO(r.content))
        names = set(z.namelist())
        assert "expediente.json" in names
        assert "README.txt" in names
        assert "resguardo.pdf" in names

        bundle = json.loads(z.read("expediente.json").decode("utf-8"))
        assert set(bundle.keys()) >= {"meta", "usuario", "solicitud", "alegaciones", "subsanaciones", "notificaciones", "adjuntos_metadatos"}
        # Sensitive fields must be scrubbed
        assert "password_hash" not in bundle["usuario"]
        # Meta must reference RGPD
        assert "RGPD" in bundle["meta"]["regulation"]
        # Solicitud carries the registry number
        assert bundle["solicitud"]["numero_registro"].startswith("SF-")

    def test_export_includes_alegacion_and_subsanacion(self, http):
        c = _new_citizen(http)
        ar = http.post(f"{API}/applications", json=_app_payload(c["email"]),
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=30)
        application_id = ar.json()["application_id"]

        # Citizen files an alegacion
        al = http.post(f"{API}/applications/me/alegaciones",
                       json={"texto": "Mi alegación de prueba", "attachment_ids": []},
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert al.status_code == 200

        # Admin advances to en_revision so citizen can file a subsanación
        adt = http.post(f"{API}/auth/admin/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20).json()["token"]
        http.patch(f"{API}/admin/applications/{application_id}/status",
                   json={"status": "en_revision", "nota": "iter9"},
                   headers={"Authorization": f"Bearer {adt}"}, timeout=20)

        # Citizen files a subsanación
        sr = http.post(f"{API}/applications/me/subsanaciones",
                       json={"motivo": "Corregir teléfono", "proposed_data": _app_payload(c["email"])},
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert sr.status_code == 200, sr.text

        # Export
        r = http.get(f"{API}/applications/me/export",
                     headers={"Authorization": f"Bearer {c['token']}"}, timeout=60)
        assert r.status_code == 200
        z = zipfile.ZipFile(io.BytesIO(r.content))
        bundle = json.loads(z.read("expediente.json").decode("utf-8"))
        assert len(bundle["alegaciones"]) >= 1
        assert bundle["alegaciones"][0]["texto"].startswith("Mi alegación")
        assert len(bundle["subsanaciones"]) >= 1
        assert bundle["subsanaciones"][0]["motivo"].startswith("Corregir teléfono")
