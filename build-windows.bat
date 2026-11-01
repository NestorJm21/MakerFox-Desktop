@echo off
setlocal
title MakerFox 1.1.1 - Generador de instalador
cd /d "%~dp0"
echo ==========================================
echo       MAKERFOX 1.1.0 - WINDOWS
echo ==========================================
echo Carpeta del proyecto:
cd
if not exist "package.json" (
 echo ERROR: No se encontro package.json.
 pause
 exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (echo ERROR: Node.js no esta instalado.& pause & exit /b 1)
where npm >nul 2>nul
if errorlevel 1 (echo ERROR: npm no esta disponible.& pause & exit /b 1)
echo Node:
node --version
echo npm:
call npm --version
if errorlevel 1 (echo ERROR al comprobar npm.& pause & exit /b 1)
echo.
echo Instalando dependencias...
call npm install
if errorlevel 1 (echo ERROR al instalar dependencias.& pause & exit /b 1)
echo.
echo Construyendo MakerFox 1.1.1...
call npm run dist
if errorlevel 1 (echo ERROR al compilar el instalador.& pause & exit /b 1)
echo.
echo COMPILACION TERMINADA. Busca MakerFox Setup 1.1.1.exe en dist.
pause
