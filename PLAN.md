# Buy Request UI Refactor Plan

## Problem Statement

The current UI allows users to modify their buy requests from two places:
1. The chemical card area (via a "Revise Buy Request" button)
2. Potentially from negotiation interactions

This creates confusion. The game creators want users to be able to make "chopstick" mistakes (over-committing resources), but the UI should be clear and consistent about where actions happen.

## Desired Behavior ("Chopstick Principle")

### Buy Requests:
- Users can post **one buy request per chemical** (max 4 total: C, N, D, Q)
- Once posted, the button becomes **disabled/ghosted** (no inline revision)
- The buy request appears as a card in **"My Negotiations"** section (as the first phase, before anyone responds)
- To modify a buy request, user must **cancel** it from the negotiation card, then post a new one

### The Flow:
```
1. User posts buy request for Chemical C
   → Button for C becomes ghosted/disabled
   → A card appears in "My Negotiations" showing their pending buy request

2. User wants to change their request
   → Cannot revise directly from chemical card
   → Must cancel the existing request from the negotiation card
   → Button becomes active again
   → User can post a new buy request

3. Someone responds to the buy request
   → Card transitions from "waiting for response" to active negotiation
```

---

## Current Implementation

### Key Files:
- `js/components/chemical-card.js` - Chemical card with Post/Revise button
- `js/marketplace.js` - Main UI logic, My Negotiations rendering
- `index.php` - HTML structure including My Negotiations section
- `css/styles.css` - Button styles including disabled state

### Current Button Behavior (chemical-card.js ~line 154-198):
```javascript
const hasActiveBuyListing = this.buyListings.some(listing => listing.teamId === this.currentUserId);

// Button shows "Revise Buy Request" (orange) when hasActiveBuyListing is true
```

### Current My Negotiations (marketplace.js ~line 620-691):
- Only shows actual negotiations (status === 'pending' or recently completed)
- Does NOT show pending buy requests before someone responds

---

## Implementation Plan

### Phase 1: Disable Button When Buy Request Active

**File: `js/components/chemical-card.js`**

Changes to make:
1. When `hasActiveBuyListing` is true:
   - Add `disabled` attribute to button
   - Add `btn-disabled` class (already exists in component styles)
   - Keep button text as "📋 Post Buy Request" (not "Revise")
   - Update helper text below button to say "Cancel in My Negotiations to post new"

2. Remove the "Revise" functionality entirely - button just doesn't work when disabled

**Code changes (lines 188-198):**
```javascript
// BEFORE:
<button class="btn ${hasActiveBuyListing ? 'btn-revise' : ''}" @click=${this.handlePostBuyRequest}>
    ${hasActiveBuyListing ? '✏️ Revise Buy Request' : '📋 Post Buy Request'}
</button>
<p>Click to update or remove your request.</p>

// AFTER:
<button class="btn ${hasActiveBuyListing ? 'btn-disabled' : ''}"
        ?disabled=${hasActiveBuyListing}
        @click=${this.handlePostBuyRequest}>
    📋 Post Buy Request
</button>
<p>${hasActiveBuyListing ? 'Cancel in My Negotiations to post new' : 'Post what you need, teams will offer to sell.'}</p>
```

---

### Phase 2: Create Buy Request Card Component

**New File: `js/components/buy-request-card.js`**

Create a new web component similar to `negotiation-card.js` but for pending buy requests:
- Display: Chemical badge, quantity, max price
- Status: "Waiting for sellers..."
- Cancel button (X) in top-right corner
- Click does nothing (no detail view needed)
- Emits `cancel-buy-request` event when cancel clicked

**Properties:**
- `listing` - the buy request object {id, chemical, quantity, maxPrice, teamId, teamName}
- `currentUserId` - for ownership verification

**Events:**
- `cancel-buy-request` with detail: {listingId, chemical}

---

### Phase 3: Show Buy Requests in "My Negotiations"

**File: `js/marketplace.js`**

1. Import the new `buy-request-card.js` component

2. Modify `renderNegotiations()` method (~line 620):
   - Collect user's own buy requests from `this.listings`
   - Create `buy-request-card` elements for each
   - Insert them at the TOP of the My Negotiations container (before actual negotiations)

3. Add event listener for `cancel-buy-request` event:
   - Call API to remove listing
   - Refresh listings
   - Show success toast

**Data source for buy requests:**
```javascript
// Get user's own pending buy requests
const myBuyRequests = [];
for (const chemical of ['C', 'N', 'D', 'Q']) {
    const listings = this.listings[chemical]?.buy || [];
    const myListing = listings.find(l => l.teamId === this.currentUser);
    if (myListing) {
        myBuyRequests.push({ ...myListing, chemical });
    }
}
```

---

### Phase 4: Create API Endpoint for Canceling Listings

**New File: `api/listings/cancel.php`**

Backend exists (`ListingManager.removeListing()`) but no API endpoint.

Create endpoint:
- Method: POST
- Body: `{ listingId: "ad_xxx" }`
- Validates user owns the listing
- Calls `ListingManager.removeListing($listingId)`
- Returns `{ success: true }`

**Security:** Must verify the listing belongs to the current user before removing.

---

### Phase 5: Wire Up Cancel in Frontend

**File: `js/api.js`**

Add new method to `listings` object:
```javascript
cancel: async (listingId) => {
    return this.post('api/listings/cancel.php', { listingId });
}
```

**File: `js/marketplace.js`**

Add event listener in `init()` or `setupEventListeners()`:
```javascript
document.addEventListener('cancel-buy-request', async (e) => {
    const { listingId, chemical } = e.detail;
    try {
        await api.listings.cancel(listingId);
        notifications.showToast(`Cancelled buy request for Chemical ${chemical}`, 'success');
        await stateManager.loadListings();
    } catch (error) {
        notifications.showToast('Failed to cancel: ' + error.message, 'error');
    }
});
```

---

### Phase 6: CSS Updates (if needed)

**File: `css/styles.css`** or component styles

- Verify disabled button style looks good
- Style buy-request-card distinctly from negotiation-card (maybe different border color like blue/cyan to indicate "waiting")

---

## Files to Modify

| File | Changes |
|------|---------|
| `js/components/chemical-card.js` | Disable button when active, update helper text |
| `js/components/buy-request-card.js` | **NEW** - Component for pending buy request cards |
| `js/marketplace.js` | Import new component, modify renderNegotiations(), add cancel handler |
| `api/listings/cancel.php` | **NEW** - API endpoint for canceling listings |
| `js/api.js` | Add `listings.cancel()` method |
| `css/styles.css` | Style buy-request-card if needed |

---

### Phase 7: Server-Side Inventory Rejection

**Problem**: Concurrency means a trade may appear valid on the client but become invalid between user action and server processing.

**Solution**: Server-side validation with mutual rejection and clear feedback.

**File: `lib/schema.sql`** - Add rejection reason column:
```sql
-- Add to negotiations table (via schema update)
ALTER TABLE negotiations ADD COLUMN rejection_reason TEXT;
```

**File: `lib/schema_version.txt`** - Bump version:
```
3
```

**File: `lib/NegotiationManager.php`** - Modify validation:
```php
// In addCounterOffer() and acceptNegotiation():
try {
    $this->checkInventory($sellerId, $chemical, $quantity);
} catch (Exception $e) {
    // Auto-reject with reason
    $this->rejectNegotiation($negotiationId, 'system', $e->getMessage());
    throw new Exception("Trade invalidated: " . $e->getMessage());
}

// Modify rejectNegotiation() to accept optional reason:
public function rejectNegotiation($negotiationId, $rejectedBy = null, $reason = null) {
    $this->db->execute(
        'UPDATE negotiations SET status = ?, rejected_by = ?, rejected_at = ?, rejection_reason = ? WHERE id = ?',
        ['rejected', $rejectedBy, time(), $reason, $negotiationId]
    );
    // ... notify both parties
}
```

**Frontend**: Display rejection reason on negotiation cards when status is 'rejected'.

---

### Phase 8: Buy Request Data Visibility

**Clarification from client**: Initial price/quantity on a buy request is **HIDDEN** from other users until they agree to negotiate.

**Current behavior check needed**: Verify what data is exposed in the listings API.

**Changes if needed**:
- `api/listings/list.php` - Strip `quantity` and `maxPrice` from listings for other users
- Only the listing owner sees their own quantity/maxPrice
- Other users just see "Team X wants to buy Chemical C"

---

## Resolved Questions

1. **Rejection reason storage**:
   - **Solution**: Add `rejection_reason` column to `negotiations` table
   - Schema migration system exists (`schema_version.txt` currently at v2, bump to v3)
   - `Database.php` auto-applies schema.sql on version change

2. **Notification to other party**:
   - **Solution**: Other party's card shows the issue (e.g., "Seller has insufficient inventory")
   - User must **manually cancel** - no auto-rejection from client perspective
   - All cards require user action to dismiss/cancel

3. **NPC handling**:
   - **Solution**: NPCs already handle rejections in their strategies
   - They check `hasSufficientInventory()` and return `reject_negotiation` action
   - NPCs will also see server-rejected negotiations and handle them in next cycle

4. **"View All" modal**:
   - **TBD**: Confirm if pending buy requests should appear there too

5. **Buy request data visibility**:
   - **Clarified**: Quantity/price HIDDEN from other users until negotiation starts
   - Need to verify current API behavior and adjust if needed

---

## Files to Modify (Updated)

| File | Changes |
|------|---------|
| `js/components/chemical-card.js` | Disable button when active, update helper text |
| `js/components/buy-request-card.js` | **NEW** - Component for pending buy request cards |
| `js/marketplace.js` | Import new component, modify renderNegotiations(), add cancel handler |
| `api/listings/cancel.php` | **NEW** - API endpoint for canceling listings |
| `api/listings/list.php` | Hide quantity/maxPrice from non-owners |
| `js/api.js` | Add `listings.cancel()` method |
| `lib/schema.sql` | Add `rejection_reason` column to negotiations |
| `lib/schema_version.txt` | Bump to version 3 |
| `lib/NegotiationManager.php` | Add rejection reason support, server-side inventory rejection |
| `css/styles.css` | Style buy-request-card if needed |

---

## Status

- [x] Problem documented
- [x] Desired behavior confirmed with user
- [x] Detailed implementation plan written
- [x] Gap analysis completed
- [x] Phase 1: Disable button in chemical-card.js
- [x] Phase 2: Create buy-request-card.js component
- [x] Phase 3: Add buy requests to My Negotiations in marketplace.js
- [x] Phase 4: Create api/listings/cancel.php endpoint
- [x] Phase 5: Wire up cancel in api.js and marketplace.js
- [x] Phase 6: CSS updates (if needed)
- [x] Phase 7: Server-side inventory rejection with reason
- [x] Phase 8: Hide buy request quantity/price from non-owners
- [ ] Testing
