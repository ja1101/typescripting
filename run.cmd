@echo off
REM ============================================================
REM  run.cmd — Build and run src/index.ts on Windows
REM  Usage: run.cmd
REM ============================================================

echo [1/3] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install failed.
    exit /b %ERRORLEVEL%
)

echo [2/3] Compiling TypeScript...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: TypeScript compilation failed.
    exit /b %ERRORLEVEL%
)

echo [3/3] Running the application...
call npm start
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Application exited with code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)
