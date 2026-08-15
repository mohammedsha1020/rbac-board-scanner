@echo off
:: Batch script to execute the SDK Setup and APK build process with process bypass privileges.
:: Run as Administrator.
title Android Board Scanner APK Compiler Tool

echo Checking administrator privileges...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Administrator access confirmed.
) else (
    echo [ERROR] Please run this batch file by right-clicking it and selecting 'Run as Administrator'.
    pause
    exit /b
)

echo Starting PowerShell installer and compiler script...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_build_environment.ps1"

pause
