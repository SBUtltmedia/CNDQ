# macOS Local Development Setup

> **Status**: ✅ Currently configured and tested on macOS with Laravel Valet
>
> **Test Environment**: http://cndq.test (via Valet)
> **PHP Version**: 8.5.1
> **Composer Version**: 2.9.2
> **Last Verified**: December 2024

---

## Prerequisites

- **macOS** (any recent version)
- **Homebrew** (package manager)
- **Git**

## Installing Homebrew (if not already installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## Step 1: Install PHP and Composer

```bash
# Install PHP 8.1+ and Composer
brew install php composer

# Verify installation
php --version    # Should show 8.1 or higher
composer --version
```

## Step 2: Install Laravel Valet

```bash
# Install Valet globally
composer global require laravel/valet

# Make sure Composer's global bin is in your PATH
# Add this to ~/.zshrc or ~/.bash_profile if not already there:
echo 'export PATH="$HOME/.composer/vendor/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Install Valet services
valet install
```

**What Valet does:**
- Installs Nginx
- Configures PHP-FPM
- Sets up `.test` domain DNS resolution
- Runs as background services (no GUI needed!)

## Step 3: Clone the CNDQ Repository

```bash
# Navigate to your projects folder
cd ~/Projects  # or wherever you keep projects

# Clone the repository
git clone <repository-url> CNDQ
cd CNDQ
```

## Step 4: Link the Project with Valet

```bash
# From inside the CNDQ directory
valet link cndq

# Verify it's linked
valet links
```

**Result:** Your site is now available at **http://cndq.test**

## Step 5: Configure Local Authentication

### Create `.env` file

```bash
# Copy the example file
cp .env.example .env

# Edit the file (use nano, vim, or any editor)
nano .env
```

### Edit `.env` contents:

```env
# Set your test user email
MAIL=your_name@stonybrook.edu
CN=your_cn
NICKNAME=your_nickname
GIVENNAME=Your First Name
SN=Your Last Name
```

**Why `.env`?**
- Production uses Apache + Shibboleth (reads `.htaccess`)
- Valet uses Nginx + PHP-FPM (ignores `.htaccess`)
- `.env` simulates Shibboleth authentication locally

## Step 6: Set File Permissions

```bash
# Make sure the data directory is writable
chmod -R 755 data/
```

## Step 7: Test the Installation

### Visit the site:

```bash
# Open in browser
open http://cndq.test
```

### Check authentication:

```bash
# Visit the auth debug page
open http://cndq.test/check_auth.php
```

**Expected output:**
```
✅ Authenticated as: your_name@stonybrook.edu
```

### Test with a new user:

1. Edit `.env` to change `MAIL=someone_new@stonybrook.edu`
2. Refresh http://cndq.test
3. New user should be auto-created with:
   - Random chemicals (500-2000 gallons each)
   - Automatic first production
   - Starting capital ($7k-$12k)

## Switching Between Users

### Method 1: Edit `.env` (Single User)

```bash
# Edit the MAIL variable
nano .env

# Save and refresh browser
```

### Method 2: Use dev_login.php (Multi-User)

Visit http://cndq.test/dev_login.php and click any team to switch users via cookies.

**Tip:** Use different browser profiles or incognito windows for multiple simultaneous users!

## Common Valet Commands

```bash
# Start Valet services
valet start

# Stop Valet services
valet stop

# Restart Valet services
valet restart

# View all linked sites
valet links

# Unlink a site
valet unlink cndq

# View Valet logs
valet log
```

## Troubleshooting

### Site not loading?

```bash
# Restart Valet
valet restart

# Check if Nginx is running
valet status
```

### "Not authenticated" error?

1. Check `.env` file exists: `ls -la .env`
2. Check `.env` has `MAIL=` set: `cat .env`
3. Visit http://cndq.test/check_auth.php to debug

### Database errors?

This project uses **JSON file storage**, not MySQL. No database setup needed!

### File permission errors?

```bash
# Fix data directory permissions
chmod -R 755 data/
chown -R $(whoami) data/
```

## Architecture Overview

### Local Development (macOS + Valet):
```
Browser → Nginx → PHP-FPM → .env file → userData.php → Authenticated
```

### Production (Linux + Apache + Shibboleth):
```
Browser → Apache → .htaccess → Shibboleth → $_SERVER['mail'] → Authenticated
```

### File Loading Priority:

`userData.php` checks authentication in this order:
1. `$_COOKIE['mock_mail']` (from dev_login.php)
2. `$_SERVER['mail']` (from .env file OR Shibboleth)
3. `dev_user@localhost` (fallback)

## Uninstalling Valet (if needed)

```bash
# Stop and uninstall Valet
valet stop
valet uninstall

# Remove the package
composer global remove laravel/valet
```

## Additional Tips

### Use HTTPS locally (optional):

```bash
# Secure a site with self-signed certificate
valet secure cndq

# Now visit: https://cndq.test
```

### Change PHP version:

```bash
# Install another PHP version
brew install php@8.2

# Link it
brew unlink php@8.1
brew link php@8.2

# Restart Valet
valet use php@8.2
valet restart
```

### Share your local site temporarily:

```bash
# Create a public URL via ngrok
valet share
```

## Team Collaboration

When setting up for multiple developers:

1. Each developer creates their own `.env` with their own `MAIL=` value
2. `.env` is gitignored, so everyone has their own config
3. Share `.env.example` in the repo as a template
4. Use http://cndq.test/dev_login.php to test as different users

## Next Steps

✅ Your site is running at http://cndq.test
✅ You're authenticated via `.env` file
✅ New users auto-generate with random inventory and starting capital

**Ready to develop!** Any code changes will be immediately reflected - just refresh the browser.

---

**Questions?** Check `LOCAL_SETUP.md` for more details about the authentication system.

**Windows Setup?** See the main README (Herd-based setup).
