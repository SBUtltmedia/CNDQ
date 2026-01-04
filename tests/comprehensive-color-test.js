/**
 * Comprehensive Color Test (Refactored)
 * 
 * Tests both color harmony (theory) and WCAG accessibility compliance.
 * Uses Puppeteer to extract live colors and theme variables.
 */

const BrowserHelper = require('./helpers/browser');
const ReportingHelper = require('./helpers/reporting');
const ColorHarmonyHelper = require('./helpers/color-harmony');
const ColorContrastHelper = require('./helpers/color-contrast');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    headless: true,
    teams: ['alpha@stonybrook.edu']
};

async function runComprehensiveColorTest() {
    ReportingHelper.printHeader('CNDQ Comprehensive Color & Accessibility Test');
    
    const browser = new BrowserHelper(CONFIG);
    const harmony = new ColorHarmonyHelper();
    const contrast = new ColorContrastHelper();
    
    try {
        await browser.launch();
        const page = await browser.newPage();
        
        // 1. Setup & Extraction
        console.log('   - Extracting theme colors from marketplace...');
        await browser.login(page, CONFIG.teams[0]);
        await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2' });
        
        const themeData = await page.evaluate(() => {
            const getVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return {
                scheme: {
                    C: getVar('--color-chemical-c'),
                    N: getVar('--color-chemical-n'),
                    D: getVar('--color-chemical-d'),
                    Q: getVar('--color-chemical-q')
                },
                backgrounds: {
                    'Primary BG': getVar('--color-bg-primary'),
                    'Secondary BG': getVar('--color-bg-secondary'),
                    'Tertiary BG': getVar('--color-bg-tertiary')
                }
            };
        });

        // 2. Harmony Analysis
        ReportingHelper.printSection('🎨', '1. Color Harmony Analysis');
        const harmonyResults = harmony.analyzeColorScheme(themeData.scheme);
        console.log(`   Scheme Type:    ${harmonyResults.bestMatch.type}`);
        console.log(`   Harmony Score:  ${harmonyResults.bestMatch.score}%`);
        console.log(`   Professional:   ${harmonyResults.isProfessional ? '✓ Yes' : '✗ No'}`);
        console.log(`   Hues:           ${harmonyResults.hues.map(h => `${h}°`).join(', ')}`);

        // 3. Contrast Testing
        ReportingHelper.printSection('♿', '2. WCAG Contrast Compliance');
        const contrastResults = contrast.testContrast(themeData.scheme, themeData.backgrounds);
        
        Object.entries(themeData.backgrounds).forEach(([bgName, bgColor]) => {
            console.log(`   Testing on ${bgName} (${bgColor}):`);
            contrastResults.tests
                .filter(t => t.background === bgName)
                .forEach(t => {
                    const status = t.passesAA ? '✓' : '✗';
                    const level = t.passesAAA ? 'AAA' : (t.passesAA ? 'AA' : 'FAIL');
                    console.log(`     ${status} Chemical ${t.chemical}: ${t.ratio.toFixed(2)}:1 [${level}]`);
                });
        });

        // 4. Differentiation
        ReportingHelper.printSection('👁️', '3. Color Differentiation (Colorblind Friendly)');
        const diffResults = contrast.testDifferentiation(harmonyResults);
        console.log(`   Minimum separation: ${diffResults.minSeparation}°`);
        console.log(`   Sufficient?         ${diffResults.sufficient ? '✓ Yes' : '⚠ Marginal'}`);
        if (!diffResults.sufficient) {
            const tightest = diffResults.pairs.sort((a,b) => a.separation - b.separation)[0];
            console.log(`   Tightest pair:      ${tightest.color1} ↔ ${tightest.color2} (${tightest.separation}°)`);
        }

        // 5. Overall Summary
        ReportingHelper.doubleSeparator();
        console.log('FINAL SUMMARY');
        ReportingHelper.doubleSeparator();
        
        const harmonyPass = harmonyResults.isProfessional;
        const contrastPass = contrastResults.failCount === 0;
        const diffPass = diffResults.sufficient;

        console.log(`   Color Harmony:   ${harmonyPass ? '✓ PASS' : '✗ FAIL'}`);
        console.log(`   Accessibility:   ${contrastPass ? '✓ PASS' : '✗ FAIL'} (${contrastResults.passCount}/${contrastResults.passCount + contrastResults.failCount})`);
        console.log(`   Differentiation: ${diffPass ? '✓ PASS' : '⚠ MARGINAL'}`);
        
        const overallPass = harmonyPass && contrastPass;
        ReportingHelper.printSuccess(`\n${overallPass ? '✨' : '⚠'} Comprehensive Color Test ${overallPass ? 'PASSED' : 'COMPLETED WITH ISSUES'}`);

    } catch (error) {
        ReportingHelper.printError(`Test failed: ${error.message}`);
        console.error(error.stack);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    runComprehensiveColorTest();
}