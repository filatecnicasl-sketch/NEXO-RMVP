# 🖥️ Cómo ejecutar Hemsa en tu propio ordenador

Esta guía explica paso a paso cómo bajar el código y ponerlo a funcionar en local (Windows, macOS o Linux).

---

## 1️⃣ Bajar el código desde Emergent

En el chat de Emergent verás el botón **"Save to GitHub"** (esquina superior). Pulsa ese botón:

1. Vincula tu cuenta de GitHub (si no lo has hecho antes).
2. Crea un repositorio nuevo (por ejemplo `hemsa-registro-vivienda`).
3. Emergent sube TODO el código a tu repo.
4. Ya puedes clonarlo en tu PC:

```bash
git clone https://github.com/TU-USUARIO/hemsa-registro-vivienda.git
cd hemsa-registro-vivienda
```

---

## 2️⃣ Instalar los requisitos en tu PC

Necesitas estas tres cosas instaladas (gratis, todas):

### Windows / macOS / Linux

| Software | Versión | Instalación |
|---|---|---|
| **Python** | 3.11 o superior | https://www.python.org/downloads/ |
| **Node.js** | 20 o superior | https://nodejs.org/ |
| **Yarn** | última | `npm install -g yarn` (tras instalar Node) |
| **MongoDB** | 7.0 o superior (Community) | https://www.mongodb.com/try/download/community |

### En Mac con Homebrew (más rápido)
```bash
brew install python@3.11 node yarn mongodb-community@7.0
brew services start mongodb-community@7.0
```

### En Ubuntu/Debian
```bash
sudo apt install python3.11 python3-pip
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs
sudo npm install -g yarn
# MongoDB: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/
sudo systemctl start mongod
```

### En Windows
1. Instalar Python desde la web oficial (marca "Add to PATH").
2. Instalar Node.js desde la web oficial.
3. Abrir PowerShell y ejecutar: `npm install -g yarn`
4. Instalar MongoDB Community Edition. Una vez instalado, arrancarlo desde "Servicios" de Windows.

### Verificar que está todo

```bash
python --version    # 3.11+
node --version      # 20+
yarn --version
mongod --version
```

---

## 3️⃣ Configurar las variables de entorno

### Backend (`backend/.env`)

Crea el fichero `backend/.env` con este contenido:

```ini
# MongoDB local
MONGO_URL=mongodb://localhost:27017
DB_NAME=hemsa_local

# JWT (genera tu propio secreto: https://www.random.org/passwords/)
JWT_SECRET=cambia-esto-por-un-secreto-largo-y-aleatorio

# Admin seed (se crea automáticamente al arrancar)
ADMIN_EMAIL=admin@hemsa.es
ADMIN_PASSWORD=AdminHemsa2026!

# CORS para frontend local
CORS_ORIGINS=http://localhost:3000

# Email IONOS (opcional — sin esto, no se envían emails pero la app funciona)
IONOS_SMTP_HOST=smtp.ionos.es
IONOS_SMTP_PORT=465
IONOS_SMTP_USER=notificaciones@hemsasanfernando.es
IONOS_SMTP_PASSWORD=tu-password-ionos
IONOS_FROM_EMAIL=notificaciones@hemsasanfernando.es

# Emergent LLM Key (opcional — sin esto, el OCR no funciona)
# Lo obtienes en Emergent → Profile → Universal Key
EMERGENT_LLM_KEY=

# GDPR
GDPR_RETENTION_DAYS=30

# URL pública (para enlaces en emails de password reset)
APP_PUBLIC_URL=http://localhost:3000
```

### Frontend (`frontend/.env`)

Crea el fichero `frontend/.env`:

```ini
REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 4️⃣ Arrancar la aplicación

Abre **dos terminales**, una para cada servicio:

### Terminal 1 — Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

Cuando veas `Application startup complete.` y `Admin sembrado: admin@hemsa.es`, el backend está listo.

### Terminal 2 — Frontend
```bash
cd frontend
yarn install
yarn start
```

Se abrirá automáticamente tu navegador en `http://localhost:3000`.

---

## 5️⃣ Iniciar sesión

Abre `http://localhost:3000` y entra como administrador con:
- **Email**: `admin@hemsa.es`
- **Contraseña**: `AdminHemsa2026!`

¡Listo! Ya tienes la aplicación corriendo en tu PC.

---

## ❓ Resolución de problemas comunes

### "Cannot connect to MongoDB"
Asegúrate de que MongoDB está arrancado:
- **macOS**: `brew services start mongodb-community@7.0`
- **Linux**: `sudo systemctl start mongod`
- **Windows**: Abre "Servicios" y arranca `MongoDB Server`

### "Error: libmagic not found"
Falta la librería `libmagic` para validar tipos de archivo:
- **macOS**: `brew install libmagic`
- **Linux**: `sudo apt install libmagic1`
- **Windows**: `pip install python-magic-bin`

### El OCR de PDF no funciona
Necesitas un Emergent LLM Key válido en `backend/.env` (campo `EMERGENT_LLM_KEY`). Sin esto, el resto de la app funciona pero el OCR mostrará error.

### Los emails no se envían
Sin credenciales IONOS válidas, los emails no se envían (sale un warning en logs) pero **la app funciona perfectamente**, solo no se notifica por email.

### Puerto 3000 o 8001 ocupado
Backend: cambia `--port 8001` por otro libre (y actualiza `REACT_APP_BACKEND_URL`).
Frontend: `PORT=3001 yarn start`

---

## 🧪 Ejecutar los tests

```bash
cd backend
export REACT_APP_BACKEND_URL=http://localhost:8001
python -m pytest tests/ -v
```

---

## 🚢 Si quieres desplegar en producción

Esta guía es para **uso local**. Para producción real (24/7 online, dominio propio, SSL, etc.) considera:

- **Emergent Deploy** — un clic, lo más rápido
- **Railway** o **Render** — simple, hay plan gratuito
- **VPS propio** (Hetzner, DigitalOcean) — más barato a la larga
- **AWS / Azure / GCP** — si esperas mucho tráfico

Cualquiera de ellos te requerirá: levantar MongoDB (Atlas tiene plan gratis), publicar el backend con `gunicorn` o `uvicorn` + nginx, y servir el frontend como build estático.

---

## 📞 Soporte

Para cualquier duda técnica, las **credenciales y endpoints** están en:
- `memory/test_credentials.md` — Cuentas de admin
- `memory/PRD.md` — Detalles funcionales del producto
