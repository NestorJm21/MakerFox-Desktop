@echo off
setlocal
title MakerFox - Generador de instalador
cd /d "%~dp0"
echo ==========================================
echo       MAKERFOX - INSTALADOR WINDOWS
echo ==========================================
echo Carpeta del proyecto:
cd
echo.

if not exist "package.json" (
 echo ERROR: No se encontro package.json.
 echo Extrae el ZIP completo y ejecuta este archivo desde la carpeta MakerFox_Windows.
 pause
 exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
 echo ERROR: No se encontro Node.js.
 echo Instala Node.js LTS desde https://nodejs.org/
 pause
 exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
 echo ERROR: No se encontro npm. Reinicia Windows y vuelve a intentar.
 pause
 exit /b 1
)

echo Version de Node:
node --version
echo Version de npm:
call npm --version
echo.
echo Instalando dependencias...
call npm install
if errorlevel 1 (
 echo.
 echo ERROR: Fallo la instalacion de dependencias. No se genero el instalador.
 pause
 exit /b 1
)

echo.
echo Construyendo instalador de MakerFox...
call npm run dist
if errorlevel 1 (
 echo.
 echo ERROR: Fallo la compilacion. Revisa los mensajes anteriores.
 pause
 exit /b 1
)

echo.
echo ==========================================
echo COMPILACION TERMINADA CORRECTAMENTE
echo Busca el instalador dentro de la carpeta:
echo %~dp0dist
echo ==========================================
pause
