/**
 * Color Harmony Test (Refactored)
 * 
 * Verifies that the current CNDQ color scheme follows established color theory principles.
 * Uses Puppeteer to extract live colors from the application and analyzes them.
 */

const BrowserHelper = require('./helpers/browser');
const ReportingHelper = require('./helpers/reporting');
const ColorHarmonyHelper = require('./helpers/color-harmony');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    headless: true,
    teams: ['alpha@stonybrook.edu'] 
};

async function runColorHarmonyTest() {
    ReportingHelper.printHeader('CNDQ Color Harmony Analysis');
    
    const browser = new BrowserHelper(CONFIG);
    const harmony = new ColorHarmonyHelper();
    
    try {
        await browser.launch();
        const page = await browser.newPage();
        
        // 1. Navigate to marketplace
        console.log('   - Extracting live colors from marketplace...');
        await browser.login(page, CONFIG.teams[0]);
        await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2' });
        
        // 2. Extract chemical colors from CSS variables
        const chemicalColors = await page.evaluate(() => {
            const getVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return {
                C: getVar('--color-chemical-c'),
                N: getVar('--color-chemical-n'),
                D: getVar('--color-chemical-d'),
                Q: getVar('--color-chemical-q')
            };
        });
        
        console.log('   ✓ Extracted colors:');
        Object.entries(chemicalColors).forEach(([chem, color]) => {
            console.log(`     Chemical ${chem}: ${color}`);
        });
        console.log('');

        // 3. Analyze Harmony
        const analysis = harmony.analyzeColorScheme(chemicalColors);
        
        ReportingHelper.printSection('🎨', 'Color Harmony Analysis Results');
        console.log(`   Scheme Type:    ${analysis.bestMatch.type}`);
        console.log(`   Harmony Score:  ${analysis.bestMatch.score}%`);
        console.log(`   Professional:   ${analysis.isProfessional ? '✓ Yes' : '✗ No'}`);
        console.log(`   Hues:           ${analysis.hues.map(h => `${h}°`).join(', ')}`);
        console.log('');
        
        // 4. Recommendation
        ReportingHelper.printSection('📋', 'Recommendation');
        if (analysis.isProfessional) {
            console.log(`   ✓ Color scheme follows ${analysis.bestMatch.type} harmony (${analysis.bestMatch.score}% match). Excellent!`);
        } else if (analysis.bestMatch.score >= 50) {
            console.log(`   ⚠ Color scheme approximately follows ${analysis.bestMatch.type} harmony (${analysis.bestMatch.score}% match).`);
            console.log('     Consider adjusting for stricter adherence.');
        } else {
            console.log(`   ✗ Color scheme does not follow standard harmony rules.`);
            console.log(`     Consider redesigning using ${analysis.bestMatch.type} or complementary colors.`);
        }
        
        const passed = analysis.isProfessional && analysis.bestMatch.score >= 70;
        ReportingHelper.printSuccess(`
${passed ? '✨' : '⚠'} Color Harmony Test ${passed ? 'PASSED' : 'COMPLETED WITH WARNINGS'}`);

    } catch (error) {
        ReportingHelper.printError(`Test failed: ${error.message}`);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    runColorHarmonyTest();
}