/**
 * Color Harmony Test
 * Tests color schemes against established color theory principles
 *
 * NOTE: This is the legacy test file. The new version is at ../tests/color-harmony-test.js
 * This file is kept for backward compatibility but uses the new helper structure.
 */

const path = require('path');
const ColorHarmonyHelper = require('../tests/helpers/color-harmony');
const ReportingHelper = require('../tests/helpers/reporting');

// Configuration
const CONFIG = {
    currentScheme: {
        C: '#74b1fb',
        N: '#c997fc',
        D: '#fcd554',
        Q: '#fa8f8f'
    },
    proposedScheme: {
        C: '#3b82f6', // Blue 217°
        N: '#f59e0b', // Amber 37°
        D: '#8b5cf6', // Purple 258°
        Q: '#10b981'  // Green 160°
    }
};

/**
 * Print harmony analysis results
 */
function printHarmonyResults(name, analysis) {
    console.log(`\n${name} Scheme Analysis:`);
    console.log('-'.repeat(70));

    console.log(`  Hues: ${analysis.hues.map(h => `${h}°`).join(', ')}`);
    console.log(`  Best Match: ${analysis.bestMatch.type} (${analysis.bestMatch.score}% score)`);
    console.log(`  Professional? ${analysis.isProfessional ? '✓ Yes' : '✗ No'}`);

    // Show detailed analysis
    Object.entries(analysis.analysis).forEach(([type, result]) => {
        if (result && result.type) {
            const status = result.valid ? '✓' : '✗';
            console.log(`  ${status} ${type}: ${result.score.toFixed(1)}%`);
        }
    });
}

/**
 * Run harmony test
 */
function testCNDQColors() {
    console.log('='.repeat(70));
    console.log('CNDQ Color Harmony Analysis (Legacy Test)');
    console.log('='.repeat(70));
    console.log();

    const harmony = new ColorHarmonyHelper();

    // --- TEST CURRENT SCHEME ---
    console.log('Current Color Scheme (Dark Theme):');
    Object.entries(CONFIG.currentScheme).forEach(([chem, color]) => {
        console.log(`  Chemical ${chem}: ${color}`);
    });

    const currentAnalysis = harmony.analyzeColorScheme(CONFIG.currentScheme);
    printHarmonyResults('Current', currentAnalysis);

    // --- TEST PROPOSED SCHEME ---
    console.log('\n' + '='.repeat(70));
    console.log('Proposed Tetradic Scheme:');
    Object.entries(CONFIG.proposedScheme).forEach(([chem, color]) => {
        console.log(`  Chemical ${chem}: ${color}`);
    });

    const proposedAnalysis = harmony.analyzeColorScheme(CONFIG.proposedScheme);
    printHarmonyResults('Proposed', proposedAnalysis);

    // --- SUMMARY ---
    console.log('\n' + '='.repeat(70));
    console.log('Summary:');
    console.log('-'.repeat(70));
    console.log(`Current Scheme:  ${currentAnalysis.isProfessional ? '✓ PASS' : '✗ FAIL'} (${currentAnalysis.bestMatch.score}%)`);
    console.log(`Proposed Scheme: ${proposedAnalysis.isProfessional ? '✓ PASS' : '✗ FAIL'} (${proposedAnalysis.bestMatch.score}%)`);
    console.log('='.repeat(70));
    console.log();

    const passed = proposedAnalysis.isProfessional && proposedAnalysis.bestMatch.score >= 80;

    if (passed) {
        console.log('✓ Proposed scheme meets professional standards!\n');
    } else {
        console.log('✗ Proposed scheme needs improvement\n');
    }

    return {
        current: currentAnalysis,
        proposed: proposedAnalysis,
        passed
    };
}

// Run tests
if (require.main === module) {
    const results = testCNDQColors();
    process.exit(results.passed ? 0 : 1);
}

module.exports = {
    testCNDQColors,
    CONFIG
};
