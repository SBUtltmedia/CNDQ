# Manual Test: Duplicate Advertisement Prevention

## Prerequisites
1. Ensure game phase is set to "trading" in admin panel
2. Open the marketplace in a browser
3. Open browser DevTools console to see logs

## Test Cases

### Test 1: First Post (Should Succeed)
**Steps**:
1. Click "Post Sell Interest" button for Chemical C
2. Observe the toast notification

**Expected**:
- ✅ Success toast: "✓ Posted interest to sell C"
- Advertisement appears in "Teams Wanting to Sell" for Chemical C

**Actual**: ___________

---

### Test 2: Immediate Duplicate (Should Be Prevented)
**Steps**:
1. Immediately click "Post Sell Interest" for Chemical C again
2. Observe the toast notification

**Expected**:
- ⚠️ Warning toast: "⚠ You already have an active sell advertisement for Chemical C"
- No new advertisement created

**Actual**: ___________

---

### Test 3: Different Type (Should Succeed)
**Steps**:
1. Click "Post BUY Interest" for Chemical C (different type, same chemical)
2. Observe the toast notification

**Expected**:
- ✅ Success toast: "✓ Posted interest to buy C"
- Advertisement appears in "Teams Wanting to Buy" for Chemical C
- Both buy AND sell ads should be visible

**Actual**: ___________

---

### Test 4: Different Chemical (Should Succeed)
**Steps**:
1. Click "Post Sell Interest" for Chemical N (different chemical)
2. Observe the toast notification

**Expected**:
- ✅ Success toast: "✓ Posted interest to sell N"
- Advertisement appears for Chemical N

**Actual**: ___________

---

### Test 5: Rapid Clicking (Spam Prevention)
**Steps**:
1. Rapidly click "Post Sell Interest" for Chemical D multiple times (5-10 clicks)
2. Observe all toast notifications

**Expected**:
- First click: ✅ "✓ Posted interest to sell D"
- Second click: ⚠️ "⚠ Already posting sell advertisement for Chemical D..."
- Subsequent clicks: ⚠️ "⚠ You already have an active sell advertisement for Chemical D"
- Only ONE advertisement created in marketplace

**Actual**: ___________

---

### Test 6: After Trade Completion
**Steps**:
1. Complete a trade that removes your sell ad for Chemical C
2. Try to post a sell ad for Chemical C again

**Expected**:
- ✅ Success toast: "✓ Posted interest to sell C"
- New advertisement created (since old one was removed)

**Actual**: ___________

---

## Implementation Details

### Three-Layer Protection

1. **Pending Check** (`pendingAdPosts` Set)
   - Prevents race conditions from rapid clicking
   - Shows: "Already posting..." warning

2. **Client-Side Duplicate Check** (`advertisements` state)
   - Checks local state before API call
   - Shows: "You already have an active..." warning

3. **Server-Side Protection** (AdvertisementManager.php)
   - Final safeguard at database level
   - Returns existing ad instead of creating duplicate
   - Client detects old timestamp and shows warning

### Code Locations

- **Client Logic**: `js/marketplace.js:397-440` (postAdvertisement function)
- **Server Logic**: `lib/AdvertisementManager.php:58-66` (duplicate check)
- **API Endpoint**: `api/advertisements/post.php:29-40` (trading phase check)

### Expected Console Logs

When posting a duplicate, you should see:
```javascript
// First attempt
Posted interest to sell C
Advertisement posted successfully

// Duplicate attempt
You already have an active sell advertisement for Chemical C
```

## Notes

- Advertisements are automatically removed when:
  - A trade is completed
  - User manually removes them (if UI provides that option)
  - Session is reset

- Server always prevents duplicates, even if client checks fail
- Client checks provide better UX by preventing unnecessary API calls
