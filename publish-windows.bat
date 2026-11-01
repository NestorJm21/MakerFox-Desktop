@echo off
setlocal
cd /d "%~dp0"
echo Publicador de MakerFox 1.1.1 a GitHub Releases
echo.
echo Se solicitara el token de GitHub de forma oculta. No lo pegues en archivos ni lo compartas.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=Read-Host 'Pega tu token GH_TOKEN (entrada oculta)' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { $env:GH_TOKEN=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b); npm run publish } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b); Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue }"
if errorlevel 1 (echo.
echo ERROR: No se pudo publicar. Revisa el token, permisos y version.
pause
exit /b 1)
echo.
echo Publicacion terminada. Revisa la seccion Releases de GitHub.
pause
