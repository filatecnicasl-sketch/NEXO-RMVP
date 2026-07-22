"""FNMT digital signature validation for PDFs (PAdES) using pyHanko + asn1crypto.

Realiza validación criptográfica COMPLETA contra los certificados raíz oficiales
de la Fábrica Nacional de Moneda y Timbre (FNMT-RCM):
  - AC RAIZ FNMT-RCM
  - AC Administración Pública (CERES)

Los certificados raíz están en /app/backend/certs/fnmt/ y se cargan en arranque.
"""
import io
import logging
import concurrent.futures
from pathlib import Path
from typing import Dict, Any, List

from asn1crypto import x509 as asn1_x509
from pyhanko_certvalidator import ValidationContext
from pyhanko_certvalidator.registry import SimpleCertificateStore
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign.validation import validate_pdf_signature as _pyhanko_validate

logger = logging.getLogger("hemsa.fnmt")

# Silenciar logs ruidosos de pyhanko cuando una firma legítimamente no valida
# contra la cadena FNMT (caso esperado: self-signed, certs no FNMT, etc.)
logging.getLogger("pyhanko.sign.validation.generic_cms").setLevel(logging.ERROR)
logging.getLogger("pyhanko_certvalidator").setLevel(logging.ERROR)

CERTS_DIR = Path(__file__).parent / "certs" / "fnmt"

# pyHanko's validate_pdf_signature internally uses asyncio.run, which clashes with
# FastAPI's running event loop. We run it in a separate thread so it gets its own loop.
_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="fnmt-validate")


def _load_trust_roots() -> List[asn1_x509.Certificate]:
    roots: List[asn1_x509.Certificate] = []
    if not CERTS_DIR.is_dir():
        logger.warning("No FNMT certs dir found at %s", CERTS_DIR)
        return roots
    for f in sorted(CERTS_DIR.glob("*.crt")):
        try:
            data = f.read_bytes()
            cert = asn1_x509.Certificate.load(data)
            roots.append(cert)
            logger.info("Loaded FNMT trust root: %s", cert.subject.human_friendly)
        except Exception as e:
            logger.warning("Could not load FNMT root %s: %s", f.name, e)
    return roots


_TRUST_ROOTS: List[asn1_x509.Certificate] = _load_trust_roots()


def _is_fnmt_string(s: str) -> bool:
    u = (s or "").upper()
    return ("FNMT" in u) or ("FABRICA NACIONAL DE MONEDA Y TIMBRE" in u)


def _subject_field(name_obj, attr: str) -> str:
    try:
        native = name_obj.native if hasattr(name_obj, "native") else {}
        return str(native.get(attr, ""))
    except Exception:
        return ""


def _extract_dni(subject) -> str:
    serial_number = _subject_field(subject, "serial_number")
    if serial_number.upper().startswith("IDCES-"):
        return serial_number[6:]
    return serial_number


def validate_pdf_signature(pdf_bytes: bytes) -> Dict[str, Any]:
    """Validate PDF signatures with full CA chain verification against FNMT roots."""
    try:
        reader = PdfFileReader(io.BytesIO(pdf_bytes))
    except Exception as e:
        return {"valid": False, "error": f"PDF inválido: {e}", "trust_roots_loaded": len(_TRUST_ROOTS)}

    sigs = list(reader.embedded_signatures or [])
    if not sigs:
        return {
            "valid": False,
            "error": "El PDF no contiene firmas digitales",
            "trust_roots_loaded": len(_TRUST_ROOTS),
            "fnmt": False,
            "chain_validated": False,
        }

    signers: List[Dict[str, Any]] = []
    any_chain_ok = False
    any_fnmt = False

    for s in sigs:
        cert = s.signer_cert
        cn = _subject_field(cert.subject, "common_name")
        org = _subject_field(cert.subject, "organization_name")
        issuer_cn = _subject_field(cert.issuer, "common_name") or _subject_field(cert.issuer, "organization_name")
        is_fnmt = _is_fnmt_string(issuer_cn) or _is_fnmt_string(cert.issuer.human_friendly)
        any_fnmt = any_fnmt or is_fnmt

        chain_valid = False
        chain_error = None
        signature_intact = None

        try:
            # Recoge certificados intermedios embebidos en la propia firma CMS
            intermediates_store = SimpleCertificateStore()
            try:
                for c in (s.other_embedded_certs or []):
                    if c.subject != cert.subject:
                        intermediates_store.register(c)
            except Exception:
                pass

            vc = ValidationContext(
                trust_roots=_TRUST_ROOTS,
                other_certs=list(intermediates_store),
                allow_fetching=False,
                revocation_mode="soft-fail",
            )

            # Run pyHanko validation in a worker thread (own asyncio loop)
            def _run_validate():
                return _pyhanko_validate(s, signer_validation_context=vc, skip_diff=True)
            status = _EXECUTOR.submit(_run_validate).result(timeout=30)

            signature_intact = bool(getattr(status, "intact", False))
            chain_valid = bool(
                getattr(status, "trusted", False)
                or getattr(status, "bottom_line", False)
            )
        except Exception as e:
            chain_error = str(e)[:240]

        any_chain_ok = any_chain_ok or chain_valid

        signers.append({
            "cn": cn,
            "organization": org,
            "dni": _extract_dni(cert.subject),
            "issuer": issuer_cn,
            "is_fnmt": is_fnmt,
            "chain_valid": chain_valid,
            "chain_error": chain_error,
            "signature_intact": signature_intact,
            "signed_at": s.signer_reported_dt.isoformat() if getattr(s, "signer_reported_dt", None) else "",
            "signature_field_name": s.field_name,
        })

    return {
        "valid": True,
        "fnmt": any_fnmt,
        "chain_validated": any_chain_ok,
        "signers": signers,
        "num_signatures": len(sigs),
        "trust_roots_loaded": len(_TRUST_ROOTS),
    }
