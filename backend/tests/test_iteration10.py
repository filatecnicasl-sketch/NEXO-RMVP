"""
Iteration 10 — Admin sub-levels (gerente / administracion / lector).

Coverage:
- New admin levels can be created by gerente and rejected from other levels
- Lector cannot perform write operations (status, notes, subsanaciones, etc.)
- Administracion can do day-to-day operations BUT not sign, configure baremo,
  adjust score, manage users, or trigger GDPR purge
- Gerente can do everything
- The seed admin@hemsa.es is always 'gerente' (idempotent migration)
- Cannot demote the last gerente
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vivienda-protegida.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

GERENTE_EMAIL = "admin@hemsa.es"
GERENTE_PASSWORD = "AdminHemsa2026!"


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def gerente_token(http):
    r = http.post(f"{API}/auth/admin/login", json={"email": GERENTE_EMAIL, "password": GERENTE_PASSWORD}, timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["admin_level"] == "gerente"
    return body["token"]


def _create_admin(http, gerente_token, level):
    email = f"iter10_{level}_{uuid.uuid4().hex[:6]}@hemsa.es"
    password = "TestAdmin2026!"
    r = http.post(f"{API}/admin/users",
                  json={"name": f"Test {level}", "email": email, "password": password, "role": "admin", "admin_level": level},
                  headers={"Authorization": f"Bearer {gerente_token}"}, timeout=20)
    assert r.status_code == 200, r.text
    # login as this new admin
    lr = http.post(f"{API}/auth/admin/login", json={"email": email, "password": password}, timeout=20)
    assert lr.status_code == 200
    return {"user_id": r.json()["user_id"], "email": email, "token": lr.json()["token"], "level": level}


def _pick_app_id(http, token):
    r = http.get(f"{API}/admin/applications?page_size=1", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    items = r.json().get("items", [])
    return items[0]["application_id"] if items else None


class TestSeedGerente:
    def test_seed_admin_is_gerente(self, http, gerente_token):
        me = http.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {gerente_token}"}, timeout=20).json()
        assert me["role"] == "admin"
        assert me["admin_level"] == "gerente"


class TestLectorRestrictions:
    def test_lector_can_read(self, http, gerente_token):
        lector = _create_admin(http, gerente_token, "lector")
        r = http.get(f"{API}/admin/applications", headers={"Authorization": f"Bearer {lector['token']}"}, timeout=20)
        assert r.status_code == 200

    def test_lector_cannot_change_status(self, http, gerente_token):
        lector = _create_admin(http, gerente_token, "lector")
        app_id = _pick_app_id(http, lector["token"])
        if not app_id:
            pytest.skip("No applications available")
        r = http.patch(f"{API}/admin/applications/{app_id}/status",
                       json={"status": "en_revision"},
                       headers={"Authorization": f"Bearer {lector['token']}"}, timeout=20)
        assert r.status_code == 403
        assert "lectura" in r.json()["detail"].lower()

    def test_lector_cannot_add_note(self, http, gerente_token):
        lector = _create_admin(http, gerente_token, "lector")
        app_id = _pick_app_id(http, lector["token"])
        if not app_id:
            pytest.skip("No applications available")
        r = http.post(f"{API}/admin/applications/{app_id}/notes",
                      json={"texto": "intento"},
                      headers={"Authorization": f"Bearer {lector['token']}"}, timeout=20)
        assert r.status_code == 403

    def test_lector_cannot_create_users(self, http, gerente_token):
        lector = _create_admin(http, gerente_token, "lector")
        r = http.post(f"{API}/admin/users",
                      json={"name": "X", "email": f"x_{uuid.uuid4().hex[:6]}@ex.com", "password": "Xxx12345!", "role": "admin"},
                      headers={"Authorization": f"Bearer {lector['token']}"}, timeout=20)
        assert r.status_code == 403


class TestAdministracionScope:
    def test_administracion_can_change_status(self, http, gerente_token):
        admin = _create_admin(http, gerente_token, "administracion")
        app_id = _pick_app_id(http, admin["token"])
        if not app_id:
            pytest.skip("No applications available")
        r = http.patch(f"{API}/admin/applications/{app_id}/status",
                       json={"status": "en_revision"},
                       headers={"Authorization": f"Bearer {admin['token']}"}, timeout=20)
        assert r.status_code == 200

    def test_administracion_cannot_create_admins(self, http, gerente_token):
        admin = _create_admin(http, gerente_token, "administracion")
        r = http.post(f"{API}/admin/users",
                      json={"name": "Z", "email": f"z_{uuid.uuid4().hex[:6]}@ex.com", "password": "Xxx12345!", "role": "admin"},
                      headers={"Authorization": f"Bearer {admin['token']}"}, timeout=20)
        assert r.status_code == 403
        assert "gerencia" in r.json()["detail"].lower()

    def test_administracion_cannot_set_baremo(self, http, gerente_token):
        admin = _create_admin(http, gerente_token, "administracion")
        cfg = http.get(f"{API}/admin/baremo-config", headers={"Authorization": f"Bearer {admin['token']}"}, timeout=20)
        assert cfg.status_code == 200  # read OK
        r = http.put(f"{API}/admin/baremo-config",
                     json=cfg.json()["config"],
                     headers={"Authorization": f"Bearer {admin['token']}"}, timeout=20)
        assert r.status_code == 403

    def test_administracion_cannot_purge_gdpr(self, http, gerente_token):
        admin = _create_admin(http, gerente_token, "administracion")
        r = http.post(f"{API}/admin/gdpr/purge-now", headers={"Authorization": f"Bearer {admin['token']}"}, timeout=20)
        assert r.status_code == 403


class TestGerenteSafety:
    def test_cannot_demote_last_gerente(self, http, gerente_token):
        me = http.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {gerente_token}"}, timeout=20).json()
        # Count gerentes
        users = http.get(f"{API}/admin/users?role=admin&limit=500", headers={"Authorization": f"Bearer {gerente_token}"}, timeout=20).json()
        gerentes = [u for u in users["items"] if u.get("admin_level") == "gerente" and not u.get("disabled")]
        if len(gerentes) > 1:
            pytest.skip("More than one gerente — guard does not trigger")
        # Try to demote self
        r = http.patch(f"{API}/admin/users/{me['user_id']}",
                       json={"admin_level": "administracion"},
                       headers={"Authorization": f"Bearer {gerente_token}"}, timeout=20)
        assert r.status_code == 400
        assert "gerente" in r.json()["detail"].lower()

    def test_gerente_can_create_lector_and_then_promote(self, http, gerente_token):
        lector = _create_admin(http, gerente_token, "lector")
        # Promote to administracion
        r = http.patch(f"{API}/admin/users/{lector['user_id']}",
                       json={"admin_level": "administracion"},
                       headers={"Authorization": f"Bearer {gerente_token}"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["admin_level"] == "administracion"
