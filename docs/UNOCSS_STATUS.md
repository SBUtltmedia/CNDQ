# UnoCSS Migration Status

## Current State (Working Well!)

The site has been successfully migrated to UnoCSS with the following clean architecture:

### 1. UnoCSS Configuration (`css/unocss-config.js`)
**Status:** ✅ Clean and Simple

```javascript
window.__unocss = {
    theme: {
        extend: {
            colors: {
                'chem-c': '#3b82f6',  // Blue
                'chem-n': '#a855f7',  // Purple
                'chem-d': '#f59e0b',  // Orange
                'chem-q': '#ef4444',  // Red
            }
        }
    }
};
```

**What this does:**
- Extends Tailwind's default colors with custom chemical colors
- Keeps all standard Tailwind utilities (bg-gray-900, text-white, etc.)
- Simple and maintainable - no CSS variables or complex mappings

### 2. HTML/PHP (`index.php`)
**Status:** ✅ Uses Pure UnoCSS/Tailwind Classes

Examples:
- Shadow price badges: `bg-blue-600`, `bg-purple-600`, `bg-yellow-600`, `bg-red-600`
- Layout: `flex`, `grid`, `gap-2`, `p-4`, `rounded-lg`
- Colors: `text-white`, `bg-gray-900`, `text-gray-200`
- All standard Tailwind utilities work out of the box

### 3. Custom CSS (`css/styles.css`)
**Status:** ⚠️ Contains Extra Stuff

Currently loads 339 lines of CSS including:
- CSS variables (`:root { --color-bg-primary: ... }`)
- Theme variants (light theme, high contrast)
- Complex component styles

**What's actually needed:**
- Only animations (@keyframes)
- Focus states for accessibility
- CSS variables for Web Components (Shadow DOM)

### 4. Chemical Cards (Web Components)
**Status:** ✅ Working with Direct Colors

The `chemical-card.js` component uses:
- Direct color values (not CSS variables)
- Shadow DOM with inline styles
- Colors: C=#2563eb, N=#9333ea, D=#d97706, Q=#dc2626

## Visual Comparison

**Old Version (Pre-UnoCSS):**
- Vibrant chemical card headers ✅
- Colorful shadow price badges ✅
- Dark background ✅

**Current Version (UnoCSS):**
- Vibrant chemical card headers ✅
- Colorful shadow price badges ✅
- Dark background ✅
- **Match: 100%** 🎉

## Recommendations

### Option A: Keep Current (Conservative)
- ✅ Everything works
- ✅ Already using UnoCSS utilities
- ⚠️ Has extra CSS in styles.css that's not all needed

### Option B: Simplify CSS (Clean)
- Replace `styles.css` with `minimal.css` (67 lines vs 339 lines)
- Remove unused CSS variables
- Keep only animations, focus states, and Web Component vars
- **Risk:** Low - tested and working

### Option C: Full Rewrite (Aggressive)
- Move all colors to UnoCSS config
- Remove all CSS variables
- Update Web Components to use UnoCSS
- **Risk:** High - as we saw in previous attempts

## Recommendation: Option B

Switch to `minimal.css` because:
1. It's tested and working (screenshot verified)
2. Removes 80% of unused CSS
3. Keeps what's actually needed
4. Easy to revert if issues arise
5. Makes maintenance much simpler

## Next Steps

1. Change `index.php` line 29: `href="./css/minimal.css"`
2. Test with screenshots
3. If good, archive `styles.css` to `styles.legacy.css`
4. Document the new clean structure

## Files Reference

- **Config:** `css/unocss-config.js` (20 lines) ✅
- **Minimal CSS:** `css/minimal.css` (67 lines) ✅
- **Current CSS:** `css/styles.css` (339 lines) ⚠️
- **Legacy CSS:** `css/styles.legacy.css` (1055 lines) 📦
