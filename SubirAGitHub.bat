@echo off
chcp 65001 >nul
title Subir cambios a GitHub
echo ================================================
echo   SUBIR CAMBIOS A GITHUB
echo   Carpeta: %CD%
echo ================================================
echo.

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo Esta carpeta todavia no es un repositorio git.
    echo.
    set /p REPO_URL=Pega la URL del repositorio en GitHub y pulsa Enter:
    if "%REPO_URL%"=="" exit /b 1
    git init
    git remote add origin %REPO_URL%
    git branch -M main
)

git add -A
git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo No hay cambios que subir. Todo esta ya en GitHub.
    echo.
    pause
    exit /b 0
)

echo.
set /p MSG=Escribe un mensaje corto para esta subida (Enter = automatico):
if "%MSG%"=="" set MSG=Actualizacion %DATE% %TIME:~0,5%

echo.
echo Subiendo con el mensaje: %MSG%
echo.
git commit -m "%MSG%"
git push 2>nul
if errorlevel 1 git push -u origin main
if errorlevel 1 (
    echo.
    echo [AVISO] El push ha fallado. Si GitHub tiene cambios que tu no tienes,
    echo         ejecuta: git pull --rebase  y vuelve a lanzar este archivo.
) else (
    echo.
    echo ================================================
    echo   SUBIDA COMPLETADA
    echo ================================================
)
echo.
pause