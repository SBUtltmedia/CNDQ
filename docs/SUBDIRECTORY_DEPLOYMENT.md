# Subdirectory Deployment Guide

## Overview

The CNDQ app now automatically detects its installation path and works correctly when deployed in a subdirectory (e.g., `https://apps.tlt.stonybrook.edu/cndq/`).

## Changes Made

### 1. JavaScript API Client (`js/api.js`)

**Added auto-detection of base path:**
```javascript
function getBasePath() {
    const scriptUrl = new URL(import.meta.url);
    const pathParts = scriptUrl.pathname.split('/');
    pathParts.pop(); // Remove 'api.js'
    pathParts.pop(); // Remove 'js'
    return `${scriptUrl.protocol}//${scriptUrl.host}${pathParts.join('/')}`;
}

export const api = new ApiClient(getBasePath());
```

**How it works:**
- If script is at: `https://apps.tlt.stonybrook.edu/cndq/js/api.js`
- Base path becomes: `https://apps.tlt.stonybrook.edu/cndq`
- API calls go to: `https://apps.tlt.stonybrook.edu/cndq/api/...`

### 2. Admin Panel (`admin.html`)

**Added path helper functions:**
```javascript
function getBasePath() {
    const path = window.location.pathname;
    const pathParts = path.split('/');
    pathParts.pop(); // Remove 'admin.html' or empty
    return pathParts.join('/') || '';
}

function apiUrl(endpoint) {
    const base = getBasePath();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return base ? `${base}/${cleanEndpoint}` : `/${cleanEndpoint}`;
}
```

**Updated all fetch calls:**
- Before: `fetch('/api/admin/session.php')`
- After: `fetch(apiUrl('/api/admin/session.php'))`

## Deployment Scenarios

### Root Domain
**URL**: `https://cndq.example.com/`
- Base path: `` (empty)
- API calls: `/api/...`
- Works as before ✓

### Subdirectory
**URL**: `https://apps.tlt.stonybrook.edu/cndq/`
- Base path: `/cndq`
- API calls: `/cndq/api/...`
- Auto-detected ✓

### Deep Subdirectory
**URL**: `https://example.com/apps/games/cndq/`
- Base path: `/apps/games/cndq`
- API calls: `/apps/games/cndq/api/...`
- Auto-detected ✓

## File Structure

```
cndq/
├── index.html              # Main game (imports js/marketplace.js → api.js)
├── admin.html              # Admin panel (uses apiUrl() helper)
├── js/
│   ├── api.js             # API client with auto-detection
│   ├── marketplace.js     # Imports api.js
│   └── ...
├── api/                   # Backend endpoints
│   ├── team/
│   ├── admin/
│   └── ...
└── lib/                   # PHP classes
```

## Testing

### Verify Base Path Detection

**JavaScript Console (on game page):**
```javascript
// Check detected base path
import { api } from './js/api.js';
console.log(api.baseUrl);
// Should show: https://apps.tlt.stonybrook.edu/cndq
```

**Admin Panel:**
```javascript
// Check base path helper
console.log(getBasePath());
// Should show: /cndq (or empty if root)
console.log(apiUrl('/api/admin/session.php'));
// Should show: /cndq/api/admin/session.php
```

### Test API Calls

1. Open browser console
2. Navigate to game or admin panel
3. Check Network tab for API requests
4. Verify all requests go to correct subdirectory path

## Troubleshooting

### Issue: API calls return 404

**Check:**
1. Browser console for actual URL being called
2. Network tab shows full request URL
3. Base path detection in console

**Common causes:**
- `.htaccess` rewrite rules interfering
- Missing trailing slash on subdirectory
- Web server not configured for subdirectory

### Issue: Assets not loading (CSS, images)

**If you have hardcoded asset paths:**
- ❌ Bad: `<link href="/css/style.css">`
- ✅ Good: `<link href="css/style.css">` (relative)

### Issue: Redirects going to wrong path

Check PHP files for:
```php
// ❌ Bad: Absolute path
header('Location: /admin.html');

// ✅ Good: Relative path
header('Location: admin.html');
```

## Future Considerations

### Environment Configuration (Optional)

If you need more control, create a config file:

**`config.php`:**
```php
<?php
return [
    'basePath' => getenv('APP_BASE_PATH') ?: '',
    'baseUrl' => getenv('APP_BASE_URL') ?: ''
];
```

**`.env`:**
```
APP_BASE_PATH=/cndq
APP_BASE_URL=https://apps.tlt.stonybrook.edu/cndq
```

But this is **not needed** - auto-detection handles it!

## Deployment Checklist

- [x] JavaScript API client auto-detects base path
- [x] Admin panel uses apiUrl() helper
- [x] All API fetch calls updated
- [x] Relative paths for assets (CSS, images, scripts)
- [ ] Test in production subdirectory
- [ ] Verify all API endpoints work
- [ ] Check admin panel functionality
- [ ] Test game features (trading, production)

## Notes

- **No configuration needed** - paths are auto-detected
- **Works at any subdirectory depth**
- **Compatible with root domain deployment**
- **No hardcoded URLs** in frontend code
