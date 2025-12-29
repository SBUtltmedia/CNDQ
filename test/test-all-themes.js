/**
 * Test actual theme colors from CSS
 * Tests both color harmony and WCAG for all themes
 */

const { testColorScheme } = require('./comprehensive-color-test.js');

console.log('Testing CNDQ Color Schemes Across All Themes\n');

// Default/Dark Theme
console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║                     DEFAULT/DARK THEME                            ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log();

const darkScheme = {
    C: '#6eb5ff',
    N: '#d4a8fc',
    D: '#fcd34d',
    Q: '#ffa0a0'
};

const darkBackgrounds = {
    'Primary': '#1f2937',
    'Secondary': '#374151'
};

const darkResults = testColorScheme(darkScheme, darkBackgrounds);

console.log('\n\n');

// Light Theme
console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║                        LIGHT THEME                                ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log();

const lightScheme = {
    C: '#1d4ed8',
    N: '#7c3aed',
    D: '#92570b',
    Q: '#b91c1c'
};

const lightBackgrounds = {
    'Primary': '#ffffff',
    'Secondary': '#e5e7eb'
};

const lightResults = testColorScheme(lightScheme, lightBackgrounds);

console.log('\n\n');

// High Contrast Theme
console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║                    HIGH CONTRAST THEME                            ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log();

const highContrastScheme = {
    C: '#00bfff',
    N: '#ff00ff',
    D: '#ffff00',
    Q: '#ff4444'
};

const highContrastBackgrounds = {
    'Primary': '#000000',
    'Secondary': '#1a1a1a'
};

const highContrastResults = testColorScheme(highContrastScheme, highContrastBackgrounds);

console.log('\n\n');

// Overall Summary
console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║                      OVERALL SUMMARY                              ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log();

const allResults = [
    { name: 'Dark Theme', results: darkResults },
    { name: 'Light Theme', results: lightResults },
    { name: 'High Contrast', results: highContrastResults }
];

allResults.forEach(({ name, results }) => {
    const harmonyStatus = results.harmony.isProfessional ? '✓' : '✗';
    const contrastStatus = results.contrast.failCount === 0 ? '✓' : '✗';
    const diffStatus = results.differentiation.sufficient ? '✓' : '⚠';
    const overall = results.overallPass ? '✓ PASS' : '✗ FAIL';

    console.log(`  ${name}:`);
    console.log(`    Harmony:         ${harmonyStatus} ${results.harmony.bestMatch.score}%`);
    console.log(`    WCAG Contrast:   ${contrastStatus} ${results.contrast.passCount}/${results.contrast.passCount + results.contrast.failCount}`);
    console.log(`    Differentiation: ${diffStatus} ${results.differentiation.minSeparation}°`);
    console.log(`    Overall:         ${overall}`);
    console.log();
});

const allPass = allResults.every(r => r.results.overallPass);

console.log('═'.repeat(70));
console.log(`  Final Result: ${allPass ? '✓ ALL THEMES PASS' : '⚠ SOME THEMES NEED ADJUSTMENT'}`);
console.log('═'.repeat(70));

// Exit code
process.exit(allPass ? 0 : 1);
