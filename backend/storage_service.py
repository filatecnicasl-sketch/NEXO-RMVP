"""Emergent object storage helpers + baremo calculator."""
import os
import logging
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger("hemsa.storage")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = os.environ.get("STORAGE_APP_NAME", "hemsa-sf")

_storage_key = None


def init_storage() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    emergent_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not emergent_key:
        raise RuntimeError("EMERGENT_LLM_KEY not configured")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": emergent_key}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> Dict[str, Any]:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 403:
        # reset and retry once
        global _storage_key
        _storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if resp.status_code == 403:
        global _storage_key
        _storage_key = None
        key = init_storage()
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60,
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def delete_object(path: str) -> bool:
    """Physically delete an object from storage. Returns True if 2xx, False otherwise.
    A 404 is treated as success (already gone)."""
    key = init_storage()
    resp = requests.delete(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=30,
    )
    if resp.status_code == 403:
        global _storage_key
        _storage_key = None
        key = init_storage()
        resp = requests.delete(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=30,
        )
    if resp.status_code in (200, 202, 204, 404):
        return True
    logger.warning(f"delete_object {path} -> {resp.status_code} {resp.text[:120]}")
    return False


# ---------- BAREMO ----------
# Default weights — can be overridden by admin via /api/admin/baremo-config
DEFAULT_BAREMO = {
    "casillas": {
        "VVG": 25, "DP": 25, "DES": 25,
        "DIS": 20, "DEP": 20, "VT": 20, "RUI": 20,
        "MAY": 15, "FMP": 15, "RIE": 15, "FI": 15,
        "UF": 10, "RUP": 10,
        "JOV": 5, "EMI": 5, "CAS": 5,
    },
    "vivienda_flags": {
        "silla_ruedas": 15,
        "movilidad_reducida": 10,
        "precariedad": 10,
        "necesidad_vivienda_adaptada": 10,
        "alojamiento_otros_familiares": 5,
        "vivienda_inadecuada_superficie": 5,
        "renta_elevada": 5,
        "nueva_unidad_familiar": 5,
    },
    "income_brackets": [
        {"max": 8000, "points": 20, "label": "Ingresos < 8.000 €"},
        {"max": 12000, "points": 15, "label": "Ingresos < 12.000 €"},
        {"max": 18000, "points": 10, "label": "Ingresos < 18.000 €"},
        {"max": 24000, "points": 5, "label": "Ingresos < 24.000 €"},
    ],
    "miembros_per_person": 3,
    "miembros_max_bonus": 15,
}

# Backwards-compat aliases used elsewhere
JUSTIF_POINTS = DEFAULT_BAREMO["casillas"]
VIVIENDA_FLAGS_POINTS = DEFAULT_BAREMO["vivienda_flags"]


def compute_score(app: Dict[str, Any], config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Returns dict {score: int, breakdown: [{label, points}]}.

    `config` is an optional baremo configuration dict (same shape as DEFAULT_BAREMO).
    Falls back to DEFAULT_BAREMO when keys are missing.
    """
    cfg = config or {}
    casillas_cfg = {**DEFAULT_BAREMO["casillas"], **(cfg.get("casillas") or {})}
    viv_cfg = {**DEFAULT_BAREMO["vivienda_flags"], **(cfg.get("vivienda_flags") or {})}
    income_brackets = cfg.get("income_brackets") or DEFAULT_BAREMO["income_brackets"]
    miembros_per = cfg.get("miembros_per_person", DEFAULT_BAREMO["miembros_per_person"])
    miembros_max = cfg.get("miembros_max_bonus", DEFAULT_BAREMO["miembros_max_bonus"])

    breakdown = []
    total = 0

    casillas = (app.get("justificacion") or {}).get("casillas") or []
    for c in casillas:
        pts = int(casillas_cfg.get(c, 0))
        if pts:
            breakdown.append({"label": f"Casilla {c}", "points": pts})
            total += pts

    v = app.get("vivienda") or {}
    for flag, pts in viv_cfg.items():
        if v.get(flag):
            breakdown.append({"label": flag.replace("_", " ").capitalize(), "points": int(pts)})
            total += int(pts)

    t1 = app.get("titular1") or {}
    ingresos = float(t1.get("ingresos_economicos") or 0)
    if ingresos > 0:
        for b in sorted(income_brackets, key=lambda x: x.get("max", 0)):
            if ingresos < b.get("max", 0):
                pts = int(b.get("points", 0))
                breakdown.append({"label": b.get("label") or f"Ingresos < {b['max']} €", "points": pts})
                total += pts
                break

    miembros = app.get("otros_miembros") or []
    if miembros:
        pts = min(len(miembros) * int(miembros_per), int(miembros_max))
        if pts:
            breakdown.append({"label": f"Miembros unidad familiar (+{len(miembros)})", "points": pts})
            total += pts

    # Manual adjustment by admin
    adj = app.get("score_adjustment") or {}
    adj_pts = int(adj.get("points") or 0)
    if adj_pts:
        breakdown.append({"label": f"Ajuste manual: {adj.get('reason') or 'sin motivo'}", "points": adj_pts})
        total += adj_pts

    return {"score": total, "breakdown": breakdown}
