@echo off
setlocal enabledelayedexpansion
echo ============================================
echo  CNDQ Complete Setup - No Browser Needed!
echo ============================================
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo.
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo Step 1: Checking for Chocolatey...
where choco >nul 2>&1
if %errorLevel% neq 0 (
    echo    Chocolatey not found. Installing...
    echo    This will take 1-2 minutes...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    if !errorLevel! neq 0 (
        echo    ERROR: Chocolatey installation failed!
        pause
        exit /b 1
    )
    echo    Chocolatey installed successfully
    echo.
    call refreshenv
) else (
    echo    Chocolatey already installed
)

echo.
echo Step 2: Checking for Laragon...
if exist "C:\laragon\laragon.exe" (
    echo    Laragon already installed at C:\laragon
    goto :CopyFiles
)

echo    Laragon not found. Installing via Chocolatey...
echo    This will take 3-5 minutes (downloading approx 100MB)
echo.
choco install laragon -y
if !errorLevel! neq 0 (
    echo    ERROR: Laragon installation failed!
    pause
    exit /b 1
)
echo    Laragon installed successfully

:CopyFiles
echo.
echo Step 3: Checking source directory...
if not exist "D:\WSL2\Ubuntu\CNDQ\" (
    if not exist "%~dp0" (
        echo ERROR: Source directory not found!
        pause
        exit /b 1
    )
    set "SOURCE_DIR=%~dp0"
) else (
    set "SOURCE_DIR=D:\WSL2\Ubuntu\CNDQ\"
)
echo    Source directory exists

echo.
echo Step 4: Creating destination directory...
if not exist "C:\laragon\www\" mkdir "C:\laragon\www\"
echo    www directory ready

echo.
echo Step 5: Copying project files...
echo    This may take a minute...

if exist "C:\laragon\www\CNDQ\" (
    echo    WARNING: CNDQ folder already exists in Laragon!
    set /p "overwrite=Do you want to overwrite it? (y/n): "
    if /i not "!overwrite!"=="y" (
        echo    Cancelled by user
        pause
        exit /b 0
    )
    echo    Removing old folder...
    rmdir /s /q "C:\laragon\www\CNDQ\"
)

echo    Copying from: !SOURCE_DIR!
echo    Copying to: C:\laragon\www\CNDQ\
xcopy "!SOURCE_DIR!" "C:\laragon\www\CNDQ\" /E /I /H /Y /EXCLUDE:!SOURCE_DIR!setup-laragon-exclude.txt 2>nul
if !errorLevel! equ 0 (
    echo    Files copied successfully
) else (
    echo    Files copied (some warnings may have occurred - this is usually OK)
)

echo.
echo ============================================
echo  Installation Complete!
echo ============================================
echo.
echo Next Steps:
echo.
echo 1. Start Laragon:
echo    - Press Windows key, type "Laragon", press Enter
echo    - OR run: C:\laragon\laragon.exe
echo.
echo 2. In Laragon window:
echo    - Right-click the tray icon (bottom-right corner)
echo    - Go to: PHP -^> Version -^> Select 8.3 (or 8.2)
echo    - Click "Start All" button
echo.
echo 3. Open your browser to:
echo    http://cndq.test
echo.
echo Your project is at: C:\laragon\www\CNDQ
echo.
echo If http://cndq.test doesn't work, try: http://localhost/CNDQ
echo.

pause