/**
 * Color Harmony Testing
 * Analyzes color schemes against established color theory principles
 */

/**
 * Convert hex color to HSL
 * @param {string} hex - Hex color code (e.g., "#60a5fa")
 * @returns {object} HSL values { h, s, l }
 */
function hexToHsl(hex) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    let s = 0;
    let l = (max + min) / 2;

    if (diff !== 0) {
        s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / diff + 2) / 6;
                break;
            case b:
                h = ((r - g) / diff + 4) / 6;
                break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

/**
 * Calculate smallest angle between two hues on color wheel
 * @param {number} hue1 - Hue 1 (0-360)
 * @param {number} hue2 - Hue 2 (0-360)
 * @returns {number} Angle in degrees
 */
function hueDistance(hue1, hue2) {
    const diff = Math.abs(hue1 - hue2);
    return diff > 180 ? 360 - diff : diff;
}

/**
 * Check if colors form a tetradic (rectangle) harmony
 * Four colors: two complementary pairs
 * @param {array} hues - Array of 4 hue values
 * @param {number} tolerance - Degrees of tolerance (default 15)
 * @returns {object} Analysis result
 */
function checkTetradic(hues, tolerance = 15) {
    if (hues.length !== 4) return { valid: false, reason: 'Need exactly 4 colors' };

    const sorted = [...hues].sort((a, b) => a - b);

    // Calculate distances between adjacent colors
    const distances = [];
    for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        distances.push(hueDistance(sorted[i], sorted[next]));
    }

    // For tetradic: should have pattern like [60-120°, 60-120°, 60-120°, 60-120°]
    // OR two pairs: [small, large, small, large]
    const avgDist = distances.reduce((a, b) => a + b, 0) / 4;
    const isBalanced = distances.every(d => Math.abs(d - 90) <= tolerance);

    return {
        valid: isBalanced,
        type: 'tetradic',
        distances,
        avgDistance: avgDist,
        score: isBalanced ? 100 : Math.max(0, 100 - Math.abs(avgDist - 90))
    };
}

/**
 * Check if colors form a triadic harmony
 * Three colors evenly spaced (120° apart)
 * @param {array} hues - Array of 3 hue values
 * @param {number} tolerance - Degrees of tolerance (default 15)
 * @returns {object} Analysis result
 */
function checkTriadic(hues, tolerance = 15) {
    if (hues.length !== 3) return { valid: false, reason: 'Need exactly 3 colors' };

    const sorted = [...hues].sort((a, b) => a - b);

    const dist1 = hueDistance(sorted[0], sorted[1]);
    const dist2 = hueDistance(sorted[1], sorted[2]);
    const dist3 = hueDistance(sorted[2], sorted[0]);

    const ideal = 120;
    const valid = [dist1, dist2, dist3].every(d => Math.abs(d - ideal) <= tolerance);

    return {
        valid,
        type: 'triadic',
        distances: [dist1, dist2, dist3],
        avgDistance: (dist1 + dist2 + dist3) / 3,
        score: valid ? 100 : Math.max(0, 100 - Math.abs((dist1 + dist2 + dist3) / 3 - ideal))
    };
}

/**
 * Check if colors form a complementary harmony
 * Two colors opposite on color wheel (180° apart)
 * @param {array} hues - Array of 2 hue values
 * @param {number} tolerance - Degrees of tolerance (default 15)
 * @returns {object} Analysis result
 */
function checkComplementary(hues, tolerance = 15) {
    if (hues.length !== 2) return { valid: false, reason: 'Need exactly 2 colors' };

    const dist = hueDistance(hues[0], hues[1]);
    const ideal = 180;
    const valid = Math.abs(dist - ideal) <= tolerance;

    return {
        valid,
        type: 'complementary',
        distance: dist,
        score: valid ? 100 : Math.max(0, 100 - Math.abs(dist - ideal) / 2)
    };
}

/**
 * Check if colors form an analogous harmony
 * Colors adjacent on color wheel (within 60° of each other)
 * @param {array} hues - Array of hue values
 * @param {number} maxSpread - Maximum spread in degrees (default 60)
 * @returns {object} Analysis result
 */
function checkAnalogous(hues, maxSpread = 60) {
    const sorted = [...hues].sort((a, b) => a - b);
    const spread = hueDistance(sorted[0], sorted[sorted.length - 1]);

    return {
        valid: spread <= maxSpread,
        type: 'analogous',
        spread,
        score: spread <= maxSpread ? 100 : Math.max(0, 100 - (spread - maxSpread))
    };
}

/**
 * Analyze color scheme and detect harmony type
 * @param {object} colorScheme - Object with color properties
 * @returns {object} Comprehensive analysis
 */
function analyzeColorScheme(colorScheme) {
    const colors = Object.values(colorScheme);
    const hslColors = colors.map(hex => hexToHsl(hex));
    const hues = hslColors.map(hsl => hsl.h);

    const results = {
        colors: colorScheme,
        hslValues: hslColors,
        hues,
        analysis: {
            tetradic: hues.length === 4 ? checkTetradic(hues) : null,
            triadic: hues.length === 3 ? checkTriadic(hues) : null,
            complementary: hues.length === 2 ? checkComplementary(hues) : null,
            analogous: checkAnalogous(hues)
        }
    };

    // Determine best match
    const scores = Object.entries(results.analysis)
        .filter(([_, v]) => v !== null)
        .map(([type, analysis]) => ({ type, score: analysis.score || 0, valid: analysis.valid }));

    scores.sort((a, b) => b.score - a.score);

    results.bestMatch = scores[0];
    results.isProfessional = scores[0].score >= 70; // Professional if score >= 70
    results.recommendation = getRecommendation(results);

    return results;
}

/**
 * Get recommendation based on analysis
 * @param {object} results - Analysis results
 * @returns {string} Recommendation text
 */
function getRecommendation(results) {
    const { bestMatch, isProfessional } = results;

    if (!bestMatch) return 'Unable to analyze color scheme';

    if (isProfessional) {
        return `✓ Color scheme follows ${bestMatch.type} harmony (${bestMatch.score}% match). Excellent!`;
    } else if (bestMatch.score >= 50) {
        return `⚠ Color scheme approximately follows ${bestMatch.type} harmony (${bestMatch.score}% match). Consider adjusting for stricter adherence.`;
    } else {
        return `✗ Color scheme does not follow standard harmony rules. Consider redesigning using ${bestMatch.type} or complementary colors.`;
    }
}

/**
 * Test current CNDQ color scheme
 */
function testCNDQColors() {
    console.log('='.repeat(70));
    console.log('CNDQ Color Harmony Analysis');
    console.log('='.repeat(70));
    console.log();

    // Current colors
    const currentScheme = {
        C: '#60a5fa',
        N: '#c084fc',
        D: '#fcd34d',
        Q: '#f87171'
    };

    console.log('Current Color Scheme:');
    console.log('  Chemical C (Blue):   ', currentScheme.C);
    console.log('  Chemical N (Purple): ', currentScheme.N);
    console.log('  Chemical D (Yellow): ', currentScheme.D);
    console.log('  Chemical Q (Red):    ', currentScheme.Q);
    console.log();

    const currentAnalysis = analyzeColorScheme(currentScheme);
    console.log('Current Scheme Analysis:');
    console.log('  Hues:', currentAnalysis.hues.map(h => `${h}°`).join(', '));
    console.log('  Best Match:', currentAnalysis.bestMatch.type, `(${currentAnalysis.bestMatch.score}% score)`);
    console.log('  Professional?', currentAnalysis.isProfessional ? '✓ Yes' : '✗ No');
    console.log('  Recommendation:', currentAnalysis.recommendation);
    console.log();

    // Proposed Option 1: True Tetradic
    const tetraulicScheme = {
        C: '#3b82f6', // Blue 217°
        N: '#f59e0b', // Amber 37°
        D: '#8b5cf6', // Purple 258°
        Q: '#10b981'  // Green 160°
    };

    console.log('-'.repeat(70));
    console.log('Proposed Option 1: True Tetradic Scheme');
    console.log('  Chemical C (Blue):   ', tetraulicScheme.C);
    console.log('  Chemical N (Amber):  ', tetraulicScheme.N);
    console.log('  Chemical D (Purple): ', tetraulicScheme.D);
    console.log('  Chemical Q (Green):  ', tetraulicScheme.Q);
    console.log();

    const tetradicAnalysis = analyzeColorScheme(tetraulicScheme);
    console.log('Tetradic Scheme Analysis:');
    console.log('  Hues:', tetradicAnalysis.hues.map(h => `${h}°`).join(', '));
    console.log('  Best Match:', tetradicAnalysis.bestMatch.type, `(${tetradicAnalysis.bestMatch.score}% score)`);
    console.log('  Professional?', tetradicAnalysis.isProfessional ? '✓ Yes' : '✗ No');
    console.log('  Recommendation:', tetradicAnalysis.recommendation);
    console.log();

    // Return results for automated testing
    return {
        current: currentAnalysis,
        proposed: tetradicAnalysis,
        passed: tetradicAnalysis.isProfessional && tetradicAnalysis.bestMatch.score >= 80
    };
}

// Run tests
if (require.main === module) {
    const results = testCNDQColors();
    process.exit(results.passed ? 0 : 1);
}

module.exports = {
    hexToHsl,
    hueDistance,
    checkTetradic,
    checkTriadic,
    checkComplementary,
    checkAnalogous,
    analyzeColorScheme,
    testCNDQColors
};
