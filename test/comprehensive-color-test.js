/**
 * Comprehensive Color Testing
 * Tests both color harmony (theory) and WCAG accessibility compliance
 */

const { analyzeColorScheme } = require('./color-harmony-test.js');

/**
 * Calculate relative luminance for WCAG contrast calculations
 * @param {string} hex - Hex color code
 * @returns {number} Relative luminance (0-1)
 */
function getLuminance(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const [rs, gs, bs] = [r, g, b].map(c => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate WCAG contrast ratio between two colors
 * @param {string} color1 - Hex color code
 * @param {string} color2 - Hex color code
 * @returns {number} Contrast ratio (1-21)
 */
function getContrastRatio(color1, color2) {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA standards
 * @param {number} ratio - Contrast ratio
 * @param {string} level - 'AA' or 'AAA'
 * @param {boolean} largeText - Is text large (18pt+ or 14pt+ bold)?
 * @returns {boolean}
 */
function meetsWCAG(ratio, level = 'AA', largeText = false) {
    if (level === 'AAA') {
        return largeText ? ratio >= 4.5 : ratio >= 7;
    }
    return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Test color scheme comprehensively
 * @param {object} scheme - Color scheme object
 * @param {object} backgrounds - Background colors to test against
 * @returns {object} Test results
 */
function testColorScheme(scheme, backgrounds) {
    console.log('='.repeat(70));
    console.log('Comprehensive Color Scheme Testing');
    console.log('='.repeat(70));
    console.log();

    // 1. Color Harmony Analysis
    console.log('1. COLOR HARMONY ANALYSIS');
    console.log('-'.repeat(70));
    const harmonyResults = analyzeColorScheme(scheme);
    console.log('  Scheme Type:', harmonyResults.bestMatch.type);
    console.log('  Harmony Score:', `${harmonyResults.bestMatch.score}%`);
    console.log('  Professional Quality:', harmonyResults.isProfessional ? '✓ Yes' : '✗ No');
    console.log('  Hues:', harmonyResults.hues.map(h => `${h}°`).join(', '));
    console.log();

    // 2. WCAG Contrast Testing
    console.log('2. WCAG CONTRAST COMPLIANCE');
    console.log('-'.repeat(70));

    const contrastTests = [];
    let passCount = 0;
    let failCount = 0;

    Object.entries(backgrounds).forEach(([bgName, bgColor]) => {
        console.log(`  Testing on ${bgName} (${bgColor}):`);

        Object.entries(scheme).forEach(([chemName, chemColor]) => {
            const ratio = getContrastRatio(chemColor, bgColor);
            const passesAA = meetsWCAG(ratio, 'AA', false);
            const passesAAA = meetsWCAG(ratio, 'AAA', false);

            const status = passesAA ? '✓' : '✗';
            const level = passesAAA ? 'AAA' : (passesAA ? 'AA' : 'FAIL');

            console.log(`    ${status} Chemical ${chemName}: ${ratio.toFixed(2)}:1 [${level}]`);

            contrastTests.push({
                chemical: chemName,
                background: bgName,
                ratio,
                passesAA,
                passesAAA
            });

            if (passesAA) passCount++;
            else failCount++;
        });

        console.log();
    });

    // 3. Color Differentiation (for colorblind users)
    console.log('3. COLOR DIFFERENTIATION');
    console.log('-'.repeat(70));
    const colors = Object.entries(scheme);
    let minDiff = 360;

    for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
            const hue1 = harmonyResults.hslValues[i].h;
            const hue2 = harmonyResults.hslValues[j].h;
            const diff = Math.abs(hue1 - hue2);
            const minAngleDiff = diff > 180 ? 360 - diff : diff;

            if (minAngleDiff < minDiff) minDiff = minAngleDiff;

            console.log(`  ${colors[i][0]} ↔ ${colors[j][0]}: ${minAngleDiff}° separation`);
        }
    }

    const goodDifferentiation = minDiff >= 30; // At least 30° apart
    console.log();
    console.log('  Minimum separation:', `${minDiff}°`);
    console.log('  Sufficient for colorblind users?', goodDifferentiation ? '✓ Yes' : '⚠ Marginal');
    console.log();

    // 4. Summary
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    const harmonyPass = harmonyResults.isProfessional;
    const contrastPass = failCount === 0;
    const differentiationPass = goodDifferentiation;

    console.log(`  Color Harmony:      ${harmonyPass ? '✓ PASS' : '✗ FAIL'} (${harmonyResults.bestMatch.score}%)`);
    console.log(`  WCAG Compliance:    ${contrastPass ? '✓ PASS' : '✗ FAIL'} (${passCount}/${passCount + failCount} tests)`);
    console.log(`  Differentiation:    ${differentiationPass ? '✓ PASS' : '⚠ MARGINAL'} (${minDiff}° min)`);
    console.log();

    const overallPass = harmonyPass && contrastPass && differentiationPass;
    console.log(`  Overall Result:     ${overallPass ? '✓ EXCELLENT' : (contrastPass ? '⚠ ACCEPTABLE' : '✗ NEEDS WORK')}`);
    console.log('='.repeat(70));

    return {
        harmony: harmonyResults,
        contrast: {
            tests: contrastTests,
            passCount,
            failCount,
            passRate: passCount / (passCount + failCount)
        },
        differentiation: {
            minSeparation: minDiff,
            sufficient: goodDifferentiation
        },
        overallPass
    };
}

// Run comprehensive tests
if (require.main === module) {
    // Current CNDQ scheme
    const currentScheme = {
        C: '#60a5fa',
        N: '#c084fc',
        D: '#fcd34d',
        Q: '#f87171'
    };

    // Test against common backgrounds
    const backgrounds = {
        'Dark Primary': '#1f2937',
        'Dark Secondary': '#374151',
        'Light Primary': '#ffffff',
        'Light Secondary': '#e5e7eb'
    };

    const results = testColorScheme(currentScheme, backgrounds);

    // Exit with appropriate code
    process.exit(results.overallPass ? 0 : 1);
}

module.exports = {
    getLuminance,
    getContrastRatio,
    meetsWCAG,
    testColorScheme
};
