@echo off
REM Agrega C:\Program Files\nodejs al PATH del sistema (e instala Node LTS si falta)
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Pidiendo permisos de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
if not exist "C:\Program Files\nodejs\node.exe" (
  echo No encontre node.exe. Instalando Node LTS con winget...
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d='C:\Program Files\nodejs'; $p=[Environment]::GetEnvironmentVariable('Path','Machine'); if (($p -split ';') -notcontains $d) { [Environment]::SetEnvironmentVariable('Path', $p.TrimEnd(';') + ';' + $d, 'Machine'); Write-Host 'PATH actualizado.' } else { Write-Host 'Node ya estaba en el PATH del sistema.' }"
echo.
"C:\Program Files\nodejs\node.exe" -v
echo.
echo Listo. Cierra TODAS las ventanas de PowerShell y VS Code, abre una nueva y escribe: node -v
pause
