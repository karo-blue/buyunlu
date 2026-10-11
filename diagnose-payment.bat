@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnose-payment.ps1" %*
echo.
echo Diagnostic finished. Press any key to close.
pause >nul
endlocal
