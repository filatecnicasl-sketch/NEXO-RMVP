# PRD — Hemsa · Registro Municipal de Vivienda Protegida (San Fernando)

## Stack
- Backend: FastAPI + Motor (MongoDB) + bcrypt + PyJWT + reportlab + openpyxl + smtplib + **pyHanko + pyhanko-certvalidator** (validación FNMT) + python-magic
- OCR: Gemini 3.1 Pro (+ Claude Sonnet 4.5 fallback)
- Object storage: Emergent objstore
- Auth: JWT + Emergent Google Auth
- Email: IONOS SMTP SSL
- Frontend: React 19 + Tailwind + Shadcn UI + Recharts + Sonner

## Estados
`pendiente → recepcionada → en_revision → aprobada / denegada`

## Funcionalidades implementadas
### Iter 1
- Landing, registro/login ciudadano (JWT + Google), wizard 7 pasos, dashboard, panel admin, exportación, OCR.

### Iter 2
- PDF resguardo, adjuntos object storage, emails IONOS, baremo automático.

### Iter 3
- Estado "recepcionada", PDF adjunto en todos los emails, firma FNMT ciudadano/admin (verificación simple por string del issuer), python-magic, notificaciones in-app.

### Iter 4
- Buzón de alegaciones bidireccional.
- Baremo configurable por admin + ajuste manual por expediente.

### Iter 5 (NUEVO · P0)
- **Validación criptográfica completa de la cadena CA contra FNMT-RCM oficial**:
  - Certificados raíz oficiales descargados de cert.fnmt.es y bundleados en `/app/backend/certs/fnmt/`: **AC RAIZ FNMT-RCM** y **AC Administración Pública**.
  - Validación cripto real con pyHanko + pyhanko-certvalidator usando ValidationContext con trust_roots.
  - Worker thread (ThreadPoolExecutor) para evitar conflicto event loop FastAPI ↔ asyncio interno de pyhanko.
  - Nuevo flag `chain_validated` distinto de `fnmt`: ahora UI muestra 3 niveles diferenciados:
    1. **FNMT verificada criptográficamente** (verde + pill "Validación criptográfica FNMT-RCM") · fnmt=true + chain_validated=true
    2. **FNMT detectado · cadena no validada** (ámbar) · fnmt=true + chain_validated=false (cert caducado/revocado o intermedios faltantes)
    3. **Firmada (emisor no FNMT)** (gris) · fnmt=false
  - Historial registra `chain_validated` por evento de firma (auditoría).
  - Backward-compat: docs sin `chain_validated` se tratan como false (UI no se rompe).

### Iter 6 (P0)
- **Flujo de Subsanaciones (Amendment) completo**: ciudadano propone cambios sobre expediente ya enviado, admin aprueba o rechaza con motivo, los cambios aprobados se aplican al expediente y se recalcula el baremo. Una sola subsanación pendiente por expediente. Eventos en `historial`, notificaciones in-app a ciudadano y admins.
  - Endpoints: `POST /api/applications/me/subsanaciones`, `GET /api/applications/me/subsanaciones`, `GET /api/admin/applications/{id}/subsanaciones`, `POST /api/admin/subsanaciones/{id}/approve`, `POST /api/admin/subsanaciones/{id}/reject`.
  - Frontend: `Subsanaciones.jsx` integrado en `CitizenDashboard` y `AdminApplicationDetail`. `ApplicationWizard` soporta tres modos: `create`, `edit`, `subsanacion`.
  - Test report: `/app/test_reports/iteration_6.json` — backend 12/12 PASS, frontend ciudadano E2E PASS.

### Iter 7 (P2/P3) — Refactor + mejoras backend/frontend (07-jun-2026)
- **Refactor estructural backend**: `server.py` pasó de **1710 líneas → 83 líneas** como entrypoint mínimo.
  - Nueva estructura: `deps.py`, `models.py`, `helpers.py`, `routers/{auth,applications,admin,ocr}.py`, `gdpr_service.py`.
- **Defensa-en-profundidad subsanaciones** (P3): bloquear API si `application.status == 'pendiente'` (400). Mensaje: "Su solicitud aún está pendiente: edítela directamente en lugar de presentar subsanación".
- **Job real GDPR** (P2): APScheduler diario a las 03:30 UTC + endpoint manual `POST /api/admin/gdpr/purge-now`. Purga física en object storage de adjuntos con `is_deleted=True` y `deleted_at` >30 días. Configurable vía `GDPR_RETENTION_DAYS` env.
- **bulk_write en recompute-all** (P2): batches de 500 con `ordered=False`. Endpoint `POST /api/admin/baremo/recompute-all` ahora escala a >10k expedientes sin degradación.
- **Histórico multi-firmante** (P2): nuevos campos `firmas_ciudadano: []` y `firmas_admin: []` con todas las firmas históricas. `firma_ciudadano` y `firma_admin` (singular) mantienen la última firma para backward-compat.
- **Panel "Mis cambios pendientes"** en dashboard ciudadano (P0 UX): polling cada 30s a `/applications/me/subsanaciones` y `/applications/me/alegaciones`. Muestra badges en vivo, toasts cuando cambia de estado, animación de glow al detectar cambio. Snapshot silencioso en primera carga para evitar toasts espurios.
- **Landing rediseñado**: sin imágenes hero/family, título reducido (`text-2xl sm:text-3xl` vs `text-4xl..6xl`), todo centrado.
- Regresión completa: **92 passed, 5 skipped, 0 failed** en pytest (`/app/backend/tests/`, 7 archivos).
- Fix lateral: instalado `libmagic1` para que la verificación de magic-bytes de adjuntos funcione realmente.

### Iter 8 — Hardening GDPR + UX panel (07-jun-2026)
- **`deleted_at` y `purged_at` ahora se almacenan como BSON datetime** (no ISO string). Query `$lt` del job GDPR es robusta a deriva de formato. Migración idempotente al arranque convirtió los registros legacy (7 documentos migrados).
- **PendingChangesPanel ahora refresca al instante** cuando el usuario vuelve a la pestaña (`window.focus` + `document.visibilitychange`). Ya no hay que esperar el siguiente tick de 30s.
- Lint frontend: 0 errores.
- Regresión pytest: **92 passed, 5 skipped, 0 failed**.

### Iter 9 — Export RGPD Art. 20 (07-jun-2026)
- **Nuevo endpoint** `GET /api/applications/me/export` → ZIP descargable con:
  - `expediente.json`: perfil de usuario (sin `password_hash`), solicitud, alegaciones, subsanaciones, notificaciones, metadatos de adjuntos, bloque `meta` con referencia a RGPD Art. 20.
  - `README.txt`: instrucciones legibles para el ciudadano.
  - `resguardo.pdf`: PDF oficial de la solicitud.
  - `adjuntos/`: todos los ficheros adjuntos no purgados.
  - `aprobacion_firmada.pdf`: si la admin firmó la aprobación.
- **Botón "Exportar mis datos (RGPD)"** en `CitizenDashboard` con tooltip Art. 20 y toast de progreso.
- 4 pytest nuevos en `tests/test_iteration9.py` (cobertura: 401 sin auth, 404 sin solicitud, ZIP con ficheros esperados, sensitive fields scrubbed, contenido completo con alegaciones+subsanaciones).
- Regresión total: **96 passed, 5 skipped, 0 failed**.


### Iter 11 — Login unificado + UX admin + docs locales (07-jun-2026)
- **Login unificado**: el formulario `/login` y `/admin/login` ahora autorrutan según el rol del usuario. Si un admin entra por la puerta de ciudadano (o viceversa), `AuthContext` reintenta automáticamente con el otro endpoint y redirige al panel correcto (`/admin` o `/dashboard`). Adiós a "Credenciales incorrectas" por usar la puerta equivocada.
- **Botón "Administrador" visible en cabecera pública**: outline verde con icono de escudo, presente en toda la web pública. Ya no se puede pasar por alto.
- **Botón "Acceso administrador" en hero del landing** (antes era ghost gris difuminado, ahora outline verde).
- **Enlaces cruzados** entre `/login` y `/admin/login` ("¿Eres administrador? Accede por aquí →" y viceversa).
- Nuevo endpoint **`GET /api/auth/account-type?email=…`** (probe anti-enumeración) que solo revela si un email es admin.
- **Documentación para uso local**: nuevos ficheros en raíz `/app/`:
  - `README.md` — resumen y arranque rápido.
  - `SETUP_LOCAL.md` — guía paso a paso completa para Windows/macOS/Linux (instalación, .env, troubleshooting).
  - `start_local.sh` (Mac/Linux) y `start_local.bat` (Windows) — scripts de arranque automático.
- Usuario en pausa: vuelve mañana. Próximo paso esperado: hacer "Save to GitHub" desde su lado.

### Iter 10 — Niveles de admin granulares (07-jun-2026)
- **Tres niveles** (`admin_level`): `gerente`, `administracion`, `lector`.
  - gerente: acceso total + firma digital FNMT + gestión de usuarios + configurar baremo + ajuste manual de puntuación + purga GDPR.
  - administracion: gestión diaria (editar, cambiar estado, notas, aprobar/rechazar subsanaciones, responder alegaciones, OCR, exportar).
  - lector: solo lectura.
- Nuevas dependencias en `deps.py`: `require_gerente`, `require_writer`, `_admin_level`. Mensajes de error en español.
- Migración idempotente en startup: admins legacy → `administracion`. Seed `admin@hemsa.es` siempre `gerente`. `fbarroso@filatecnica.com` promovido a `gerente`.
- Salvaguarda: no se puede degradar ni eliminar al último gerente activo.
- Frontend `AdminUsers.jsx`: columna "Nivel admin" con `<Select>` inline + selector con descripciones en el modal de creación.
- 11 pytest nuevos en `tests/test_iteration10.py` (10 PASS + 1 skip condicional).
- Regresión total: **106 passed, 6 skipped, 0 failed**.


- Iter1: regex SF-YYYY-NNNNN.
- Iter2: env vars SMTP en lazy load.
- Iter3: defensiva en notificaciones + no overwrite FNMT→manual.
- Iter4: el "fallo" del fill() de Playwright NO era bug.
- Iter5: pyhanko `asyncio.run` chocando con event loop FastAPI → resuelto con ThreadPoolExecutor.

## Backlog (no urgente)
- **Histórico multi-firmante**: UI para listar todas las firmas históricas (datos ya disponibles en `firmas_ciudadano[]` y `firmas_admin[]`).
- **Adjudicación pública**: lista de viviendas con baremos mínimos + matching automático con expedientes inscritos.

## Credenciales
- Admin: `admin@hemsa.es` / `AdminHemsa2026!`
- IONOS: `notificaciones@hemsasanfernando.es` / `Nt_@soft#2026`
- Ciudadanos: `/registro` con emails `@example.com`
