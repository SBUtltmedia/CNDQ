/**
 * Color Harmony Helper - Color theory analysis
 */

class ColorHarmonyHelper {
    /**
     * Convert hex color to HSL
     * @param {string} hex - Hex color code (e.g., "#60a5fa")
     * @returns {object} HSL values { h, s, l }
     */
    hexToHsl(hex) {
        hex = hex.replace('#', '');

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
    hueDistance(hue1, hue2) {
        const diff = Math.abs(hue1 - hue2);
        return diff > 180 ? 360 - diff : diff;
    }

    /**
     * Check if colors form a tetradic (rectangle) harmony
     * @param {array} hues - Array of 4 hue values
     * @param {number} tolerance - Degrees of tolerance (default 15)
     * @returns {object} Analysis result
     */
    checkTetradic(hues, tolerance = 15) {
        if (hues.length !== 4) return { valid: false, reason: 'Need exactly 4 colors' };

        const sorted = [...hues].sort((a, b) => a - b);

        const distances = [];
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            distances.push(this.hueDistance(sorted[i], sorted[next]));
        }

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
     * @param {array} hues - Array of 3 hue values
     * @param {number} tolerance - Degrees of tolerance (default 15)
     * @returns {object} Analysis result
     */
    checkTriadic(hues, tolerance = 15) {
        if (hues.length !== 3) return { valid: false, reason: 'Need exactly 3 colors' };

        const sorted = [...hues].sort((a, b) => a - b);

        const dist1 = this.hueDistance(sorted[0], sorted[1]);
        const dist2 = this.hueDistance(sorted[1], sorted[2]);
        const dist3 = this.hueDistance(sorted[2], sorted[0]);

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
     * @param {array} hues - Array of 2 hue values
     * @param {number} tolerance - Degrees of tolerance (default 15)
     * @returns {object} Analysis result
     */
    checkComplementary(hues, tolerance = 15) {
        if (hues.length !== 2) return { valid: false, reason: 'Need exactly 2 colors' };

        const dist = this.hueDistance(hues[0], hues[1]);
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
     * @param {array} hues - Array of hue values
     * @param {number} maxSpread - Maximum spread in degrees (default 60)
     * @returns {object} Analysis result
     */
    checkAnalogous(hues, maxSpread = 60) {
        const sorted = [...hues].sort((a, b) => a - b);
        const spread = this.hueDistance(sorted[0], sorted[sorted.length - 1]);

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
    analyzeColorScheme(colorScheme) {
        const colors = Object.values(colorScheme);
        const hslColors = colors.map(hex => this.hexToHsl(hex));
        const hues = hslColors.map(hsl => hsl.h);

        const results = {
            colors: colorScheme,
            hslValues: hslColors,
            hues,
            analysis: {
                tetradic: hues.length === 4 ? this.checkTetradic(hues) : null,
                triadic: hues.length === 3 ? this.checkTriadic(hues) : null,
                complementary: hues.length === 2 ? this.checkComplementary(hues) : null,
                analogous: this.checkAnalogous(hues)
            }
        };

        // Determine best match
        const scores = Object.entries(results.analysis)
            .filter(([_, v]) => v !== null)
            .map(([type, analysis]) => ({ type, score: analysis.score || 0, valid: analysis.valid }));

        scores.sort((a, b) => b.score - a.score);

        results.bestMatch = scores[0];
        results.isProfessional = scores[0].score >= 70;

        return results;
    }
}

module.exports = ColorHarmonyHelper;
