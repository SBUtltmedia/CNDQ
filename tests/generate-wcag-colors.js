/**
 * Generate WCAG-Compliant Color Palette
 * Creates color values that pass WCAG AA on both light and dark backgrounds
 */

const ColorContrastHelper = require('./helpers/color-contrast');
const ColorHarmonyHelper = require('./helpers/color-harmony');
const ReportingHelper = require('./helpers/reporting');

// Configuration
const CONFIG = {
    baseScheme: {
        C: '#60a5fa', // Blue
        N: '#c084fc', // Purple
        D: '#fcd34d', // Yellow
        Q: '#f87171'  // Red
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
 * Adjust color lightness to meet contrast ratio
 */
function adjustColorForContrast(hex, background, targetRatio = 4.5, direction = 'auto') {
    const contrast = new ColorContrastHelper();
    const harmony = new ColorHarmonyHelper();

    const hsl = harmony.hexToHsl(hex);
    let { h, s, l } = hsl;

    // Determine direction if auto
    if (direction === 'auto') {
        const bgLum = contrast.getLuminance(background);
        direction = bgLum > 0.5 ? 'darker' : 'lighter';
    }

    // Binary search for the right lightness
    let minL = direction === 'darker' ? 0 : l;
    let maxL = direction === 'darker' ? l : 100;
    let bestL = l;
    let iterations = 0;

    while (maxL - minL > 1 && iterations < 50) {
        iterations++;
        const testL = Math.round((minL + maxL) / 2);
        const testHex = hslToHex(h, s, testL);
        const ratio = contrast.getContrastRatio(testHex, background);

        if (ratio >= targetRatio) {
            bestL = testL;
            if (direction === 'darker') {
                minL = testL;
            } else {
                maxL = testL;
            }
        } else {
            if (direction === 'darker') {
                maxL = testL;
            } else {
                minL = testL;
            }
        }
    }

    return hslToHex(h, s, bestL);
}

/**
 * Convert HSL to Hex
 */
function hslToHex(h, s, l) {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate complete color palette
 */
function generatePalette() {
    ReportingHelper.printHeader('WCAG-Compliant Color Palette Generator');

    const contrast = new ColorContrastHelper();
    const harmony = new ColorHarmonyHelper();

    const results = {
        dark: {},
        light: {}
    };

    // --- STEP 1: GENERATE DARK THEME COLORS ---
    ReportingHelper.printStep(1, 'Generating dark theme colors (light variants)');

    const darkBg = CONFIG.darkBackgrounds['Dark Tertiary']; // Strictest dark background

    Object.entries(CONFIG.baseScheme).forEach(([chem, baseColor]) => {
        const adjusted = adjustColorForContrast(baseColor, darkBg, 4.5, 'lighter');
        results.dark[chem] = adjusted;

        const ratio = contrast.getContrastRatio(adjusted, darkBg);
        const status = ratio >= 4.5 ? '✓' : '✗';
        console.log(`  ${status} Chemical ${chem}: ${adjusted} (${ratio.toFixed(2)}:1 on ${darkBg})`);
    });
    console.log();

    // --- STEP 2: GENERATE LIGHT THEME COLORS ---
    ReportingHelper.printStep(2, 'Generating light theme colors (dark variants)');

    const lightBg = CONFIG.lightBackgrounds['Light Tertiary']; // Strictest light background (lightest gray)

    Object.entries(CONFIG.baseScheme).forEach(([chem, baseColor]) => {
        const adjusted = adjustColorForContrast(baseColor, lightBg, 4.5, 'darker');
        results.light[chem] = adjusted;

        const ratio = contrast.getContrastRatio(adjusted, lightBg);
        const status = ratio >= 4.5 ? '✓' : '✗';
        console.log(`  ${status} Chemical ${chem}: ${adjusted} (${ratio.toFixed(2)}:1 on ${lightBg})`);
    });
    console.log();

    // --- STEP 3: VERIFY HARMONY IS MAINTAINED ---
    ReportingHelper.printStep(3, 'Verifying color harmony is preserved');

    const darkHarmony = harmony.analyzeColorScheme(results.dark);
    const lightHarmony = harmony.analyzeColorScheme(results.light);

    console.log(`  Dark theme harmony:  ${darkHarmony.bestMatch.type} (${darkHarmony.bestMatch.score}%)`);
    console.log(`  Light theme harmony: ${lightHarmony.bestMatch.type} (${lightHarmony.bestMatch.score}%)`);
    console.log();

    // --- STEP 4: GENERATE CSS OUTPUT ---
    ReportingHelper.printStep(4, 'Generating CSS variables');

    console.log('/* Dark Theme Chemical Colors */');
    Object.entries(results.dark).forEach(([chem, color]) => {
        console.log(`--color-chemical-${chem.toLowerCase()}: ${color};`);
    });
    console.log();

    console.log('/* Light Theme Chemical Colors */');
    console.log('[data-theme="light"] {');
    Object.entries(results.light).forEach(([chem, color]) => {
        console.log(`    --color-chemical-${chem.toLowerCase()}: ${color};`);
    });
    console.log('}');
    console.log();

    // --- STEP 5: SUMMARY ---
    ReportingHelper.printSection('📊', 'Summary');
    ReportingHelper.doubleSeparator();

    const allPass = darkHarmony.isProfessional && lightHarmony.isProfessional;

    if (allPass) {
        ReportingHelper.printSuccess('✨ All colors meet WCAG AA standards and preserve harmony!');
    } else {
        ReportingHelper.printWarning('⚠ Colors adjusted but harmony may be affected');
    }

    ReportingHelper.doubleSeparator();

    return {
        dark: results.dark,
        light: results.light,
        darkHarmony,
        lightHarmony,
        success: allPass
    };
}

// Run generator
if (require.main === module) {
    try {
        const results = generatePalette();
        process.exit(results.success ? 0 : 1);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

module.exports = { generatePalette, adjustColorForContrast, hslToHex };
