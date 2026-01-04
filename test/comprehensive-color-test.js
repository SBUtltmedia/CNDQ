/**
 * Comprehensive Color Testing
 * Tests both color harmony (theory) and WCAG accessibility compliance
 *
 * NOTE: This is the legacy test file. The new version is at ../tests/comprehensive-color-test.js
 * This file is kept for backward compatibility but uses the new helper structure.
 */

const ColorHarmonyHelper = require('../tests/helpers/color-harmony');
const ColorContrastHelper = require('../tests/helpers/color-contrast');

// Configuration - using updated WCAG-compliant colors
const CONFIG = {
    darkScheme: {
        C: '#74b1fb',
        N: '#c997fc',
        D: '#fcd554',
        Q: '#fa8f8f'
    },
    lightScheme: {
        C: '#0763d5',
        N: '#8c1ff9',
        D: '#7e6102',
        Q: '#d10a0a'
    },
    darkBackgrounds: {
        'Dark Primary': '#111827',
        'Dark Secondary': '#1f2937',
        'Dark Tertiary': '#374151'
    },
    lightBackgrounds: {
        'Light Primary': '#ffffff',
        'Light Secondary': '#f3f4f6',
        'Light Tertiary': '#e5e7eb'
    }
};

/**
 * Test color scheme comprehensively
 */
function testColorScheme() {
    console.log('='.repeat(70));
    console.log('Comprehensive Color Scheme Testing (Legacy Test)');
    console.log('='.repeat(70));
    console.log();

    const harmony = new ColorHarmonyHelper();
    const contrast = new ColorContrastHelper();

    let allTests = [];
    let passCount = 0;
    let failCount = 0;

    // --- DARK THEME ---
    console.log('DARK THEME TESTING');
    console.log('-'.repeat(70));

    const darkHarmony = harmony.analyzeColorScheme(CONFIG.darkScheme);
    console.log('1. Color Harmony Analysis');
    console.log('  Scheme Type:', darkHarmony.bestMatch.type);
    console.log('  Harmony Score:', `${darkHarmony.bestMatch.score}%`);
    console.log('  Professional Quality:', darkHarmony.isProfessional ? '✓ Yes' : '✗ No');
    console.log('  Hues:', darkHarmony.hues.map(h => `${h}°`).join(', '));
    console.log();

    console.log('2. WCAG Contrast Compliance');
    Object.entries(CONFIG.darkBackgrounds).forEach(([bgName, bgColor]) => {
        console.log(`  Testing on ${bgName} (${bgColor}):`);

        Object.entries(CONFIG.darkScheme).forEach(([chemName, chemColor]) => {
            const ratio = contrast.getContrastRatio(chemColor, bgColor);
            const passesAA = contrast.meetsWCAG(ratio, 'AA', false);
            const passesAAA = contrast.meetsWCAG(ratio, 'AAA', false);

            const status = passesAA ? '✓' : '✗';
            const level = passesAAA ? 'AAA' : (passesAA ? 'AA' : 'FAIL');

            console.log(`    ${status} Chemical ${chemName}: ${ratio.toFixed(2)}:1 [${level}]`);

            allTests.push({ theme: 'dark', bg: bgName, chem: chemName, passes: passesAA });
            if (passesAA) passCount++;
            else failCount++;
        });
        console.log();
    });

    // --- LIGHT THEME ---
    console.log('LIGHT THEME TESTING');
    console.log('-'.repeat(70));

    const lightHarmony = harmony.analyzeColorScheme(CONFIG.lightScheme);
    console.log('1. Color Harmony Analysis');
    console.log('  Scheme Type:', lightHarmony.bestMatch.type);
    console.log('  Harmony Score:', `${lightHarmony.bestMatch.score}%`);
    console.log('  Professional Quality:', lightHarmony.isProfessional ? '✓ Yes' : '✗ No');
    console.log('  Hues:', lightHarmony.hues.map(h => `${h}°`).join(', '));
    console.log();

    console.log('2. WCAG Contrast Compliance');
    Object.entries(CONFIG.lightBackgrounds).forEach(([bgName, bgColor]) => {
        console.log(`  Testing on ${bgName} (${bgColor}):`);

        Object.entries(CONFIG.lightScheme).forEach(([chemName, chemColor]) => {
            const ratio = contrast.getContrastRatio(chemColor, bgColor);
            const passesAA = contrast.meetsWCAG(ratio, 'AA', false);
            const passesAAA = contrast.meetsWCAG(ratio, 'AAA', false);

            const status = passesAA ? '✓' : '✗';
            const level = passesAAA ? 'AAA' : (passesAA ? 'AA' : 'FAIL');

            console.log(`    ${status} Chemical ${chemName}: ${ratio.toFixed(2)}:1 [${level}]`);

            allTests.push({ theme: 'light', bg: bgName, chem: chemName, passes: passesAA });
            if (passesAA) passCount++;
            else failCount++;
        });
        console.log();
    });

    // --- SUMMARY ---
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    const harmonyPass = darkHarmony.isProfessional && lightHarmony.isProfessional;
    const contrastPass = failCount === 0;

    console.log(`  Dark Theme Harmony:   ${darkHarmony.isProfessional ? '✓ PASS' : '✗ FAIL'} (${darkHarmony.bestMatch.score}%)`);
    console.log(`  Light Theme Harmony:  ${lightHarmony.isProfessional ? '✓ PASS' : '✗ FAIL'} (${lightHarmony.bestMatch.score}%)`);
    console.log(`  WCAG Compliance:      ${contrastPass ? '✓ PASS' : '✗ FAIL'} (${passCount}/${passCount + failCount} tests)`);
    console.log();

    const overallPass = harmonyPass && contrastPass;
    console.log(`  Overall Result:       ${overallPass ? '✓ EXCELLENT' : (contrastPass ? '⚠ ACCEPTABLE' : '✗ NEEDS WORK')}`);
    console.log('='.repeat(70));
    console.log();

    return {
        darkHarmony,
        lightHarmony,
        passCount,
        failCount,
        overallPass
    };
}

// Run comprehensive tests
if (require.main === module) {
    const results = testColorScheme();
    process.exit(results.overallPass ? 0 : 1);
}

module.exports = {
    testColorScheme,
    CONFIG
};
