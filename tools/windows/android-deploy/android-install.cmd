@echo off
setlocal
powershell.exe -ExecutionPolicy Bypass -File "%~dp0Invoke-AndroidDeploy.ps1" -Action install %*
