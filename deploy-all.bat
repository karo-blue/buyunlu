@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-server.ps1" -ConfigurePayment %*
if errorlevel 1 (
  echo.
  echo Deployment failed. Press any key to close.
  pause >nul
  exit /b 1
)
echo.
echo Full deployment finished. Press any key to close.
pause >nul
endlocal
