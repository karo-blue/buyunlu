@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure-payment.ps1" %*
if errorlevel 1 (
  echo.
  echo Configuration failed. Press any key to close.
  pause >nul
  exit /b 1
)
echo.
echo Configuration finished. Press any key to close.
pause >nul
endlocal
