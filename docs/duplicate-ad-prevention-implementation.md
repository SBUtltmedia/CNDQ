# Duplicate Advertisement Prevention - Implementation Summary

## Overview

Implemented a robust three-layer system to prevent users from creating duplicate advertisements while maintaining good UX and handling edge cases like rapid clicking.

## Problem Statement

**Original Issues**:
1. Users could spam the marketplace by repeatedly clicking "Post Buy/Sell Interest" buttons
2. No feedback when attempting to post duplicate advertisements
3. Race conditions from rapid clicking could create duplicates
4. Poor user experience - unclear why button clicks weren't working

## Solution Architecture

### Three-Layer Defense System

```
User Click
    ↓
1. Pending Check (immediate) ─→ "Already posting..." warning
    ↓
2. Client State Check ─────────→ "You already have..." warning
    ↓
3. Server Validation ───────────→ Returns existing ad
    ↓
Client handles response ────────→ Shows appropriate toast
```

### Layer 1: Pending Posts Tracking

**File**: `js/marketplace.js:36-37`

```javascript
// Track pending ad posts to prevent race conditions
this.pendingAdPosts = new Set();
```

**Purpose**: Prevents rapid-fire clicks from triggering multiple API calls simultaneously

**Example**:
```
Click 1: Add "C-sell" to pendingAdPosts → Call API
Click 2 (0.1s later): "C-sell" in pendingAdPosts → Show warning, return early
```

### Layer 2: Client-Side Duplicate Check

**File**: `js/marketplace.js:406-413`

```javascript
// Check if user already has an active advertisement
const existingAds = this.advertisements[chemical]?.[type] || [];
const hasActiveAd = existingAds.some(ad => ad.teamId === this.currentUser);

if (hasActiveAd) {
    this.showToast(`You already have an active ${type} advertisement for Chemical ${chemical}`, 'warning');
    return;
}
```

**Purpose**: Prevent unnecessary API calls by checking local state first

**Example**:
```javascript
User has: { C: { sell: [{teamId: 'user1', ...}] } }
Click "Post Sell C" → Check shows existing ad → Warning toast
```

### Layer 3: Server-Side Protection

**File**: `lib/AdvertisementManager.php:58-66`

```php
// Check if an active advertisement already exists
foreach ($data['ads'] as $existingAd) {
    if ($existingAd['status'] === 'active'
        && $existingAd['chemical'] === $chemical
        && $existingAd['type'] === $type
        && $existingAd['teamId'] === $this->teamEmail) {
        // Already exists, return the existing one
        return $existingAd;
    }
}
```

**Purpose**: Final safeguard - even if client checks fail, server prevents duplicates

**Client Detection**: `js/marketplace.js:421-429`

```javascript
// Check if the returned ad was just created or already existed
const returnedAd = response.advertisement;
const isNewAd = returnedAd && (Date.now() - returnedAd.createdAt * 1000) < 2000;

if (isNewAd) {
    this.showToast(`Posted interest to ${type} ${chemical}`, 'success');
} else {
    this.showToast(`You already have an active ${type} advertisement for Chemical ${chemical}`, 'warning');
}
```

## User Experience

### Scenario 1: Normal Post
```
User clicks "Post Sell Interest" for C
→ No existing ad found
→ API creates ad
→ ✅ Toast: "Posted interest to sell C"
→ Ad appears in marketplace
```

### Scenario 2: Duplicate Attempt
```
User clicks "Post Sell Interest" for C again
→ Client detects existing ad
→ API not called
→ ⚠️ Toast: "You already have an active sell advertisement for Chemical C"
→ No change in marketplace
```

### Scenario 3: Rapid Clicking (Race Condition)
```
User rapidly clicks "Post Sell Interest" 5 times

Click 1:
→ No existing ad, not pending
→ Add to pendingAdPosts
→ Call API...

Click 2 (0.1s later):
→ Still pending from Click 1
→ ⚠️ Toast: "Already posting sell advertisement for Chemical C..."
→ Return early

Click 3-5 (within 2 seconds):
→ Either pending OR exists in local state
→ ⚠️ Warning toast
→ Return early

Result: Only 1 advertisement created
```

### Scenario 4: Different Chemical/Type
```
User has sell ad for C, clicks "Post Buy Interest" for C
→ Different type, so no duplicate
→ ✅ Toast: "Posted interest to buy C"
→ Both ads visible

User has sell ad for C, clicks "Post Sell Interest" for N
→ Different chemical, so no duplicate
→ ✅ Toast: "Posted interest to sell N"
→ Both ads visible
```

### Scenario 5: After Trade Completion
```
User completes a trade, removing their sell ad for C
→ Ad removed from marketplace
→ Click "Post Sell Interest" for C
→ No existing ad found
→ ✅ Toast: "Posted interest to sell C"
→ New ad created
```

## Toast Messages

| Situation | Type | Message | Icon |
|-----------|------|---------|------|
| New ad created | Success | "Posted interest to sell C" | ✓ |
| Duplicate detected | Warning | "You already have an active sell advertisement for Chemical C" | ⚠ |
| Currently posting | Warning | "Already posting sell advertisement for Chemical C..." | ⚠ |
| API error | Error | "Failed to post advertisement: [error]" | ✗ |

## Edge Cases Handled

### 1. Race Conditions
**Problem**: Multiple clicks before first API call completes
**Solution**: `pendingAdPosts` Set prevents simultaneous calls

### 2. Stale Client State
**Problem**: Client state might not reflect server state
**Solution**: Server-side check + timestamp validation on response

### 3. Network Delays
**Problem**: Slow network could allow duplicates
**Solution**: Pending check blocks immediately, doesn't depend on network

### 4. Browser Refresh
**Problem**: Pending state lost on page refresh
**Solution**: `loadAdvertisements()` called on init, populates state correctly

### 5. Trading Phase Not Active
**Problem**: API returns 403 when trading disabled
**Solution**: Error toast shows user-friendly message

## Files Modified

1. **js/marketplace.js**
   - Lines 36-37: Added `pendingAdPosts` Set
   - Lines 394-440: Complete `postAdvertisement()` rewrite

2. **docs/toast-features.md**
   - Updated documentation for duplicate prevention

3. **test/test-duplicate-ads.js**
   - Created automated Puppeteer test

4. **test/manual-duplicate-test.md**
   - Created manual test checklist

## Testing

### Automated Test
```bash
node test/test-duplicate-ads.js
```

**Prerequisites**:
- Game phase must be set to "trading"
- Test user must be authenticated

### Manual Test
See `test/manual-duplicate-test.md` for step-by-step manual testing guide

### Quick Verification
1. Open marketplace
2. Click "Post Sell Interest" for Chemical C
3. Click again immediately
4. Should see warning toast, not success
5. Only one ad should appear in marketplace

## Performance Impact

- **Minimal**: O(1) Set operations for pending check
- **Reduced API Calls**: Client checks prevent unnecessary requests
- **Better UX**: Immediate feedback, no waiting for API response to know it's a duplicate

## Security

- **Client checks**: UX optimization only, not security boundary
- **Server validation**: True security - always enforced
- **No bypass possible**: Even if client is modified, server prevents duplicates

## Future Enhancements

1. **Ad Removal UI**: Allow users to manually remove their ads
2. **Ad Expiration**: Auto-remove old advertisements after N hours
3. **Multiple Ads**: Allow users to post multiple ads with different prices
4. **Ad Editing**: Edit existing ads instead of remove + repost
5. **Toast Deduplication**: Prevent showing same warning toast multiple times rapidly

## Conclusion

The three-layer approach provides:
- ✅ Robust protection against duplicates
- ✅ Excellent user experience with clear feedback
- ✅ Performance optimization by reducing API calls
- ✅ Graceful handling of edge cases
- ✅ Server-side security as final authority

Users can no longer spam the marketplace, and they get clear feedback about why duplicate posts are prevented.
