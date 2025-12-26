# Quick Start Guide - Testing the Market System

## Starting the Server

Since DDEV requires non-root privileges, you'll need to start it from WSL as a regular user:

### Option 1: From WSL Terminal
```bash
# Open WSL terminal (not as root)
cd /mnt/d/WSL2/Ubuntu/CNDQ
ddev start
```

### Option 2: From Windows (if configured)
```powershell
# In PowerShell or CMD
wsl -u <your-username> ddev start
```

Once started, you should see:
```
Successfully started CNDQ
Project can be reached at http://cndq.ddev.site
```

---

## Quick Test Sequence

### 1. Open Market Page
Navigate to: **http://cndq.ddev.site/market.html**

### 2. Test as Team 7 (Seller)

**Set login cookie in browser console (F12):**
```javascript
document.cookie = "mock_mail=team7@example.com"
location.reload()
```

**Actions:**
1. Check shadow prices appear in left sidebar
2. Click "My Offers" tab
3. Click "Create Sell Offer"
4. Fill in:
   - Chemical: C
   - Quantity: 200
   - Reserve Price: 45
5. Click "Create Offer"
6. Verify offer appears in list

### 3. Test as Team 3 (Buyer)

**Open incognito window or new browser**

**Set login cookie:**
```javascript
document.cookie = "mock_mail=team3@example.com"
location.reload()
```

**Actions:**
1. Go to "Available Offers" tab
2. Find Team 7's Chemical C offer
3. Click "Express Interest"
4. Confirm

### 4. Back to Team 7

**Switch to Team 7 window**

**Actions:**
1. Wait 3 seconds for polling update
2. Check notification badge (should show "1")
3. Go to "My Offers" tab
4. See Team 3 in interested buyers
5. Click "Set Price"
6. Enter: 50
7. Confirm

### 5. Back to Team 3

**Switch to Team 3 window**

**Actions:**
1. Wait for notification
2. Go to "Active Negotiations" tab
3. See price: $50
4. Compare with your shadow price
5. Click "Accept" or "Reject"

---

## Verifying Everything Works

### Check Browser Console (F12 → Console)
Should see no errors, only:
```javascript
Market poller started
Shadow prices calculated
Offers loaded: X
```

### Check Network Tab (F12 → Network)
Every 3 seconds you should see:
```
getMarketUpdates.php?lastPoll=XXXXX → 200 OK
```

### Check Data Files
```bash
# In WSL
cd /mnt/d/WSL2/Ubuntu/CNDQ

# View offers
cat data/offers.json | jq .

# View completed trades
cat data/trades_log.json | jq .

# View user data
cat data/user_team7@example.com.json | jq .
```

---

## Common Issues & Solutions

### Issue: "Could not load session"
**Fix:** Make sure you set the mock_mail cookie correctly

### Issue: Shadow prices show $0.00
**Fix:** Check that user has inventory in their user_*.json file

### Issue: No offers showing
**Fix:**
1. Check data/offers.json exists
2. Create a test offer first
3. Check browser console for errors

### Issue: Polling not updating
**Fix:**
1. Check Network tab for 3-second requests
2. Verify getMarketUpdates.php is accessible
3. Check console for JavaScript errors

### Issue: Modals not opening
**Fix:**
1. Check browser console for errors
2. Verify all modal IDs match in HTML
3. Test with browser DevTools (F12)

---

## Testing Different Scenarios

### Scenario 1: Successful Trade
Team 7 offers Chemical C @ reserve $45
→ Team 3 interested
→ Team 7 sets price $50
→ Team 3 accepts
→ ✅ Trade completes

### Scenario 2: Negotiation
Team 1 offers Chemical N @ reserve $30
→ Team 2 interested
→ Team 1 sets price $60
→ Team 2 rejects
→ Team 1 counters $50
→ Team 2 rejects
→ Team 1 counters $40
→ Team 2 accepts
→ ✅ Trade completes

### Scenario 3: Multiple Buyers
Team 5 offers Chemical D @ reserve $20
→ Team 1, 2, 3 all express interest
→ Team 5 sets price $35 for Team 1
→ Team 5 sets price $30 for Team 2
→ Team 2 accepts first
→ ✅ Offer completes, other negotiations cancelled

---

## What to Look For

### Good Signs ✅
- Shadow prices calculate and display with colors
- Notification badge updates within 3 seconds
- Offers appear in correct tabs
- Modals open and close smoothly
- Form validation works (can't exceed inventory)
- Trades update funds and inventory immediately

### Red Flags ❌
- Console errors
- Network requests failing (404, 500)
- Shadow prices stuck at $0.00
- Modals not closing
- Data not updating after actions

---

## Advanced Testing

### Multi-User Simulation
Open multiple browser windows:
1. Window 1: Team 1
2. Window 2: Team 2
3. Window 3: Team 3
4. Window 4: Team 4

Create offers in each and test cross-team negotiations.

### Stress Test Polling
Open 5-10 tabs all polling simultaneously
→ Should handle gracefully with file locking

### Edge Cases
- Try creating offer with 0 quantity
- Try setting price below reserve
- Try counter-offer with higher price
- Cancel offer with active negotiations

---

## Need Help?

Check these files for details:
- [FRONTEND_COMPLETE.md](FRONTEND_COMPLETE.md) - Full documentation
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - Backend API reference
- [implementation_suggestions.md](implementation_suggestions.md) - Original design

**Console debugging commands:**
```javascript
// Force refresh
refreshMarketData()

// Check state
console.log(userState)
console.log(shadowPrices)
console.log(currentOffers)

// Control polling
marketPoller.stop()
marketPoller.start()
```

---

**Everything is ready to go! Just start DDEV and navigate to the market page.** 🎉
