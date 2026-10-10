@echo off
REM ============================================================
REM  CodeQuest — One-Click Server  (personal use)
REM  Double-click this file. That's it.
REM
REM  Folder layout it expects:
REM    YourFolder\
REM      CodeQuest\      <- this repo (where this file lives)
REM      project\        <- the project to analyze
REM
REM  It starts the CodeQuest server on your project and opens
REM  http://127.0.0.1:1337 in your browser. Fully offline.
REM  Close the "CodeQuest Server" window to stop it.
REM ============================================================
setlocal

REM --- Check for Node.js ---
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo  [CodeQuest] Node.js is not installed.
  echo.
  echo  Download it free from https://nodejs.org (pick the LTS version),
  echo  install it, then double-click this file again.
  echo.
  pause
  exit /b 1
)

set "CQDIR=%~dp0"
if "%CQDIR:~-1%"=="\" set "CQDIR=%CQDIR:~0,-1%"

REM --- Find the project folder: ../project, or first sibling dir ---
set "PROJECT=%CQDIR%\..\project"
if not exist "%PROJECT%" (
  set "PROJECT="
  for /d %%D in ("%CQDIR%\..\*") do (
    if /i not "%%~nxD"=="CodeQuest" (
      if not defined PROJECT set "PROJECT=%%D"
    )
  )
)
if not defined PROJECT (
  echo.
  echo  [CodeQuest] Couldn't find a project folder next to CodeQuest.
  echo.
  echo  Make a folder like this:
  echo    YourFolder\
  echo      CodeQuest\   ^(this repo^)
  echo      project\     ^(the code you want analyzed^)
  echo.
  pause
  exit /b 1
)

echo.
echo  [CodeQuest] Starting server for "%PROJECT%" ...
echo  [CodeQuest] Close the "CodeQuest Server" window to stop it.
echo.

REM --- Start the server in its own window, then open the browser ---
start "CodeQuest Server" node "%CQDIR%\codequest\bin\codequest" visualize "%PROJECT%"
timeout /t 4 /nobreak >nul
start http://127.0.0.1:1337

endlocal
