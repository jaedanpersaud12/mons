@echo off
rem Rebuilds build\Mons.exe from this project. Double-click it, or run it from a terminal.
rem Needs Godot 4.6 and its export templates (in Godot: Editor > Manage Export Templates > Download and Install).
rem If Godot is not on your PATH, set GODOT to its full path first, for example:
rem   set GODOT=C:\Tools\Godot_v4.6-stable_win64.exe
setlocal
cd /d "%~dp0"
if "%GODOT%"=="" set GODOT=godot
if not exist build mkdir build
"%GODOT%" --headless --path . --export-release "Windows Desktop" build\Mons.exe
if errorlevel 1 (
  echo.
  echo Build failed. Check that GODOT points at Godot 4.6 and that the export templates are installed.
  pause
  exit /b 1
)
echo.
echo Built build\Mons.exe
pause
