# Visual Regression Testing - Quick Start

🎯 **Purpose**: Ensure CSS refactoring doesn't break visual appearance

🔒 **"No Cookie Jar" Principle**: Can't fake screenshots - pixels either match or they don't

---

## Installation

```bash
npm install
```

Installs required packages:
- `pixelmatch` - Pixel-by-pixel image comparison
- `pngjs` - PNG file reading/writing

---

## Usage

### 1️⃣ Capture Baseline (Before Refactoring)

```bash
npm run visual:baseline
```

**What it does**: Takes screenshots of all UI states (admin, player, modals) in all themes (dark, light, high-contrast)

**Output**: `tests/screenshots/baseline/` (24+ PNG files)

---

### 2️⃣ Make ONE CSS Change

Example: Delete duplicate utilities from `css/styles.css`

```css
/* DELETE THESE (lines 146-200) */
.flex { display: flex; }
.text-xl { font-size: 1.25rem; }
.p-4 { padding: 1rem; }
/* ... etc ... */
```

---

### 3️⃣ Compare Against Baseline

```bash
npm run visual:compare
```

**What it does**:
- Takes new screenshots
- Compares pixel-by-pixel with baseline
- Generates HTML report

**Output**:
```
✅ Passed:  23 (96%)
❌ Failed:  1 (4%)

❌ VISUAL REGRESSION DETECTED - CHANGES BLOCKED
```

---

### 4️⃣ Review Differences

```bash
open tests/visual-regression-report.html
```

Report shows **side-by-side comparison**:
- Baseline (before)
- Current (after)
- Diff (red pixels = changed)

---

### 5️⃣ Approve or Revert

#### If Intentional (Approve):
```bash
npm run visual:approve
```

#### If Bug (Revert):
```bash
git checkout css/styles.css
npm run visual:compare  # Should pass now
```

---

### 6️⃣ Repeat

Continue refactoring incrementally:
- Make next CSS change
- Compare again
- Approve if good
- Continue...

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run visual:baseline` | Capture baseline screenshots |
| `npm run visual:compare` | Compare current vs baseline |
| `npm run visual:approve` | Approve changes, update baseline |
| `npm run visual:baseline:headless` | Baseline in headless mode (faster) |
| `npm run visual:compare:headless` | Compare in headless mode (CI/CD) |

---

## File Structure

```
tests/
├── visual-regression-test.js         # Main test file
├── VISUAL_REGRESSION_GUIDE.md        # Comprehensive guide
├── VISUAL_REGRESSION_README.md       # This file
├── visual-regression-report.html     # Generated report
└── screenshots/
    ├── baseline/                     # Before refactoring
    │   ├── admin_main_dark_*.png
    │   ├── player_marketplace_dark_*.png
    │   └── ...
    ├── current/                      # After refactoring
    │   └── (same structure)
    └── diff/                         # Difference images
        └── diff_*.png
```

---

## Example Workflow

```bash
# 1. Capture baseline (once, before starting)
npm run visual:baseline

# 2. Delete lines 146-200 from styles.css
# (duplicate .flex, .text-*, etc.)

# 3. Compare
npm run visual:compare
# ✅ All 24 screenshots match

# 4. Delete lines 201-300 from styles.css
# (duplicate .p-*, .m-*, etc.)

# 5. Compare
npm run visual:compare
# ❌ 1 failed - button color slightly off

# 6. Review report
open tests/visual-regression-report.html
# See that button changed from #10b981 to #059669

# 7. Fix the color in styles.css

# 8. Compare again
npm run visual:compare
# ✅ All 24 screenshots match

# 9. Approve
npm run visual:approve

# 10. Continue refactoring...
```

---

## Why This Works (No Cookie Jar)

### Physical Constraints

**1. Can't Fake Browser Rendering**
```javascript
await page.screenshot({ fullPage: true });
// → Browser must render actual pixels
```

**2. Can't Fake File Contents**
```javascript
fs.writeFileSync('screenshot.png', imageData);
// → Real PNG written to disk
```

**3. Can't Fake Pixel Comparison**
```javascript
pixelmatch(baseline, current, diff, ...);
// → Every pixel compared
// → Diff count = # pixels changed
```

**4. Can't Hide Visual Differences**
```html
<img src="baseline.png">
<img src="current.png">
<img src="diff.png">
<!-- Human sees actual rendered images -->
```

### Two Independent Verification Paths

```
CSS Refactoring
      │
      ├─→ Path 1: Code Review
      │   "Did you delete the right lines?"
      │
      └─→ Path 2: Visual Regression
          "Does it LOOK the same?"
                │
        Both must agree
                │
        ✅ Safe to deploy
```

---

## Common Questions

### Q: How long does it take?

**Baseline**: ~2-3 minutes (captures 24 screenshots)
**Compare**: ~2-3 minutes (captures + compares)
**Headless**: ~1 minute

### Q: When should I run this?

**Before**: Making CSS changes
**After**: Each incremental change
**CI/CD**: On every PR that touches CSS

### Q: What if I get false positives?

Adjust threshold:
```bash
node tests/visual-regression-test.js --compare --threshold=0.02
```

### Q: Do I need to test all 3 themes?

**Recommended**: Yes (catches theme-specific bugs)
**Fast mode**: Test dark only with `--themes=dark`

### Q: Can I test just one page?

Not currently, but you can:
1. Modify `captureAllStates()` in the test file
2. Comment out pages you don't need
3. Re-run baseline and compare

---

## Integration

### Git Pre-commit Hook

```bash
# .git/hooks/pre-commit
if git diff --cached --name-only | grep -q "\.css$"; then
    npm run visual:compare:headless || exit 1
fi
```

### CI/CD (GitHub Actions)

```yaml
- name: Visual regression
  run: npm run visual:compare:headless

- name: Upload report on failure
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: visual-regression
    path: tests/screenshots/
```

---

## Need Help?

**Comprehensive guide**: [VISUAL_REGRESSION_GUIDE.md](VISUAL_REGRESSION_GUIDE.md)

**Common issues**: See "Troubleshooting" section in guide

**Test source**: [visual-regression-test.js](visual-regression-test.js) (well-commented)

---

## Key Takeaways

✅ **Take baseline** before refactoring
✅ **Make incremental** CSS changes
✅ **Compare after** each change
✅ **Review report** - don't auto-approve
✅ **Approve intentional** changes
✅ **Revert bugs** immediately

**Bottom Line**: This test gives you **physical proof** (actual pixels) that your CSS refactoring didn't break visual appearance. You can't fake it, bypass it, or shortcut it - pixels either match or they don't.

**Happy refactoring!** 🎨✨
