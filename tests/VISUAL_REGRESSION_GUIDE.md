# Visual Regression Testing Guide - CSS Refactoring

**Purpose**: Ensure CSS refactoring doesn't break visual appearance

**Philosophy**: "No Cookie Jar" - Can't fake screenshots or bypass pixel comparison

---

## Overview

This test suite prevents visual regressions during CSS refactoring by:

1. **Taking screenshots** of every UI state (baseline)
2. **Making CSS changes** incrementally
3. **Taking screenshots again** (current)
4. **Comparing pixel-by-pixel** (automated)
5. **BLOCKING progress** if differences detected
6. **Human review** of differences
7. **Approve or reject** changes

**Key Principle**: The test physically captures rendered pixels. It **cannot** fake visual appearance - either pixels match or they don't.

---

## Quick Start

### Step 1: Install Dependencies

```bash
npm install
# Installs pixelmatch and pngjs for image comparison
```

### Step 2: Capture Baseline (Before Refactoring)

```bash
# Capture baseline screenshots
npm run visual:baseline

# Or in headless mode (faster)
npm run visual:baseline:headless
```

**Output**:
```
📸 CAPTURING BASELINE SCREENSHOTS
================================================================================
Themes: dark, light, high-contrast
================================================================================

🎨 THEME: DARK
--------------------------------------------------------------------------------
   🛡️  Admin Page
      📸 Screenshot: admin_main_dark → admin_main_dark_1704567890123.png
   👤 Player Pages
      📸 Screenshot: player_marketplace_dark → player_marketplace_dark_1704567890456.png
      📸 Screenshot: player_inventory_dark → player_inventory_dark_1704567890789.png
      ...

✅ Captured 24 screenshots
```

**Where are screenshots saved?**
- `tests/screenshots/baseline/` - Baseline (before changes)

### Step 3: Make ONE Incremental CSS Change

Example: Delete lines 146-200 from `css/styles.css` (duplicate utility classes)

### Step 4: Compare Against Baseline

```bash
npm run visual:compare
```

**Output**:
```
🔍 COMPARING SCREENSHOTS AGAINST BASELINE
================================================================================
Baseline: 24 screenshots
Current:  24 screenshots

[1/24] admin_main_dark
   ✅ IDENTICAL (0 pixel difference)

[2/24] player_marketplace_dark
   ❌ VISUAL DIFFERENCE DETECTED
      Pixels changed: 1,245 (0.34%)
      Diff image: tests/screenshots/diff/diff_player_marketplace_dark_*.png

...

================================================================================
📊 COMPARISON SUMMARY
================================================================================
Total comparisons: 24
✅ Passed:  23 (96%)
❌ Failed:  1 (4%)
================================================================================

❌ VISUAL REGRESSION DETECTED - CHANGES BLOCKED

Next steps:
  1. Review differences: open visual-regression-report.html
  2. If changes are intentional:
     npm run visual:approve
  3. If changes are bugs:
     - Revert CSS changes
     - Fix the issue
     - Run comparison again
```

### Step 5: Review Differences

Open the generated report:

```bash
# Open in browser
open tests/visual-regression-report.html
# Or on Windows:
start tests/visual-regression-report.html
```

**Report shows**:
- ✅ **Baseline (Before)** - Original screenshot
- ✅ **Current (After)** - New screenshot
- ✅ **Difference** - Red pixels show what changed

**Example visual difference**:
- Baseline shows button with `#10b981` green
- Current shows button with `#059669` green (slightly darker)
- Diff image highlights the button in red

### Step 6A: If Bug (Revert Changes)

```bash
# Revert CSS changes
git checkout css/styles.css

# Run comparison again
npm run visual:compare
```

Should now show: `✅ ALL SCREENSHOTS MATCH`

### Step 6B: If Intentional (Approve Changes)

```bash
# Approve the visual changes
npm run visual:approve
```

**Output**:
```
✅ APPROVING VISUAL CHANGES
================================================================================
Copying 24 screenshots to baseline...
✅ Approved 24 screenshots

Baseline updated. You can now continue refactoring.
```

### Step 7: Continue Refactoring

Repeat steps 3-6 for each incremental change:
- Delete more duplicate utilities
- Compare again
- Approve if intentional
- Continue...

---

## Detailed Workflow

### Full CSS Refactoring Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: CAPTURE BASELINE                                   │
│  $ npm run visual:baseline                                  │
│  → Saves 24+ screenshots of all UI states                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: MAKE ONE CSS CHANGE                                │
│  Example: Delete lines 146-200 from styles.css              │
│  (Duplicate .flex, .text-*, .p-* utilities)                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: COMPARE                                            │
│  $ npm run visual:compare                                   │
│  → Takes new screenshots                                    │
│  → Compares pixel-by-pixel with baseline                    │
└─────────────────────────────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
    ┌────────────────────┐  ┌────────────────────┐
    │  DIFFERENCES FOUND │  │   ALL MATCH ✅     │
    └────────────────────┘  └────────────────────┘
                │                     │
                ▼                     ▼
    ┌────────────────────┐  ┌────────────────────┐
    │  OPEN REPORT       │  │  CONTINUE          │
    │  Review changes    │  │  REFACTORING       │
    └────────────────────┘  └────────────────────┘
                │                     │
        ┌───────┴────────┐           │
        │                │           │
        ▼                ▼           │
  ┌─────────┐    ┌─────────────┐    │
  │   BUG   │    │ INTENTIONAL │    │
  │ REVERT  │    │   APPROVE   │    │
  └─────────┘    └─────────────┘    │
        │                │           │
        │                ▼           │
        │    $ npm run visual:approve│
        │    → Updates baseline      │
        │                │           │
        └────────────────┴───────────┘
                     │
                     ▼
            ┌────────────────┐
            │  STEP 2 AGAIN  │
            │  Next change   │
            └────────────────┘
```

---

## What Gets Captured

### Pages & Views

| Screenshot Name | Description |
|----------------|-------------|
| `admin_main_{theme}` | Admin dashboard |
| `player_marketplace_{theme}` | Main marketplace view |
| `player_inventory_{theme}` | Inventory tab |
| `player_production_{theme}` | Production tab |
| `player_negotiations_{theme}` | Negotiations tab |
| `modal_chemical_card_{theme}` | Chemical card modal |

### Themes Tested

- ✅ `dark` - Default dark theme
- ✅ `light` - Light theme
- ✅ `high-contrast` - High contrast theme

**Total Screenshots**: ~24 per run (8 views × 3 themes)

---

## Understanding The Report

### Report Layout

```html
┌─────────────────────────────────────────────────────┐
│         🔍 Visual Regression Report                │
│                                                     │
│  Total: 24   Passed: 23   Failed: 1               │
│  [ All ]  [ Failed Only ]  [ Passed Only ]        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ ❌ player_marketplace_dark               DIFFERENT │
│                                                     │
│ Pixels changed: 1,245 (0.34%)                      │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ BASELINE │  │ CURRENT  │  │   DIFF   │        │
│  │ (Before) │  │ (After)  │  │ (Red=Δ)  │        │
│  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────┘
```

### Interpreting Diff Images

**Red pixels** = Changed from baseline
**Yellow pixels** = Anti-aliasing differences (usually ignored)
**Black pixels** = Identical

**Example**:
- If button color changed: Button highlighted in red
- If text moved: Old and new positions shown in red
- If element disappeared: Red outline where it was

---

## Advanced Usage

### Test Only Specific Themes

```bash
# Only test dark theme (faster)
node tests/visual-regression-test.js --capture-baseline --themes=dark
node tests/visual-regression-test.js --compare --themes=dark
```

### Adjust Pixel Difference Threshold

```bash
# More sensitive (0.001 = 0.1% difference allowed)
node tests/visual-regression-test.js --compare --threshold=0.001

# Less sensitive (0.05 = 5% difference allowed)
node tests/visual-regression-test.js --compare --threshold=0.05
```

**Default threshold**: `0.01` (1% pixel difference)

**When to adjust**:
- Decrease for critical changes (color accuracy)
- Increase for minor refactoring (anti-aliasing, font rendering)

### Verbose Mode

```bash
# See detailed output
node tests/visual-regression-test.js --compare --verbose
```

Shows:
- Every screenshot capture
- API call monitoring
- Detailed error messages

---

## Common Issues & Solutions

### Issue 1: All Screenshots Fail with 100% Difference

**Cause**: Theme not applied correctly

**Solution**:
```javascript
// In visual-regression-test.js, verify theme is set:
await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
}, theme);
```

### Issue 2: Modal Screenshots Are Blank

**Cause**: Modal didn't open before screenshot

**Solution**: Increase sleep time in `captureModalsAndOverlays()`:
```javascript
await this.browser.sleep(1000); // Increase from 500ms
```

### Issue 3: Scrollbar Differences

**Cause**: Scrollbar rendering varies between runs

**Solution**: Hide scrollbars in screenshot:
```javascript
await page.addStyleTag({
    content: '::-webkit-scrollbar { display: none; }'
});
```

### Issue 4: Font Rendering Differences

**Cause**: Sub-pixel rendering varies across browsers/OSes

**Solution**: Increase threshold:
```bash
npm run visual:compare -- --threshold=0.02
```

### Issue 5: Animation Not Disabled

**Cause**: Animations cause pixel differences

**Solution**: Playwright disables animations automatically:
```javascript
await page.screenshot({
    animations: 'disabled', // Already set
});
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Visual Regression Tests

on: [pull_request]

jobs:
  visual-regression:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Start local server
        run: |
          # Start your CNDQ server
          php -S localhost:8000 &
          sleep 5

      - name: Run visual regression tests
        run: npm run visual:compare:headless

      - name: Upload screenshots on failure
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: visual-regression-report
          path: |
            tests/screenshots/
            tests/visual-regression-report.html
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# If CSS files changed, run visual regression
if git diff --cached --name-only | grep -q "\.css$"; then
    echo "CSS files changed - running visual regression tests..."
    npm run visual:compare:headless

    if [ $? -ne 0 ]; then
        echo "❌ Visual regression tests failed!"
        echo "Review changes: open tests/visual-regression-report.html"
        exit 1
    fi
fi
```

---

## Best Practices

### 1. Capture Baseline on Stable Code

✅ **Good**: Capture baseline on `main` branch
❌ **Bad**: Capture baseline with visual bugs

### 2. Make Incremental Changes

✅ **Good**: Delete 50 lines, compare, approve
❌ **Bad**: Delete 800 lines at once

**Why**: Easier to identify which change caused regression

### 3. Review Every Difference

✅ **Good**: Open report, inspect red pixels
❌ **Bad**: Auto-approve without looking

**Why**: Unintentional changes can slip through

### 4. Update Baseline Frequently

✅ **Good**: Approve intentional changes immediately
❌ **Bad**: Let baseline get stale

**Why**: Stale baseline = false positives

### 5. Test All Themes

✅ **Good**: `--themes=all` (default)
❌ **Bad**: Only test dark theme

**Why**: Theme-specific CSS might break

---

## Architecture: "No Cookie Jar" Enforcement

This test follows the "no cookie jar" principle:

### Physical Constraints Prevent Shortcuts

**1. Actual Browser Rendering**
```javascript
await page.screenshot({ fullPage: true });
// → Must render actual pixels in browser
// → Can't fake rendering
```

**2. Real PNG Files**
```javascript
fs.writeFileSync(filepath, PNG.sync.write(image));
// → Actual PNG files written to disk
// → Can't fake file contents
```

**3. Pixel-by-Pixel Comparison**
```javascript
pixelmatch(baselineImg.data, currentImg.data, diff.data, ...);
// → Compares every single pixel
// → Can't fake pixel values
```

**4. HTML Report Generation**
```html
<img src="baseline.png"> vs <img src="current.png">
// → Human sees actual rendered images
// → Can't hide visual differences
```

### Independence from UI Test

Based on `ui-playability-test.js` but operates independently:

```
ui-playability-test.js     visual-regression-test.js
        │                           │
        ├─ Clicks buttons           ├─ Clicks buttons
        ├─ Fills forms              ├─ Fills forms
        ├─ Verifies APIs            ├─ (ignores APIs)
        └─ Checks game state        └─ Takes screenshots
                                            │
                                    Compares pixels
                                            │
                                    ✅ Match or ❌ Fail
```

### Two Independent Paths to Same Truth

```
CSS Refactoring
      │
      ├─→ Path 1: Unit Tests
      │   (verify code structure)
      │
      └─→ Path 2: Visual Regression
          (verify rendered output)
                │
        Both must pass
                │
        ✅ Safe to deploy
```

---

## Troubleshooting

### Test Hangs at Screenshot Capture

**Check**:
```bash
# Is server running?
curl http://cndq.test/CNDQ/

# Is Playwright installed?
npx playwright install
```

### Baseline Directory Empty

**Check**:
```bash
ls tests/screenshots/baseline/
# Should show *.png files

# If empty, run:
npm run visual:baseline
```

### "Cannot find module 'pixelmatch'"

**Fix**:
```bash
npm install pixelmatch pngjs --save-dev
```

### Report Shows All Images Broken

**Cause**: Relative paths incorrect

**Fix**: Open `visual-regression-report.html` from project root:
```bash
# From project root
open tests/visual-regression-report.html
```

---

## Summary

The visual regression test provides **physical proof** that CSS refactoring didn't break visual appearance:

✅ **Captures** actual browser screenshots
✅ **Compares** pixel-by-pixel automatically
✅ **Blocks** progress if differences detected
✅ **Reports** visual changes for human review
✅ **Enforces** incremental, safe refactoring

**Key Principle**: Can't fake pixels - either they match or they don't.

**Workflow**:
1. Baseline → 2. Change CSS → 3. Compare → 4. Review → 5. Approve/Reject → 6. Repeat

**Result**: Safe CSS refactoring with visual proof that nothing broke.

---

## Quick Reference

```bash
# Capture baseline
npm run visual:baseline

# Make CSS changes
# (edit css/styles.css)

# Compare
npm run visual:compare

# Review
open tests/visual-regression-report.html

# Approve (if intentional)
npm run visual:approve

# Or revert (if bug)
git checkout css/styles.css
```

**Remember**: Make small, incremental changes. Test after each change. The test will protect you!
