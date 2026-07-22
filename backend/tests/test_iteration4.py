"""Iteration 4 tests: Alegaciones (bidirectional) + Baremo config + Score adjustment."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@hemsa.es"
ADMIN_PASSWORD = "AdminHemsa2026!"


def _unique_suffix():
    return f"{int(time.time())}_{uuid.uuid4().hex[:6]}"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def citizen_with_app():
    """Register a citizen and create a minimal application; return (token, headers, user_email, app_id)."""
    suffix = _unique_suffix()
    email = f"iter4_{suffix}@example.com"
    pw = "Citizen2026!"
    r = requests.post(f"{API}/auth/citizen/register", json={"name": f"Iter4 {suffix}", "email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    body = {
        "titular1": {
            "nombre": "Iter4", "apellido1": "Test", "numero_documento": "12345678Z",
            "email": email, "ingresos_economicos": 12000,
        },
        "otros_miembros": [],
        "vivienda": {"regimen": ["Alquiler"], "dormitorios": ["2"], "silla_ruedas": False},
        "justificacion": {"casillas": ["VVG"]},
        "declaracion": {"autoriza_email": True, "autoriza_sms": True},
    }
    r2 = requests.post(f"{API}/applications", json=body, headers=h, timeout=30)
    assert r2.status_code == 200, r2.text
    return tok, h, email, r2.json()["application_id"]


@pytest.fixture(scope="module", autouse=True)
def _cleanup_baremo(admin_h):
    """Always reset baremo at the end so other tests get defaults."""
    yield
    try:
        requests.post(f"{API}/admin/baremo-config/reset", headers=admin_h, timeout=15)
    except Exception:
        pass


# ---------- Alegaciones ----------
class TestAlegaciones:
    def test_citizen_create_alegacion_requires_app(self, admin_h):
        suffix = _unique_suffix()
        r = requests.post(
            f"{API}/auth/citizen/register",
            json={"name": "NoApp", "email": f"noapp_{suffix}@example.com", "password": "Pw2026!"},
            timeout=30,
        )
        tok = r.json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        resp = requests.post(f"{API}/applications/me/alegaciones", json={"texto": "hola"}, headers=h, timeout=15)
        assert resp.status_code == 404

    def test_citizen_create_alegacion_empty_text_rejected(self, citizen_with_app):
        _, h, _, _ = citizen_with_app
        resp = requests.post(f"{API}/applications/me/alegaciones", json={"texto": "   "}, headers=h, timeout=15)
        assert resp.status_code == 400

    def test_full_bidirectional_flow(self, citizen_with_app, admin_h):
        _, h, _, app_id = citizen_with_app
        # 1. Create
        resp = requests.post(
            f"{API}/applications/me/alegaciones",
            json={"texto": "No estoy de acuerdo con la valoración."},
            headers=h, timeout=15,
        )
        assert resp.status_code == 200, resp.text
        aleg = resp.json()
        assert aleg["status"] == "enviada"
        assert "alegacion_id" in aleg
        aid = aleg["alegacion_id"]

        # 2. Citizen list
        lst = requests.get(f"{API}/applications/me/alegaciones", headers=h, timeout=15)
        assert lst.status_code == 200
        items = lst.json()
        assert any(a["alegacion_id"] == aid for a in items)

        # 3. Admin list for app
        adm = requests.get(f"{API}/admin/applications/{app_id}/alegaciones", headers=admin_h, timeout=15)
        assert adm.status_code == 200
        assert any(a["alegacion_id"] == aid for a in adm.json())

        # 4. Admin notification was created
        nf = requests.get(f"{API}/notifications", headers=admin_h, timeout=15)
        assert nf.status_code == 200
        titles = [n["title"] for n in nf.json()["items"]]
        assert "Nueva alegación recibida" in titles

        # 5. Admin responds
        rsp = requests.post(
            f"{API}/admin/alegaciones/{aid}/respond",
            json={"texto": "Respuesta del administrador."},
            headers=admin_h, timeout=15,
        )
        assert rsp.status_code == 200
        updated = rsp.json()
        assert updated["status"] == "contestada"
        assert updated["admin_response"] == "Respuesta del administrador."
        assert updated["admin_response_at"] is not None

        # 6. Citizen sees response
        lst2 = requests.get(f"{API}/applications/me/alegaciones", headers=h, timeout=15)
        found = next(a for a in lst2.json() if a["alegacion_id"] == aid)
        assert found["admin_response"] == "Respuesta del administrador."

        # 7. Citizen got notification
        cn = requests.get(f"{API}/notifications", headers=h, timeout=15)
        ctitles = [n["title"] for n in cn.json()["items"]]
        assert "Alegación respondida" in ctitles

    def test_citizen_only_sees_own_alegaciones(self, citizen_with_app):
        _, h1, _, _ = citizen_with_app
        # create alegacion for citizen 1
        requests.post(f"{API}/applications/me/alegaciones", json={"texto": "Mia 1"}, headers=h1, timeout=15)
        # second citizen
        suffix = _unique_suffix()
        r = requests.post(
            f"{API}/auth/citizen/register",
            json={"name": "C2", "email": f"iter4b_{suffix}@example.com", "password": "Pw2026!"},
            timeout=30,
        )
        h2 = {"Authorization": f"Bearer {r.json()['token']}"}
        lst = requests.get(f"{API}/applications/me/alegaciones", headers=h2, timeout=15)
        assert lst.status_code == 200
        assert lst.json() == []

    def test_admin_respond_empty_rejected(self, citizen_with_app, admin_h):
        _, h, _, _ = citizen_with_app
        c = requests.post(f"{API}/applications/me/alegaciones", json={"texto": "Texto"}, headers=h, timeout=15)
        aid = c.json()["alegacion_id"]
        rsp = requests.post(f"{API}/admin/alegaciones/{aid}/respond", json={"texto": "  "}, headers=admin_h, timeout=15)
        assert rsp.status_code == 400

    def test_admin_endpoints_require_admin(self, citizen_with_app):
        _, h, _, app_id = citizen_with_app
        r1 = requests.get(f"{API}/admin/applications/{app_id}/alegaciones", headers=h, timeout=15)
        assert r1.status_code == 403


# ---------- Baremo Config ----------
class TestBaremoConfig:
    def test_get_default(self, admin_h):
        # Reset first to ensure deterministic state
        requests.post(f"{API}/admin/baremo-config/reset", headers=admin_h, timeout=15)
        r = requests.get(f"{API}/admin/baremo-config", headers=admin_h, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["is_default"] is True
        assert "casillas" in data["config"]
        assert data["config"]["casillas"]["VVG"] == 25  # default

    def test_put_custom_and_get_returns_non_default(self, admin_h):
        requests.post(f"{API}/admin/baremo-config/reset", headers=admin_h, timeout=15)
        r = requests.get(f"{API}/admin/baremo-config", headers=admin_h, timeout=15)
        cfg = r.json()["config"]
        cfg["casillas"]["VVG"] = 50
        put = requests.put(f"{API}/admin/baremo-config", json=cfg, headers=admin_h, timeout=15)
        assert put.status_code == 200, put.text
        g2 = requests.get(f"{API}/admin/baremo-config", headers=admin_h, timeout=15)
        d = g2.json()
        assert d["is_default"] is False
        assert d["config"]["casillas"]["VVG"] == 50

    def test_reset_restores_default(self, admin_h):
        # Set custom first
        r = requests.get(f"{API}/admin/baremo-config", headers=admin_h, timeout=15)
        cfg = r.json()["config"]
        cfg["casillas"]["VVG"] = 99
        requests.put(f"{API}/admin/baremo-config", json=cfg, headers=admin_h, timeout=15)
        # Reset
        rst = requests.post(f"{API}/admin/baremo-config/reset", headers=admin_h, timeout=15)
        assert rst.status_code == 200
        g = requests.get(f"{API}/admin/baremo-config", headers=admin_h, timeout=15)
        assert g.json()["is_default"] is True
        assert g.json()["config"]["casillas"]["VVG"] == 25

    def test_compute_score_respects_custom_config(self, admin_h, citizen_with_app):
        _, _, _, app_id = citizen_with_app
        # set VVG=50
        r = requests.get(f"{API}/admin/baremo-config", headers=admin_h, timeout=15)
        cfg = r.json()["config"]
        cfg["casillas"]["VVG"] = 50
        requests.put(f"{API}/admin/baremo-config", json=cfg, headers=admin_h, timeout=15)
        # Recompute
        rec = requests.post(f"{API}/admin/baremo/recompute-all", headers=admin_h, timeout=60)
        assert rec.status_code == 200
        assert "updated" in rec.json()
        assert rec.json()["updated"] >= 1
        # Fetch app, verify breakdown contains 50 for VVG
        a = requests.get(f"{API}/admin/applications/{app_id}", headers=admin_h, timeout=15)
        assert a.status_code == 200
        bd = a.json().get("score_breakdown", [])
        vvg = [b for b in bd if "VVG" in (b.get("concepto", "") + b.get("descripcion", "") + str(b))]
        # breakdown items are usually dicts; at minimum verify total reflects custom weight
        # Compare against default: a default score with VVG=25 + Alquiler — should have VVG line value 50 now
        flat = str(bd)
        assert "50" in flat or any(b.get("puntos") == 50 for b in bd if isinstance(b, dict))
        # cleanup
        requests.post(f"{API}/admin/baremo-config/reset", headers=admin_h, timeout=15)

    def test_recompute_all_returns_updated_count(self, admin_h):
        r = requests.post(f"{API}/admin/baremo/recompute-all", headers=admin_h, timeout=60)
        assert r.status_code == 200
        body = r.json()
        assert "updated" in body
        assert isinstance(body["updated"], int)


# ---------- Score Adjustment ----------
class TestScoreAdjustment:
    def test_apply_positive_adjustment_and_breakdown(self, admin_h, citizen_with_app):
        _, _, _, app_id = citizen_with_app
        before = requests.get(f"{API}/admin/applications/{app_id}", headers=admin_h, timeout=15).json()
        before_score = before["score"]
        rsp = requests.patch(
            f"{API}/admin/applications/{app_id}/score-adjustment",
            json={"points": 7, "reason": "Caso especial"},
            headers=admin_h, timeout=15,
        )
        assert rsp.status_code == 200, rsp.text
        data = rsp.json()
        assert data["score"] == before_score + 7
        flat = str(data["score_breakdown"])
        assert "Ajuste manual" in flat
        assert "Caso especial" in flat
        # Verify persisted
        after = requests.get(f"{API}/admin/applications/{app_id}", headers=admin_h, timeout=15).json()
        assert after["score"] == before_score + 7
        # History event
        events = [e.get("event", "") for e in after.get("historial", [])]
        assert any(ev.startswith("ajuste_baremo:") for ev in events)

    def test_negative_adjustment(self, admin_h, citizen_with_app):
        _, _, _, app_id = citizen_with_app
        before = requests.get(f"{API}/admin/applications/{app_id}", headers=admin_h, timeout=15).json()["score"]
        rsp = requests.patch(
            f"{API}/admin/applications/{app_id}/score-adjustment",
            json={"points": -5, "reason": "Penalización"},
            headers=admin_h, timeout=15,
        )
        assert rsp.status_code == 200
        # Score = baseline (no prev adjustment for this fresh app) + (-5)
        # Note: adjustment replaces the previous one, so it's baseline-5
        assert rsp.json()["score"] == before - 5 if "Ajuste manual" not in str(before) else True

    def test_score_adjustment_404_unknown_app(self, admin_h):
        rsp = requests.patch(
            f"{API}/admin/applications/app_doesnotexist/score-adjustment",
            json={"points": 1, "reason": "x"},
            headers=admin_h, timeout=15,
        )
        assert rsp.status_code == 404
