#!/usr/bin/env bash
# ====================================================================
# Hemsa · Registro de Vivienda Protegida — Arranque local (Mac/Linux)
# ====================================================================
# Este script arranca backend + frontend en local.
# Requisitos previos: Python 3.11+, Node 20+, Yarn, MongoDB en :27017
# Ejecución:  ./start_local.sh
# ====================================================================

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Comprobar que MongoDB está activo
if ! command -v mongosh &> /dev/null && ! command -v mongo &> /dev/null; then
    echo "⚠️  MongoDB no parece estar instalado. Instálalo siguiendo SETUP_LOCAL.md"
    exit 1
fi

# Verificar .env
if [ ! -f "backend/.env" ]; then
    echo "❌ No existe backend/.env — créalo siguiendo SETUP_LOCAL.md sección 3️⃣"
    exit 1
fi
if [ ! -f "frontend/.env" ]; then
    echo "❌ No existe frontend/.env — créalo con REACT_APP_BACKEND_URL=http://localhost:8001"
    exit 1
fi

# Backend
echo "▶ Instalando dependencias backend..."
(cd backend && pip install -q -r requirements.txt)

echo "▶ Arrancando backend en :8001..."
(cd backend && uvicorn server:app --reload --host 0.0.0.0 --port 8001) &
BACKEND_PID=$!

# Frontend
echo "▶ Instalando dependencias frontend..."
(cd frontend && yarn install --silent)

echo "▶ Arrancando frontend en :3000..."
(cd frontend && yarn start) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM

echo ""
echo "════════════════════════════════════════════"
echo " ✅ Hemsa corriendo en local"
echo "    Frontend: http://localhost:3000"
echo "    Backend:  http://localhost:8001"
echo " ⚠ Pulsa Ctrl+C para parar todo"
echo "════════════════════════════════════════════"

wait
