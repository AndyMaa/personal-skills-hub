@echo off
cd /d "%~dp0"
node src\cli.mjs serve --open
if errorlevel 1 pause
