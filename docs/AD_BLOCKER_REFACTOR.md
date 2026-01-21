# Architectural Decision: Renaming "Ads" to "Listings"

## Context
Marketplace applications often use the terms "Ad" or "Advertisement" to describe user postings. However, modern Ad Blockers (like uBlock Origin, AdBlock Plus) aggressively target DOM elements containing the string "ad" in their ID or class names (e.g., `.ad-container`, `#post-ad-btn`, `.sidebar-ads`).

In the CNDQ project, this has caused issues where critical UI components (like the "Post Ad" button or the list of available trades) are hidden from users who have ad blockers enabled.

## Decision
**All occurrences of "Ad", "Ads", and "Advertisement" in the context of user trade listings shall be renamed to "Listing", "Listings", "MarketEntry", or "TradeRequest".**

This applies to:
1.  **CSS Selectors:** `.ad-item` -> `.listing-item`, `#ad-form` -> `#listing-form`.
2.  **DOM IDs:** `id="post-ad"` -> `id="post-listing"`.
3.  **JavaScript Variables:** `const myAds` -> `const myListings`.
4.  **API Endpoints:** `/api/advertisements` -> `/api/listings`.
5.  **Database Columns/Tables:** (If applicable) `ads` table -> `listings`.

## Current Status (as of Jan 21, 2026)
*   **CSS (`styles.css`):** largely migrated. Uses `.listing-item` instead of `.ad-item`.
*   **Legacy CSS (`styles.legacy.css`):** Still contains `.ad-item` (kept for reference, not active).
*   **JavaScript:** *Heavy usage* of "ad" terminology remains in `marketplace.js`, `chemical-card.js`, and strategies.
*   **Tests:** *Heavy usage* of "ad" terminology in Playwright/Puppeteer tests.
*   **Backend:** API endpoints still use `advertisements/` path.

## Implementation Plan
1.  **Phase 1: Frontend Selectors (High Priority)**
    *   Rename IDs and Classes in HTML/JS that trigger blockers.
    *   Verify `chemical-card.js` Shadow DOM selectors.
2.  **Phase 2: Internal Logic**
    *   Refactor JS variables (`buyAds` -> `buyListings`).
    *   Refactor PHP Strategy classes (`NoviceStrategy.php`).
3.  **Phase 3: API & Storage**
    *   Migrate API endpoints to `/api/listings/`.
    *   Update `TeamStorage.php` and `MarketplaceAggregator.php` to use `listings` key in JSON blobs.

## Verification
*   Developers should test the application with **uBlock Origin enabled** to ensure no UI elements are hidden.
