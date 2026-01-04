# Color Testing - Legacy Files

## Note
These are **legacy test files** maintained for backward compatibility. The main test infrastructure has moved to `../tests/` directory with a helper-based architecture.

## Files in this Directory

### [color-harmony-test.js](color-harmony-test.js:1-112)
Tests color schemes against color theory principles (tetradic, triadic, complementary, analogous harmonies).

**Usage:**
```bash
node CNDQ/test/color-harmony-test.js
```

**What it tests:**
- Current dark theme colors vs proposed tetradic scheme
- Color harmony scores
- Professional quality validation

### [comprehensive-color-test.js](comprehensive-color-test.js:1-156)
Comprehensive testing of both dark and light theme colors against WCAG standards.

**Usage:**
```bash
node CNDQ/test/comprehensive-color-test.js
```

**What it tests:**
- Color harmony for both themes
- WCAG AA contrast compliance (24 tests total)
- Professional quality for both themes

## Current Test Results

Both legacy tests now **PASS** with the updated WCAG-compliant colors:
- ✓ Dark theme: 100% harmony, 12/12 contrast tests pass
- ✓ Light theme: 100% harmony, 12/12 contrast tests pass
- ✓ Overall: **EXCELLENT** - All 24 tests passing

## Migration to New Test Infrastructure

The new test files in `../tests/` directory offer:
- Helper-based architecture (ColorHarmonyHelper, ColorContrastHelper)
- Better code organization and reusability
- ReportingHelper for consistent, colorful output
- Additional tools like color generators and verification utilities

### New Test Files (Recommended)
- `../tests/comprehensive-color-test.js` - Main comprehensive test
- `../tests/color-harmony-test.js` - Harmony-focused test
- `../tests/generate-wcag-colors.js` - Automated color generator
- `../tests/verify-text-colors.js` - Text color verification

### Helper Modules
- `../tests/helpers/color-harmony.js` - Color theory analysis
- `../tests/helpers/color-contrast.js` - WCAG compliance testing
- `../tests/helpers/reporting.js` - Console output formatting

## Why Keep These Legacy Files?

1. **Backward compatibility** - Existing scripts/workflows may reference these paths
2. **Quick testing** - Simpler output format for quick checks
3. **Documentation** - Shows the evolution of the testing approach

## Color Values (Updated)

### Dark Theme
```css
--color-chemical-c: #74b1fb; /* Blue - 4.63:1 on #374151 */
--color-chemical-n: #c997fc; /* Purple - 4.57:1 on #374151 */
--color-chemical-d: #fcd554; /* Yellow - 7.26:1 on #374151 */
--color-chemical-q: #fa8f8f; /* Red - 4.61:1 on #374151 */
```

### Light Theme
```css
--color-chemical-c: #0763d5; /* Blue - 4.52:1 on #e5e7eb */
--color-chemical-n: #8c1ff9; /* Purple - 4.61:1 on #e5e7eb */
--color-chemical-d: #7e6102; /* Yellow - 4.71:1 on #e5e7eb */
--color-chemical-q: #d10a0a; /* Red - 4.51:1 on #e5e7eb */
```

All colors meet **WCAG AA standards** (4.5:1 minimum contrast) and maintain **100% tetradic harmony**.

---

**Last Updated:** 2026-01-03
**Status:** ✓ All tests passing
