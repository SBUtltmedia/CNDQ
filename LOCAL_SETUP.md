# Local Development Setup for Herd

## Authentication Setup

### Why Two Systems?

**Production (Apache + Shibboleth):**
- Uses `.htaccess` with Shibboleth module
- Automatically sets `$_SERVER['mail']` from university SSO
- No manual configuration needed

**Local Development (Herd = Nginx + PHP-FPM):**
- `.htaccess` is **ignored** (Nginx doesn't use it)
- Uses `.env` file loaded by `userData.php`
- Simulates Shibboleth environment variables

## Setup Instructions

### Option 1: Use .env File (Recommended)

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to set your test user:
   ```env
   MAIL=your_test_email@stonybrook.edu
   ```

3. Visit http://cndq.test/ - you'll be logged in as that user

### Option 2: Use Cookie Override (Multi-User Testing)

1. Visit http://cndq.test/dev_login.php
2. Click any team to set the `mock_mail` cookie
3. Each browser tab can be a different user!

### Priority Order

`userData.php` checks authentication in this order:
1. `$_COOKIE['mock_mail']` (dev_login.php)
2. `$_SERVER['mail']` (.env file or Shibboleth)
3. `dev_user@localhost` (fallback for no auth)

## Testing New Users

When you visit the site with a new email (never seen before):
1. Random inventory generated (500-2000 gallons per chemical)
2. Automatic LP production runs
3. Products sold → Starting capital generated ($7k-$12k)
4. Ready to trade immediately!

## Files

- `.env` - Your local credentials (gitignored)
- `.env.example` - Template
- `.htaccess` - Production Shibboleth config (ignored locally)
- `userData.php` - Loads `.env` automatically
- `dev_login.php` - Quick user switching tool
