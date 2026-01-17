/**
 * Debug user context in browser
 * Run this in browser console to check what the frontend sees
 */

console.log('=== USER CONTEXT DEBUG ===');
console.log('Current User:', app.currentUser);
console.log('Inventory:', app.inventory);
console.log('Advertisements:', app.advertisements);

console.log('\n=== CHEMICAL D SPECIFIC ===');
console.log('Chemical D Inventory:', app.inventory.D);
console.log('Chemical D Buy Ads (all):', app.advertisements.D?.buy);

// Check what gets passed to the card
const card = document.querySelector('chemical-card[chemical="D"]');
if (card) {
    console.log('Chemical D Card Found');
    console.log('  currentUserId:', card.currentUserId);
    console.log('  inventory:', card.inventory);
    console.log('  buyAds prop:', card.buyAds);
    console.log('  buyAds length:', card.buyAds?.length);
} else {
    console.log('Chemical D Card NOT FOUND');
}

// Check filtering logic from marketplace.js:613
const myInventory = app.inventory.D || 0;
const allBuyAds = app.advertisements.D?.buy || [];
const filteredBuyAds = myInventory > 0 ? allBuyAds : [];

console.log('\n=== FILTERING LOGIC ===');
console.log('My Inventory (D):', myInventory);
console.log('All Buy Ads (D):', allBuyAds.length);
console.log('After Filter:', filteredBuyAds.length);

if (myInventory <= 0) {
    console.error('❌ PROBLEM: You have 0 inventory of D, so all buy ads are filtered out!');
} else if (filteredBuyAds.length === 0 && allBuyAds.length > 0) {
    console.error('❌ PROBLEM: Ads exist but are being filtered out for unknown reason!');
} else if (filteredBuyAds.length > 0) {
    console.log('✓ Should see', filteredBuyAds.length, 'Sell to buttons');
}
