@echo off
title Fitness Tracker — Deploy
cd /d "%~dp0"

:: Optional commit message as first argument, e.g.: deploy.bat "Fix: something"
set "MSG=%~1"
if "%MSG%"=="" set "MSG=chore: update"

echo.
echo  =========================================
echo   Fitness Tracker — Build ^& Deploy
echo  =========================================
echo   Commit: %MSG%
echo.

git add -A
git commit -m "%MSG%"
git push
npm run deploy

echo.
echo  =========================================
echo   Done! Site: https://leriot.github.io/fitness-tracker-slerpy-gym/
echo  =========================================
echo.
pause
