# CNDQ Marketplace Debug Report

**Issue**: "Crafty Otter" (test user) not seeing "Sell to" offers from NPCs

**Date**: 2026-01-15

---

## Executive Summary

✅ **Backend is working correctly** - NPCs are creating buy advertisements
✅ **API is returning correct data** - 3 buy ads for Chemical D
✅ **Crafty Otter has inventory** - 1480 gallons of Chemical D
❓ **Frontend rendering needs verification** - Need to check browser console

---

## Investigation Results

### 1. NPCs Are Active ✓
```
Strategic Jaguar (npc_6969c38503e7c@system) - ACTIVE
Master Tiger (npc_6969c3851fcee@system) - ACTIVE
Legendary Eagle (npc_6969c3853e59b@system) - ACTIVE
```

### 2. Buy Advertisements Exist ✓
NPCs have created buy advertisements for Chemical D:
- Strategic Jaguar: D @ $8.14 (500 gal)
- Master Tiger: D @ $8.14 (500 gal)
- Legendary Eagle: D @ $8.14 (500 gal)

### 3. API Endpoint Works ✓
`/api/advertisements/list.php` returns:
```json
{
  "success": true,
  "advertisements": {
    "D": {
      "buy": [
        {
          "id": "ad_1768539312_f434fb6c",
          "teamId": "npc_6969c38503e7c@system",
          "chemical": "D",
          "type": "buy",
          "teamName": "Strategic Jaguar"
        },
        // ... 2 more ads
      ]
    }
  }
}
```

### 4. Crafty Otter's Profile ✓
```
Email: test_mail1@stonybrook.edu
Inventory:
  Chemical C: 1665 gallons
  Chemical D: 1480 gallons ← HAS INVENTORY
  Chemical N: 1605 gallons
  Chemical Q: 1325 gallons

Shadow Prices:
  Chemical D: $8.57 ← High shadow price (should want to SELL)
```

### 5. Frontend Filtering Logic ✓
The frontend filters ads by inventory (marketplace.js:613):
```javascript
const buyAds = myInventory > 0 ? allBuyAds : [];
```

**Result**: Crafty Otter has 1480 gallons of D, so all 3 buy ads should pass the filter.

---

## Data Flow Analysis

```
1. NPC decides to buy Chemical D
   ↓
2. NPCManager::executeCreateBuyOrder()
   ↓
3. TeamStorage->addBuyOrder() [creates 'add_buy_order' event]
   ↓
4. AdvertisementManager->postAdvertisement() [creates 'add_ad' event]
   ↓
5. marketplace_events table stores both events
   ↓
6. MarketplaceAggregator->getAggregatedFromEvents() reads events
   ↓
7. AdvertisementManager::getAdvertisementsByChemical() returns ads
   ↓
8. API /api/advertisements/list.php returns JSON
   ↓
9. Frontend api.advertisements.list() fetches data
   ↓
10. marketplace.js stores in this.advertisements
   ↓
11. marketplace.js calls renderAdvertisements()
   ↓
12. chemical-card component receives buyAds prop
   ↓
13. chemical-card renders <advertisement-item> elements
   ↓
14. advertisement-item shows "Sell to" button
```

**Steps 1-8**: ✅ Verified working
**Steps 9-14**: ❓ Need to verify in browser

---

## Next Steps

To complete the diagnosis, you need to:

### Option 1: Use the Debug HTML Page
1. Open [http://cndq.test/CNDQ/test-frontend-debug.html](http://cndq.test/CNDQ/test-frontend-debug.html)
2. Click "Call /api/advertisements/list.php"
   - Should show 3 buy ads for Chemical D
3. Click "Check if Components are Loaded"
   - Should show ✓ for both components
4. Click "Render Test Chemical Card"
   - Should show a Chemical D card with 3 "Sell to" buttons

### Option 2: Check the Main App
1. Open [http://cndq.test/CNDQ/](http://cndq.test/CNDQ/)
2. Log in as Crafty Otter (test_mail1@stonybrook.edu)
3. Open browser DevTools (F12)
4. Check Console tab for:
   - "📢 Loaded advertisements" - Should show 3 D buy ads
   - "🔧 Creating ad-item" - Should appear 3 times for Chemical D
   - "🎪 Rendering ad-item" - Should appear 3 times for Chemical D
5. Check Network tab:
   - Look for `/api/advertisements/list.php` request
   - Verify response has 3 buy ads for Chemical D
6. Check Elements tab:
   - Find `<chemical-card chemical="D">`
   - Look for 3 `<advertisement-item>` elements inside
   - Each should have a "Sell to" button

### Option 3: Force NPC Cycle (If Needed)
If no ads are showing, trigger NPCs to trade:
```bash
curl -X POST http://cndq.test/CNDQ/api/admin/npc/trigger-cycle
```

---

## Possible Issues (If Not Working)

### Issue A: Web Components Not Loading
**Symptom**: Components show as "NOT defined"
**Cause**: Import errors in JavaScript
**Fix**: Check [index.php](index.php) imports chemical-card.js and advertisement-item.js

### Issue B: API Not Being Called
**Symptom**: No network request for /api/advertisements/list.php
**Cause**: JavaScript error before API call
**Fix**: Check console for errors, fix any import/syntax issues

### Issue C: Data Not Rendering
**Symptom**: API returns data but no ads visible
**Cause**: Component rendering issue or incorrect props
**Fix**: Check chemical-card.js line 203-215 for rendering logic

### Issue D: Wrong User Context
**Symptom**: All ads show as "Your Request"
**Cause**: currentUserId not set correctly
**Fix**: Check marketplace.js line 603 sets card.currentUserId

---

## Debug Scripts Created

I've created several debug tools in the CNDQ directory:

1. **test-marketplace-debug.php** - Backend marketplace diagnostics
   ```bash
   php test-marketplace-debug.php
   ```

2. **test-ads-debug.php** - Advertisement vs buy order comparison
   ```bash
   php test-ads-debug.php
   ```

3. **test-crafty-inventory.php** - Crafty Otter's inventory check
   ```bash
   php test-crafty-inventory.php
   ```

4. **test-api-response.php** - Simulate API response
   ```bash
   php test-api-response.php
   ```

5. **test-frontend-debug.html** - Interactive browser debugging
   ```
   Open in browser: http://cndq.test/CNDQ/test-frontend-debug.html
   ```

---

## Conclusion

The backend is **100% working correctly**:
- ✅ NPCs are active
- ✅ Buy advertisements are being created
- ✅ API returns correct data
- ✅ Crafty Otter has inventory to sell
- ✅ Filtering logic should pass the ads through

The issue is likely in the **frontend rendering**. Use the debug tools above to identify whether:
1. Web components are loading
2. API is being called
3. Data is being received
4. Components are rendering

Most likely causes:
- **JavaScript error** preventing component initialization
- **Import path issue** for web components
- **Timing issue** where ads load before components are defined
- **Browser caching** showing old code

**Recommended Action**: Open [test-frontend-debug.html](http://cndq.test/CNDQ/test-frontend-debug.html) and work through each test to pinpoint the exact failure point.
