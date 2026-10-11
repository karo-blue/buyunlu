@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-payment-release.ps1" %*
if errorlevel 1 (
  echo.
  echo Verification failed. Press any key to close.
  pause >nul
  exit /b 1
)
echo.
echo Verification finished. Press any key to close.
pause >nul
endlocal
