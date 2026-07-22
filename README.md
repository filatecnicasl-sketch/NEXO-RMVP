# 🏠 Hemsa · Registro de Vivienda Protegida de San Fernando

Aplicación oficial del Registro Público Municipal de Demandantes de Vivienda Protegida.

> **Stack**: React 19 + FastAPI (Python 3.11) + MongoDB. Idioma: Español.

---

## 📖 Documentación

- 👉 **¿Quieres ejecutar la app en tu PC?** Lee [`SETUP_LOCAL.md`](./SETUP_LOCAL.md)
- 👉 **Documento de requisitos**: [`memory/PRD.md`](./memory/PRD.md)
- 👉 **Credenciales de prueba**: [`memory/test_credentials.md`](./memory/test_credentials.md)

---

## ⚡ Características principales

- ✅ Portal ciudadano con alta online y dashboard
- ✅ Portal de administradores con 3 niveles (Gerente / Administración / Lector)
- ✅ OCR automático de PDF con IA (Gemini 3 Pro + Claude Sonnet fallback)
- ✅ Validación criptográfica FNMT con pyHanko (firma digital española)
- ✅ Sistema de baremación configurable
- ✅ Subsanaciones y alegaciones con aprobación admin
- ✅ Notificaciones email (IONOS SMTP) + in-app en tiempo real
- ✅ Export RGPD Art. 20 (portabilidad de datos)
- ✅ Job GDPR de purga automática (>30 días)
- ✅ Auth: JWT + Google OAuth (Emergent)

---

## 🏗️ Estructura del proyecto

```
/app/
├── backend/                    # FastAPI (Python)
│   ├── server.py               # Entrypoint (mínimo)
│   ├── deps.py                 # DB, auth, env config
│   ├── models.py               # Pydantic models
│   ├── helpers.py              # Helpers compartidos
│   ├── routers/                # Endpoints por dominio
│   │   ├── auth.py             # Login, registro, password reset
│   │   ├── applications.py     # Endpoints ciudadano
│   │   ├── admin.py            # Endpoints admin
│   │   └── ocr.py              # OCR de PDF
│   ├── gdpr_service.py         # Purga GDPR
│   ├── fnmt_service.py         # Validación FNMT
│   ├── email_service.py        # IONOS SMTP
│   ├── pdf_gen.py              # Generación PDF resguardo
│   ├── storage_service.py      # Object storage
│   ├── tests/                  # Pytest (>100 tests)
│   └── requirements.txt
├── frontend/                   # React 19
│   ├── src/
│   │   ├── App.js              # Router
│   │   ├── pages/              # Dashboard, Wizard, Login, Admin*
│   │   ├── components/         # UI components
│   │   ├── contexts/           # AuthContext
│   │   └── lib/api.js          # Axios interceptors
│   ├── public/
│   └── package.json
└── memory/                     # Docs internos
```

---

## 🚀 Inicio rápido

```bash
# Backend (en una terminal)
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend (en otra terminal)
cd frontend
yarn install
yarn start
```

Para los detalles completos (instalar MongoDB, variables de entorno, etc.), consulta **[`SETUP_LOCAL.md`](./SETUP_LOCAL.md)**.

---

## 👤 Cuentas de prueba

| Email | Contraseña | Rol |
|---|---|---|
| `admin@hemsa.es` | `AdminHemsa2026!` | Gerente |
| `fbarroso@filatecnica.com` | `Barroso@159000` | Gerente |
| `director@hemsa.es` | `DirectorSF2026!` | Administración |

---

## 📜 Licencia

Proyecto desarrollado para Hemsa, Servicios Públicos Municipales de San Fernando.
