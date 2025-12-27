# Laragon Setup Guide - Simple 3-Step Process

## Step 1: Install Laragon (5 minutes)

1. **Download Laragon Full**
   - Go to: https://laragon.org/download/
   - Click "Laragon Full" (not Lite)
   - Save the installer

2. **Run the installer**
   - Double-click the downloaded file
   - Accept all defaults
   - Install to `C:\laragon`
   - Wait for installation to complete

## Step 2: Run the Setup Script (2 minutes)

1. **Find the script**
   - Located at: `D:\WSL2\Ubuntu\CNDQ\setup-laragon.bat`

2. **Run as Administrator**
   - Right-click `setup-laragon.bat`
   - Click "Run as administrator"
   - Click "Yes" on the security prompt

3. **Wait for completion**
   - The script will copy all your files
   - You'll see checkmarks ✓ for each step

## Step 3: Start Laragon (1 minute)

1. **Launch Laragon**
   - Find Laragon in Start Menu
   - Or run from `C:\laragon\laragon.exe`

2. **Set PHP Version**
   - Right-click the Laragon icon in system tray (bottom-right)
   - Go to: PHP → Version → 8.3 (or highest available)

3. **Start Everything**
   - Click the big "Start All" button
   - Wait for services to turn green

4. **Open Your Site**
   - Open browser
   - Go to: http://cndq.test
   - Your site should load!

---

## Troubleshooting

### "cndq.test doesn't load"
1. Right-click Laragon tray icon
2. Apache → Reload
3. Try http://localhost/CNDQ

### Manual Virtual Host Setup
If http://cndq.test still doesn't work:
1. Right-click Laragon → Tools → Menu → Add Virtual Host
2. Name: `cndq.test`
3. Directory: `C:\laragon\www\CNDQ`
4. Restart Apache

### Port 80 Already in Use
- Close Skype (uses port 80)
- Disable IIS if installed
- Or change Laragon port: Right-click → Apache → httpd.conf → change `Listen 80` to `Listen 8080`

---

## Quick Reference

**Project Location:** `C:\laragon\www\CNDQ`

**Site URL:** http://cndq.test

**Laragon Controls:** Right-click tray icon for all options

**Open Terminal:** Right-click → Terminal (opens in project folder)

**File Manager:** Right-click → www (opens C:\laragon\www)

---

## For Tuesday (Mac)

Your `.ddev` folder is safely stored, so on Mac you can:
1. Install DDEV + Podman Desktop or Docker Desktop
2. Copy your project with the `.ddev` folder
3. Run `ddev start`
4. Everything works the same!

The `.ddev` configuration is preserved in your project backup.
