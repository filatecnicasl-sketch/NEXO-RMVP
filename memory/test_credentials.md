# Test Credentials — Hemsa Municipal Housing Registry

These are seeded automatically by the backend on startup.

## Administrators (JWT email + password)
- **Login endpoint:** `POST /api/auth/admin/login`
- **Login URL:** `/admin/login`

Hay 3 niveles de administrador (`admin_level`):
- **gerente**: acceso total + firma digital FNMT + gestión de usuarios + configuración baremo + purga GDPR
- **administracion**: gestión diaria (editar, cambiar estado, notas, aprobar subsanaciones, responder alegaciones)
- **lector**: solo lectura (listar, ver detalle, exportar CSV/XLSX, stats)

| Email | Password | Nivel | Origen |
|---|---|---|---|
| `admin@hemsa.es` | `AdminHemsa2026!` | gerente | Seed automático en startup |
| `director@hemsa.es` | `DirectorSF2026!` | administracion | Creado vía panel |
| `fbarroso@filatecnica.com` | `Barroso@159000` | gerente | Creado y promovido (07-jun-2026) |

## Citizen (JWT email + password)
Citizens can self-register through `/registro` (UI) or `POST /api/auth/citizen/register`.

Sample test citizen (must be created at runtime):
- **Email:** `ciudadano@test.es`
- **Password:** `TestCiudadano2026!`

## Citizen (Emergent Google Auth)
Use the "Acceder con Google" button at `/login`. Sessions are stored in
`user_sessions` MongoDB collection with `session_token` cookies (7 day expiry).
