@echo off
REM ====================================================================
REM  Hemsa · Registro de Vivienda Protegida — Arranque local (Windows)
REM ====================================================================
REM  Requisitos: Python 3.11+, Node 20+, Yarn, MongoDB corriendo en :27017
REM  Ejecucion: doble-click sobre este fichero, o desde cmd: start_local.bat
REM ====================================================================

if not exist "backend\.env" (
    echo [ERROR] No existe backend\.env. Crealo siguiendo SETUP_LOCAL.md
    pause
    exit /b 1
)
if not exist "frontend\.env" (
    echo [ERROR] No existe frontend\.env con REACT_APP_BACKEND_URL=http://localhost:8001
    pause
    exit /b 1
)

echo Instalando dependencias backend...
cd backend
pip install -q -r requirements_local.txt
cd ..

echo Instalando dependencias frontend...
cd frontend
call yarn install --silent
cd ..

echo Arrancando backend en :8001...
start "Hemsa Backend" cmd /k "cd backend && uvicorn server:app --reload --host 0.0.0.0 --port 8010"

echo Arrancando frontend en :3000...
start "Hemsa Frontend" cmd /k "cd frontend && yarn start"

echo.
echo ====================================================================
echo  Hemsa corriendo en local
echo    Frontend: http://localhost:3000
echo    Backend:  http://localhost:8001
echo  Cierra las dos ventanas de cmd para parar todo
echo ====================================================================
echo.
pause
