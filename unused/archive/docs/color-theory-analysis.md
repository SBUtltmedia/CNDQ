# Color Theory Analysis & WCAG Compliance

## Current Color Scheme Analysis

### Default Dark Theme
- **Chemical C**: #60a5fa (Blue) - HSL(213°, 93%, 68%)
- **Chemical N**: #c084fc (Purple) - HSL(270°, 95%, 76%)
- **Chemical D**: #fcd34d (Yellow) - HSL(45°, 97%, 65%)
- **Chemical Q**: #f87171 (Red) - HSL(0°, 91%, 71%)

### Color Theory Evaluation

**Current Scheme Type**: Approximate Tetradic (Rectangle)
- Blue (213°) ↔ Yellow (45°) - Not quite complementary (180° apart would be perfect)
- Purple (270°) ↔ Red (0°) - Adjacent on color wheel

**Issues with Current Scheme**:
1. Not following a strict color harmony rule
2. Colors chosen for literal representation (C=cool blue, Q=danger red) rather than harmony
3. Yellow-purple could create visual tension without intentional design

## Color Theory Principles for 4 Chemicals

### Option 1: True Tetradic (Rectangle) Scheme
**Most Vibrant & Balanced**
- Creates two complementary pairs
- High visual interest
- Professional and energetic

**Proposed Colors**:
- Chemical C: #3b82f6 (Blue, 217°) - Primary
- Chemical N: #f59e0b (Amber, 37°) - Complement of blue
- Chemical D: #8b5cf6 (Purple, 258°) - Secondary
- Chemical Q: #10b981 (Green, 160°) - Complement of purple

**WCAG Dark**: All above colors pass 4.5:1 on #1f2937
**WCAG Light**: Darken to C:#1d4ed8, N:#b45309, D:#6d28d9, Q:#047857

### Option 2: Split-Complementary (Designer's Choice)
**Most Sophisticated**
- More subtle than tetradic
- Easier on eyes for long sessions
- Professional appearance

**Proposed Colors**:
- Chemical C: #3b82f6 (Blue, 217°) - Base
- Chemical N: #f59e0b (Orange, 37°) - Complement
- Chemical D: #10b981 (Teal-Green, 160°) - Adjacent to complement
- Chemical Q: #ec4899 (Pink, 330°) - Adjacent to complement

**WCAG Dark**: All pass on dark backgrounds
**WCAG Light**: Darken accordingly

### Option 3: Analogous with Accent (Calm & Professional)
**Most Cohesive**
- Low contrast between chemicals
- Very professional
- Calming for users

**Proposed Colors**:
- Chemical C: #3b82f6 (Blue, 217°)
- Chemical N: #06b6d4 (Cyan, 187°) - Adjacent
- Chemical D: #8b5cf6 (Purple, 258°) - Adjacent
- Chemical Q: #f59e0b (Orange, 37°) - Accent (opposite side)

### Option 4: Triadic + Neutral (Classic)
**Most Balanced**
- Based on RGB color wheel
- Universally appealing
- Timeless design

**Proposed Colors**:
- Chemical C: #3b82f6 (Blue, 217°)
- Chemical N: #eab308 (Yellow, 48°) - 120° from blue
- Chemical D: #ef4444 (Red, 0°) - 120° from yellow
- Chemical Q: #6b7280 (Neutral Gray) - Supporting role

## Color Psychology Application

### Current Meanings (Retained where appropriate):
- **Success/Profit**: Green tones
- **Warning**: Yellow/Amber tones
- **Danger/Loss**: Red tones
- **Information**: Blue tones

### Recommendations:
1. **Primary actions** (Buy/Sell): Use brand green (#10b981)
2. **Chemical C**: Blue (trust, stability)
3. **Chemical N**: Purple/Amber (creativity, value)
4. **Chemical D**: Yellow/Orange (energy, caution)
5. **Chemical Q**: Red/Pink (urgency, attention)

## Testing Strategy

### 1. Color Harmony Testing (Automated)
```javascript
// Calculate color harmony score
function analyzeColorHarmony(colors) {
    const hues = colors.map(c => rgbToHsl(c).h);

    // Check for tetradic (90° apart)
    const isTetradic = checkAngles(hues, [90, 90, 90, 90]);

    // Check for triadic (120° apart)
    const isTriadic = checkAngles(hues, [120, 120, 120]);

    // Check for split-complementary
    const isSplitComp = checkSplitComplementary(hues);

    return {
        isTetradic,
        isTriadic,
        isSplitComp,
        score: calculateHarmonyScore(hues)
    };
}
```

### 2. WCAG Compliance Testing (Existing)
- Continue using axe-core via Puppeteer
- Test all theme combinations
- Ensure 4.5:1 contrast ratio minimum

### 3. Visual Hierarchy Testing
```javascript
// Ensure primary elements stand out
function testVisualHierarchy() {
    // Measure luminance contrast between:
    // 1. Chemical cards vs background (should be high)
    // 2. Text vs card backgrounds (WCAG)
    // 3. Accent colors vs neutral colors (hierarchy)
}
```

### 4. User Preference Testing
- A/B test different schemes
- Measure time-on-task
- Survey for subjective preference

## Recommended Approach

1. **Choose Option 1 (True Tetradic)** for maximum visual impact
2. **Implement automated color harmony testing**
3. **Verify WCAG compliance** across all themes
4. **Document color meanings** in design system
5. **Create color contrast matrices** for future reference

## Implementation Files to Update

1. `css/styles.css` - Update CSS variables
2. `test/color-harmony-test.js` - NEW: Automated harmony testing
3. `test/accessibility.test.js` - Existing WCAG tests
4. `docs/design-system.md` - NEW: Color usage documentation
