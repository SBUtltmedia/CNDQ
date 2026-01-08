@echo off
:: CNDQ Setup Script for Windows (Presupposes Chocolatey)
:: This script sets up the local development environment for CNDQ.

echo 🚀 Starting CNDQ Setup for Windows...

:: 1. Check for Admin Privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Running with Administrator privileges.
) else (
    echo ❌ ERROR: Please run this script as Administrator.
    pause
    exit /b 1
)

:: 2. Check for Chocolatey
where choco >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Chocolatey found.
) else (
    echo 📦 Installing Chocolatey...
    @"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))" && SET "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
)

:: 3. Install Requirements
echo 📦 Installing requirements via Chocolatey...
choco install php -y
choco install composer -y
choco install nodejs -y

:: 4. Project Setup
echo 📂 Setting up project dependencies...
cd %~dp0

:: Install PHP dependencies
call composer install

:: Install Node dependencies
call npm install

:: 5. Configure Environment
echo 🔧 Configuring environment variables...
if exist ".env.example" (
    :: Move/Copy logic: User requested moving/setting up .env in parent dir
    if not exist "..\.env" (
        echo    Creating ..\.env from .env.example
        copy .env.example ..\.env
    ) else (
        echo    ..\.env already exists. Skipping creation.
    )
) else (
    echo ⚠️ .env.example not found in current directory!
)

:: 6. Setup Herd Instruction
echo.
echo ✅ Setup Complete!
echo.
echo 🐘 NEXT STEPS FOR HERD:
echo 1. Open the Herd UI.
echo 2. Go to 'Sites'.
echo 3. Add the parent folder (%~dp0..) to Herd's 'Paths'.
echo 4. The application should now be available at: http://cndq_localroot.test/CNDQ/
echo.
echo ℹ️  Authentication is handled via dev.php in local development.
pause
