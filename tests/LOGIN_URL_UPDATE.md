# Login URL Update - dev.php

## Changes Made

Updated all test files to use the correct login URL: `dev.php` instead of `dev_login.php`

## Files Updated

### Core Helper
- ✅ `tests/helpers/browser.js` - Updated login() method

### Test Files
- ✅ `tests/auto-advance-test.js`
- ✅ `tests/haggle-test.js`
- ✅ `tests/rpc-to-rpc-test.js`
- ✅ All other test files using the helper

### Documentation
- ✅ `tests/DUAL_TESTING.md`
- ✅ `tests/API_TESTING.md`
- ✅ Other test documentation

## Login URL Format

```
http://cndq.test/CNDQ/dev.php?user=EMAIL
```

### Example

```javascript
// Login as admin
await page.goto('http://cndq.test/CNDQ/dev.php?user=admin@stonybrook.edu');

// Login as test user
await page.goto('http://cndq.test/CNDQ/dev.php?user=test_mail1@stonybrook.edu');
```

## Using BrowserHelper

The `BrowserHelper.login()` method automatically uses the correct URL:

```javascript
const browser = new BrowserHelper(config);
await browser.launch();

// This now uses dev.php automatically
await browser.login(page, 'admin@stonybrook.edu');
```

## Verification

All tests should now work correctly with the updated login URL. Run:

```bash
# Test API endpoints
npm run test:api

# Test UI playability
npm run test:ui-play

# Test both and compare
npm run test:dual
```

## What dev.php Does

1. Receives `?user=EMAIL` parameter
2. Sets `mock_mail` cookie with the email
3. Redirects to main page (`./`)
4. User is now "logged in" for testing

## Cookie Details

```php
setcookie('mock_mail', $user, [
    'expires' => time() + (86400 * 30),  // 30 days
    'path' => '/',
    'samesite' => 'Lax'  // Works with Puppeteer
]);
```

## Troubleshooting

If tests fail with authentication errors:

1. **Verify dev.php is accessible**
   ```bash
   curl http://cndq.test/CNDQ/dev.php
   ```

2. **Check cookie is set**
   ```javascript
   const cookies = await page.cookies();
   console.log('Cookies:', cookies);
   // Should see: { name: 'mock_mail', value: 'user@example.com' }
   ```

3. **Test manual login**
   - Open browser
   - Go to http://cndq.test/CNDQ/dev.php
   - Click on a user
   - Verify redirect works

## Migration Complete ✅

All tests now use `dev.php` for authentication.
