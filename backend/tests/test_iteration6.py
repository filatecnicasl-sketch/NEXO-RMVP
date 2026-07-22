"""
Iteration 6 — Subsanaciones (Amendment) flow tests.

Coverage:
- Citizen creates a subsanacion via POST /api/applications/me/subsanaciones with proposed_data + motivo
- Citizen cannot create subsanacion if no application exists (404)
- Citizen cannot create empty motivo (400)
- Citizen cannot create second subsanacion while one is pendiente (400)
- Citizen lists own subsanaciones GET /api/applications/me/subsanaciones
- Admin lists subsanaciones by application_id GET /api/admin/applications/{app_id}/subsanaciones
- Citizen cannot call admin endpoints (403)
- Admin approves POST /api/admin/subsanaciones/{id}/approve -> status='aprobada', application fields updated, score recomputed, notification created
- Admin rejects POST /api/admin/subsanaciones/{id}/reject with motivo -> status='rechazada', notification created
- Approving an already-resolved subsanacion returns 400
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vivienda-protegida.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@hemsa.es"
ADMIN_PASSWORD = "AdminHemsa2026!"


# ---------- Fixtures ----------
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
    email = f"iter6_{uuid.uuid4().hex[:8]}@example.com"
    pw = "TestCiudadano2026!"
    r = http.post(f"{API}/auth/citizen/register", json={"name": "Iter6 Test", "email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": pw, "token": data["token"], "user_id": data["user"]["user_id"]}


def _app_payload(email: str, telefono: str = "600111222", grupos=None):
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
        "titular2": None,
        "otros_miembros": [],
        "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"]},
        "justificacion": {"casillas": grupos},
        "declaracion": {"motivo_propiedad": "", "inscripcion_otros_municipios": "", "preferencia_en": "San Fernando", "autoriza_email": True, "autoriza_sms": True},
    }


def _create_app(http, citizen, **kwargs):
    r = http.post(
        f"{API}/applications",
        json=_app_payload(citizen["email"], **kwargs),
        headers={"Authorization": f"Bearer {citizen['token']}"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _advance_to_review(http, admin_token, application_id, status="en_revision"):
    """Move an application from 'pendiente' to a state where subsanaciones are allowed."""
    r = http.patch(
        f"{API}/admin/applications/{application_id}/status",
        json={"status": status, "nota": "test setup"},
        headers={"Authorization": f"Bearer {admin_token}"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Citizen creates subsanacion ----------
class TestCitizenCreateSubsanacion:
    def test_no_application_returns_404(self, http):
        c = _new_citizen(http)
        payload = {"motivo": "cambio email", "proposed_data": _app_payload(c["email"])}
        r = http.post(f"{API}/applications/me/subsanaciones", json=payload,
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 404
        assert "solicitud" in r.json().get("detail", "").lower()

    def test_empty_motivo_returns_400(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c)
        _advance_to_review(http, admin_token, app["application_id"])
        payload = {"motivo": "   ", "proposed_data": _app_payload(c["email"])}
        r = http.post(f"{API}/applications/me/subsanaciones", json=payload,
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 400

    def test_pendiente_blocks_subsanacion(self, http):
        """Defense-in-depth: pendiente apps must be edited directly, not via subsanacion."""
        c = _new_citizen(http)
        _create_app(http, c)
        payload = {"motivo": "intento cambiar algo", "proposed_data": _app_payload(c["email"])}
        r = http.post(f"{API}/applications/me/subsanaciones", json=payload,
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 400
        assert "pendiente" in r.json()["detail"].lower()

    def test_create_subsanacion_ok(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c)
        _advance_to_review(http, admin_token, app["application_id"])
        proposed = _app_payload(c["email"], telefono="699888777")
        r = http.post(f"{API}/applications/me/subsanaciones",
                      json={"motivo": "Quiero actualizar mi telefono y email", "proposed_data": proposed},
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pendiente"
        assert d["application_id"] == app["application_id"]
        assert d["user_id"] == c["user_id"]
        assert d["motivo"] == "Quiero actualizar mi telefono y email"
        assert d["proposed_data"]["titular1"]["telefono_movil"] == "699888777"
        assert d["subsanacion_id"].startswith("subs_")
        assert d.get("admin_response") is None

    def test_pending_subsanacion_blocks_new_one(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c)
        _advance_to_review(http, admin_token, app["application_id"])
        body = {"motivo": "cambio1", "proposed_data": _app_payload(c["email"])}
        r1 = http.post(f"{API}/applications/me/subsanaciones", json=body,
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r1.status_code == 200
        r2 = http.post(f"{API}/applications/me/subsanaciones", json=body,
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r2.status_code == 400
        assert "pendiente" in r2.json()["detail"].lower()

    def test_citizen_list_subsanaciones(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c)
        _advance_to_review(http, admin_token, app["application_id"])
        http.post(f"{API}/applications/me/subsanaciones",
                  json={"motivo": "x", "proposed_data": _app_payload(c["email"])},
                  headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        r = http.get(f"{API}/applications/me/subsanaciones",
                     headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1
        assert all(it["user_id"] == c["user_id"] for it in items)


# ---------- Authorization ----------
class TestSubsanacionAuthorization:
    def test_citizen_cannot_list_admin_endpoint(self, http):
        c = _new_citizen(http)
        app = _create_app(http, c)
        r = http.get(f"{API}/admin/applications/{app['application_id']}/subsanaciones",
                     headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 403

    def test_citizen_cannot_approve(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c)
        _advance_to_review(http, admin_token, app["application_id"])
        sr = http.post(f"{API}/applications/me/subsanaciones",
                       json={"motivo": "x", "proposed_data": _app_payload(c["email"])},
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        sid = sr.json()["subsanacion_id"]
        r = http.post(f"{API}/admin/subsanaciones/{sid}/approve",
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 403

    def test_citizen_cannot_reject(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c)
        _advance_to_review(http, admin_token, app["application_id"])
        sr = http.post(f"{API}/applications/me/subsanaciones",
                       json={"motivo": "x", "proposed_data": _app_payload(c["email"])},
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        sid = sr.json()["subsanacion_id"]
        r = http.post(f"{API}/admin/subsanaciones/{sid}/reject",
                      json={"motivo": "n/a"},
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert r.status_code == 403


# ---------- Admin approve / reject ----------
class TestAdminResolveSubsanacion:
    def test_admin_lists_by_app(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c)
        _advance_to_review(http, admin_token, app["application_id"])
        http.post(f"{API}/applications/me/subsanaciones",
                  json={"motivo": "cambio", "proposed_data": _app_payload(c["email"])},
                  headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        r = http.get(f"{API}/admin/applications/{app['application_id']}/subsanaciones",
                     headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        assert items[0]["application_id"] == app["application_id"]

    def test_admin_approve_applies_changes_and_notifies(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c, telefono="600000000")
        _advance_to_review(http, admin_token, app["application_id"])
        # Propose change: new phone + extra group
        proposed = _app_payload(c["email"], telefono="611222333", grupos=["JOV", "DES"])
        sr = http.post(f"{API}/applications/me/subsanaciones",
                       json={"motivo": "Actualizar telefono y grupos", "proposed_data": proposed},
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert sr.status_code == 200
        sid = sr.json()["subsanacion_id"]

        # Approve
        r = http.post(f"{API}/admin/subsanaciones/{sid}/approve",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200, r.text
        approved = r.json()
        assert approved["status"] == "aprobada"
        assert approved.get("admin_response_at")
        assert approved.get("admin_response_by")

        # Verify application updated
        ga = http.get(f"{API}/applications/me",
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert ga.status_code == 200
        appd = ga.json()
        assert appd["titular1"]["telefono_movil"] == "611222333"
        assert set(appd["titular1"]["grupos_acreditacion"]) >= {"JOV", "DES"}
        # historial must include subsanacion_aprobada event
        events = [h.get("event") for h in appd.get("historial", [])]
        assert "subsanacion_solicitada" in events
        assert "subsanacion_aprobada" in events
        # score must be present (recomputed)
        assert "score" in appd

        # Verify citizen got a success notification
        nr = http.get(f"{API}/notifications",
                      headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        assert nr.status_code == 200
        notifs = nr.json()
        titles = [n.get("title", "") + " " + n.get("titulo", "") for n in (notifs if isinstance(notifs, list) else notifs.get("items", []))]
        assert any("aprobada" in (t or "").lower() or "subsanaci" in (t or "").lower() for t in titles), notifs

        # Re-approving must fail
        r2 = http.post(f"{API}/admin/subsanaciones/{sid}/approve",
                       headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r2.status_code == 400

    def test_admin_reject_with_motivo(self, http, admin_token):
        c = _new_citizen(http)
        app = _create_app(http, c)
        _advance_to_review(http, admin_token, app["application_id"])
        sr = http.post(f"{API}/applications/me/subsanaciones",
                       json={"motivo": "cambio menor", "proposed_data": _app_payload(c["email"], telefono="699111222")},
                       headers={"Authorization": f"Bearer {c['token']}"}, timeout=20)
        sid = sr.json()["subsanacion_id"]
        r = http.post(f"{API}/admin/subsanaciones/{sid}/reject",
                      json={"motivo": "Datos insuficientes, aporte justificante"},
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "rechazada"
        assert "Datos insuficientes" in d.get("admin_response", "")
        # Re-rejecting fails
        r2 = http.post(f"{API}/admin/subsanaciones/{sid}/reject",
                       json={"motivo": "x"},
                       headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r2.status_code == 400

    def test_admin_approve_nonexistent_returns_404(self, http, admin_token):
        r = http.post(f"{API}/admin/subsanaciones/subs_nonexistent/approve",
                      headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 404
