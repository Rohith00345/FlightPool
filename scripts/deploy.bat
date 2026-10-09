@echo off
echo ========================================================
echo   FlightPool Docker Deployment Script
echo ========================================================
echo.

echo 1. Verifying Docker daemon...
docker version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Docker daemon is not running.
  echo Please open Docker Desktop on your machine and wait for it to start.
  pause
  exit /b 1
)

echo 2. Building production Docker image (flightpool:latest)...
docker build -t flightpool:latest .
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Docker build failed.
  pause
  exit /b 1
)

echo.
echo 3. Starting container via Docker Compose...
docker compose up -d
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Docker compose failed.
  pause
  exit /b 1
)

echo.
echo ========================================================
echo   FlightPool is live in Docker!
echo   Access at: http://localhost:3000
echo ========================================================
pause
