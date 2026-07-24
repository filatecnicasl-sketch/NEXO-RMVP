@echo off
REM ====================================================================
REM  Hemsa - Registro de Vivienda Protegida - Arranque local (Windows)
REM  Puertos: backend 8010 - frontend 3002
REM  (3000 y 8001 los usa otro programa de este equipo)
REM ====================================================================

if not exist "backend\.env" (
    echo [ERROR] No existe backend\.env
    pause
    exit /b 1
)
if not exist "frontend\.env" (
    echo [ERROR] No existe frontend\.env
    pause
    exit /b 1
)

REM --- Comprobar que MongoDB esta corriendo ---
tasklist /FI "IMAGENAME eq mongod.exe" 2>nul | find /I "mongod.exe" >nul
if errorlevel 1 (
    echo [AVISO] MongoDB no esta corriendo. Intentando arrancarlo...
    net start MongoDB >nul 2>&1
    tasklist /FI "IMAGENAME eq mongod.exe" 2>nul | find /I "mongod.exe" >nul
    if errorlevel 1 (
        echo [ERROR] MongoDB no ha podido arrancar. El login NO funcionara.
        echo         Abre Servicios de Windows y arranca MongoDB manualmente.
    ) else (
        echo MongoDB arrancado correctamente.
    )
) else (
    echo MongoDB ya esta corriendo.
)

echo Arrancando backend en :8010...
start "Hemsa Backend" cmd /k "cd backend && uvicorn server:app --reload --host 0.0.0.0 --port 8010"

echo Arrancando frontend en :3002...
start "Hemsa Frontend" cmd /k "cd frontend && npm start"

echo.
echo ====================================================================
echo  Hemsa corriendo en local
echo    Frontend: http://localhost:3002
echo    Backend:  http://localhost:8010
echo  Las ventanas se llaman "Hemsa Backend" y "Hemsa Frontend".
echo  Cierralas para parar el programa.
echo ====================================================================
echo.
pause