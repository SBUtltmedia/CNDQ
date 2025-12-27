# Local Development Setup

Choose your platform:

## 🍎 macOS (Office/Team)
**→ [setup_mac_localdev.md](setup_mac_localdev.md)**

Uses **Laravel Valet** (free, CLI-only, no GUI)
- Nginx + PHP-FPM
- Automatic `.test` domains
- No desktop app bloat
- Open source

## 🪟 Windows (Personal)
**→ [LOCAL_SETUP.md](LOCAL_SETUP.md)**

Uses **Herd** (free tier available)
- Nginx + PHP-FPM
- Automatic `.test` domains
- GUI-based (but works well)

## 🔧 Both Platforms

Both setups use:
- **`.env` file** for local authentication (simulates Shibboleth)
- **Same codebase** - no platform-specific code
- **JSON file storage** - no database needed
- **Identical behavior** - same Nginx + PHP-FPM stack

## Quick Start (After Platform Setup)

1. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit your email:**
   ```env
   MAIL=your_email@stonybrook.edu
   ```

3. **Visit site:**
   - http://cndq.test

4. **Test multi-user:**
   - http://cndq.test/dev_login.php

## Files You Need

- ✅ `.env` - Your local credentials (create from `.env.example`)
- ✅ `.env.example` - Template (in repo)
- ✅ `.htaccess` - Production Shibboleth config (ignored locally)
- ✅ `userData.php` - Loads `.env` automatically

## Production vs Local

| Aspect | Production | Local (Mac/Win) |
|--------|-----------|-----------------|
| Web Server | Apache | Nginx |
| PHP | PHP-FPM | PHP-FPM |
| Auth | Shibboleth | `.env` file |
| Config | `.htaccess` | `.env` |
| Domain | Live URL | `*.test` |

## Need Help?

- **macOS:** See [setup_mac_localdev.md](setup_mac_localdev.md)
- **Windows:** See [LOCAL_SETUP.md](LOCAL_SETUP.md)
- **Game Rules:** See [Problem.md](Problem.md)
- **Excel vs App:** See [excel_report.md](excel_report.md)
