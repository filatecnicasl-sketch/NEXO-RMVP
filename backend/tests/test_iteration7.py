"""Iteration 7 — backend tests.

Coverage:
- POST /api/applications/me/subsanaciones rejects with 400 when application is still 'pendiente'
- POST /api/applications/me/subsanaciones accepts when status is en_revision/recepcionada/aprobada/denegada
- POST /api/admin/gdpr/purge-now returns {ok, purged, failed, cutoff, retention_days}, citizens get 403
- POST /api/admin/baremo/recompute-all returns {ok, updated:<N>} and updates all docs
- Manual signature pushes into firmas_ciudadano list; firma_ciudadano (singular) keeps last entry
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hemsa.es"
ADMIN_PASSWORD = "AdminHemsa2026!"


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(http):
    r = http.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _new_citizen(http):
    email = f"iter7_{uuid.uuid4().hex[:8]}@example.com"
    pw = "TestCiudadano2026!"
    r = http.post(f"{API}/auth/citizen/register", json={"name": "Iter7", "email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "password": pw, "token": d["token"], "user_id": d["user"]["user_id"]}


def _app_payload(email, telefono="600111222", grupos=None):
    if grupos is None:
        grupos = ["JOV"]
    return {
        "titular1": {
            "nombre": "Maria", "apellido1": "Lopez", "apellido2": "Garcia",
            "sexo": "F", "tipo_documento": "DNI", "numero_documento": "12345678Z",
            "nacionalidad": "Española", "fecha_nacimiento": "01/01/1990",
            "empadronado_en": "San Fernando", "direccion": "Calle Real 1",
            "domicilio": "San Fernando", "telefono_fijo": "", "telefono_movil": telefono,
            "codigo_postal": "11100", "email": email, "ingresos_economicos": 12000,
            "tipo_declaracion_irpf": "INDIVIDUAL", "anio_ingresos": 2024,
            "grupos_acreditacion": grupos,
        },
        "titular2": None, "otros_miembros": [],
        "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"]},
        "justificacion": {"casillas": grupos},
        "declaracion": {"motivo_propiedad": "", "inscripcion_otros_municipios": "", "preferencia_en": "San Fernando", "autoriza_email": True, "autoriza_sms": True},
    }


def _create_app(http, citizen, **kw):
    r = http.post(f"{API}/applications", json=_app_payload(citizen["email"], **kw),
                  headers={"Authorization": f"Bearer {citizen['token']}"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _set_status(http, admin_token, application_id, status):
    r = http.patch(f"{API}/admin/applications/{application_id}/status",
                   json={"status": status, "nota": "iter7"},
                   headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    assert r.status_code == 200, r.text


# ---------- (a) subsanacion blocked on pendiente ----------
class TestSubsanacionPendienteGuard:
    def test_pendiente_blocks_subsanacion(self, http):
        c = _new_citizen(http)
        _create_app(http, c)
        r = http.post(f"{API}/applications/me/subsanaciones",
                      json={"motivo": "intento", "proposed_data": _app_payload(c["email"])},
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 400
        assert "pendiente" in r.json()["detail"].lower()

    @pytest.mark.parametrize("status", ["en_revision", "recepcionada", "aprobada", "denegada"])
    def test_non_pendiente_allows_subsanacion(self, http, admin_token, status):
        c = _new_citizen(http)
        app = _create_app(http, c)
        _set_status(http, admin_token, app["application_id"], status)
        r = http.post(f"{API}/applications/me/subsanaciones",
                      json={"motivo": f"cambio bajo {status}", "proposed_data": _app_payload(c["email"], telefono="699999000")},
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 200, f"status={status} -> {r.status_code} {r.text}"
        d = r.json()
        assert d["status"] == "pendiente"  # the SUBSANACION itself is pendiente


# ---------- (b) GDPR purge endpoint ----------
class TestGdprPurgeNow:
    def test_admin_can_trigger_purge(self, http, admin_token):
        r = http.post(f"{API}/admin/gdpr/purge-now",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "purged" in d and isinstance(d["purged"], int)
        assert "failed" in d and isinstance(d["failed"], int)
        assert "cutoff" in d and isinstance(d["cutoff"], str)
        assert d.get("retention_days") == 30

    def test_citizen_cannot_trigger_purge(self, http):
        c = _new_citizen(http)
        r = http.post(f"{API}/admin/gdpr/purge-now",
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 403


# ---------- (c) baremo recompute-all ----------
class TestRecomputeAll:
    def test_recompute_all_updates_all_applications(self, http, admin_token):
        # create 3 fresh apps so we know there is at least 3 to update
        n_new = 3
        for _ in range(n_new):
            c = _new_citizen(http)
            _create_app(http, c)
        r = http.post(f"{API}/admin/baremo/recompute-all",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert isinstance(d.get("updated"), int)
        assert d["updated"] >= n_new

    def test_recompute_actually_persists_score(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c)
        r = http.post(f"{API}/admin/baremo/recompute-all",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=60)
        assert r.status_code == 200
        # fetch the application and check score field
        g = http.get(f"{API}/applications/me",
                     headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert g.status_code == 200
        d = g.json()
        assert "score" in d
        assert isinstance(d["score"], (int, float))


# ---------- (d) firmas_ciudadano list (multi-signer history) ----------
class TestFirmasCiudadanoList:
    def test_manual_sign_pushes_into_firmas_list(self, http):
        c = _new_citizen(http)
        app = _create_app(http, c)
        # first signature: manual
        r1 = http.post(f"{API}/applications/me/sign-citizen-manual",
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r1.status_code == 200, r1.text
        # verify GET /applications/me returns firmas_ciudadano list
        g = http.get(f"{API}/applications/me",
                     headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert g.status_code == 200
        d = g.json()
        firmas = d.get("firmas_ciudadano")
        assert isinstance(firmas, list), f"firmas_ciudadano should be a list, got: {type(firmas)} {firmas}"
        assert len(firmas) >= 1
        # singular firma_ciudadano backward-compat: present and reflects last
        sing = d.get("firma_ciudadano")
        assert isinstance(sing, dict) and sing.get("firmado") is True

    def test_second_manual_sign_blocked_after_fnmt_but_list_grows_on_subsequent_manual(self, http):
        """Two manual signatures should both be appended into firmas_ciudadano list.
        The endpoint only blocks if there's already an FNMT-signed entry."""
        c = _new_citizen(http)
        _create_app(http, c)
        r1 = http.post(f"{API}/applications/me/sign-citizen-manual",
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r1.status_code == 200
        r2 = http.post(f"{API}/applications/me/sign-citizen-manual",
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        # current code only blocks if existing.fnmt==True, so 2nd manual is allowed
        assert r2.status_code == 200, r2.text
        g = http.get(f"{API}/applications/me",
                     headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        firmas = g.json().get("firmas_ciudadano", [])
        assert isinstance(firmas, list)
        assert len(firmas) >= 2, f"expected at least 2 firmas, got {len(firmas)}"
