@echo off
echo ============================================
echo  CNDQ Laragon Setup Script
echo ============================================
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo Step 1: Checking if Laragon is installed...
if not exist "C:\laragon\laragon.exe" (
    echo ERROR: Laragon not found at C:\laragon\
    echo.
    echo Please install Laragon first:
    echo 1. Download from https://laragon.org/download/
    echo 2. Choose "Laragon Full" version
    echo 3. Install to default location C:\laragon
    echo 4. Run this script again
    pause
    exit /b 1
)
echo    ✓ Laragon found

echo.
echo Step 2: Checking source directory...
if not exist "D:\WSL2\Ubuntu\CNDQ\" (
    echo ERROR: Source directory not found!
    pause
    exit /b 1
)
echo    ✓ Source directory exists

echo.
echo Step 3: Creating destination directory...
if not exist "C:\laragon\www\" mkdir "C:\laragon\www\"
echo    ✓ www directory ready

echo.
echo Step 4: Copying project files...
echo    This may take a minute...

if exist "C:\laragon\www\CNDQ\" (
    echo    WARNING: CNDQ folder already exists in Laragon!
    set /p "overwrite=Do you want to overwrite it? (y/n): "
    if /i not "%overwrite%"=="y" (
        echo    Cancelled by user
        pause
        exit /b 0
    )
    echo    Removing old folder...
    rmdir /s /q "C:\laragon\www\CNDQ\"
)

xcopy "D:\WSL2\Ubuntu\CNDQ" "C:\laragon\www\CNDQ\" /E /I /H /Y /EXCLUDE:setup-laragon-exclude.txt
if %errorLevel% equ 0 (
    echo    ✓ Files copied successfully
) else (
    echo    ERROR: Copy failed!
    pause
    exit /b 1
)

echo.
echo Step 5: Creating virtual host configuration...
echo.

echo    Please do the following in Laragon:
echo    1. Start Laragon if not running
echo    2. Right-click Laragon tray icon
echo    3. Go to PHP → Version → Select PHP 8.3 (or 8.2/8.1)
echo    4. Click "Start All" button
echo    5. Right-click again → Apache → Reload
echo.

echo ============================================
echo  Setup Complete!
echo ============================================
echo.
echo Your project is now at: C:\laragon\www\CNDQ
echo.
echo After starting Laragon, your site should be available at:
echo    http://cndq.test
echo.
echo If the URL doesn't work:
echo    Right-click Laragon → Tools → Menu → Add Virtual Host
echo    Name: cndq.test
echo    Directory: C:\laragon\www\CNDQ
echo.

pause
