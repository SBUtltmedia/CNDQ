# Toast Notification Features

## Overview
The marketplace app now includes intelligent toast notifications that prevent spam and provide trade quality feedback.

## Features

### 1. Duplicate Advertisement Prevention

**Problem**: Users could create duplicate advertisements and flood the marketplace by repeatedly clicking "Post Sell Interest" or "Post Buy Interest" buttons.

**Solution**: Prevent posting duplicate advertisements - users can only have one active ad per chemical/type combination.

**How it works**:
- Before posting, checks if user already has an active advertisement for that chemical + type
- If duplicate found, shows warning toast: "You already have an active sell advertisement for Chemical C"
- Once the ad is removed (via trade completion or manual removal), user can post again
- This matches the business logic: no need to advertise twice for the same thing

**Code location**: `js/marketplace.js:394-412` (postAdvertisement function)

**Business Logic**:
- ✅ Can have both buy AND sell ads for same chemical (different types)
- ✅ Can have ads for multiple chemicals simultaneously
- ❌ Cannot have duplicate buy ads for same chemical
- ❌ Cannot have duplicate sell ads for same chemical
- ✅ Ad removed when trade completed or user cancels

### 2. Trade Quality Analysis

**Problem**: Users had no feedback on whether a trade was economically favorable or not.

**Solution**: Implemented shadow price-based trade quality analysis that shows special toasts for particularly good or bad trades.

**How it works**:
- When a trade is accepted, compares the trade price to the chemical's shadow price
- Shadow price represents the optimal value of that chemical to your production
- Calculates percentage difference and determines trade quality
- Shows enhanced toasts with longer duration for significant trades

**Quality Thresholds**:

For **Selling**:
- ✅ **Excellent** (green gradient 🎉): Selling price ≥25% above shadow price
- ✅ **Good** (green): Selling price 10-24% above shadow price
- ⚠️ **Warning** (yellow): Selling price 10-24% below shadow price
- ❌ **Bad** (red gradient): Selling price ≥25% below shadow price

For **Buying**:
- ✅ **Excellent** (green gradient 🎉): Buying price ≥25% below shadow price
- ✅ **Good** (green): Buying price 10-24% below shadow price
- ⚠️ **Warning** (yellow): Buying price 10-24% above shadow price
- ❌ **Bad** (red gradient): Buying price ≥25% above shadow price

**Neutral** (standard blue): Trades within ±10% of shadow price

**Example Toast Messages**:

Excellent sale:
```
🎉 Excellent sale! 32% above optimal value ($15.00 vs $11.36 shadow price)
```

Poor purchase:
```
⚠️ Overpaid! 28% above optimal value ($18.50 vs $14.45 shadow price)
```

Good purchase:
```
✓ Good purchase! 15% below shadow price ($12.00 vs $14.12)
```

**Code location**: `js/marketplace.js:678-734` (analyzeTradeQuality function)

## Toast Types

The app now supports 6 toast types with distinct visual styles:

| Type | Color | Icon | Use Case | Duration |
|------|-------|------|----------|----------|
| `success` | Green | ✓ | Standard success messages | 3s |
| `error` | Red | ✗ | Error messages | 3s |
| `info` | Blue | ℹ | Informational messages | 3s |
| `warning` | Yellow | ⚠ | Warnings, below-market trades | 4s |
| `excellent` | Green gradient | 🎉 | Excellent trades (±25%+) | 5s |
| `bad` | Red gradient | ⚠️ | Bad trades (±25%+) | 5s |

## Visual Design

### Gradient Toasts
Excellent and bad toasts use eye-catching gradients:
- **Excellent**: Green to emerald gradient (#10b981 → #059669)
- **Bad**: Red to rose gradient (#ef4444 → #e11d48)

### Icon Integration
All toasts now display icons using flexbox layout:
```html
<div class="toast flex items-center gap-2">
    <span class="icon">🎉</span>
    <span>Message text</span>
</div>
```

## CSS Implementation

Added gradient support to `css/styles.css:309-314`:

```css
/* Gradient backgrounds for special toasts */
.bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
.from-green-500 { --tw-gradient-from: #10b981; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(16, 185, 129, 0)); }
.to-emerald-600 { --tw-gradient-to: #059669; }
.from-red-500 { --tw-gradient-from: #ef4444; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(239, 68, 68, 0)); }
.to-rose-600 { --tw-gradient-to: #e11d48; }
```

## Educational Value

### Teaching Shadow Prices
The trade quality toasts provide immediate feedback on trading decisions, helping students understand:
- The concept of shadow prices (marginal value)
- Opportunity cost of trades
- Market dynamics and negotiation strategy
- When to accept vs reject offers

### Strategic Implications
Students learn to:
- Check shadow prices before negotiating
- Recognize when they're getting a good/bad deal
- Understand that shadow prices change as their inventory changes
- Balance short-term profits vs long-term optimal production

## Edge Cases Handled

1. **Zero Shadow Price**: If shadow price is 0 (chemical has no current value to production), shows neutral toast
2. **Rapid Clicking**: Debounce prevents multiple API calls and toast spam
3. **Different Chemicals**: Cooldown is per-chemical, allowing posting for multiple chemicals simultaneously
4. **Long Messages**: Toast container handles overflow with proper text wrapping
5. **Accessibility**: All toasts have `role="alert"` and `aria-live="assertive"` for screen readers

## Future Enhancements (Ideas)

1. **Historical Trade Analysis**: Track and display user's trade history with quality metrics
2. **Leaderboard**: Show who makes the best trades based on shadow price analysis
3. **Adjustable Thresholds**: Allow instructors to configure what constitutes "excellent" vs "good"
4. **Sound Effects**: Optional audio cues for excellent/bad trades
5. **Trade Recommendations**: AI-suggested counter-offers based on shadow prices
6. **Visual Indicators**: Color-code negotiations by quality before accepting
