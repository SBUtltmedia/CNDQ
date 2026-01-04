/**
 * Color Contrast Helper - WCAG accessibility analysis
 */

class ColorContrastHelper {
    /**
     * Calculate relative luminance for WCAG contrast calculations
     * @param {string} hex - Hex color code
     * @returns {number} Relative luminance (0-1)
     */
    getLuminance(hex) {
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
    getContrastRatio(color1, color2) {
        const lum1 = this.getLuminance(color1);
        const lum2 = this.getLuminance(color2);
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    /**
     * Check if contrast meets WCAG standards
     * @param {number} ratio - Contrast ratio
     * @param {string} level - 'AA' or 'AAA'
     * @param {boolean} largeText - Is text large (18pt+ or 14pt+ bold)?
     * @returns {boolean}
     */
    meetsWCAG(ratio, level = 'AA', largeText = false) {
        if (level === 'AAA') {
            return largeText ? ratio >= 4.5 : ratio >= 7;
        }
        return largeText ? ratio >= 3 : ratio >= 4.5;
    }

    /**
     * Test contrast for all color combinations against backgrounds
     * @param {object} scheme - Color scheme object
     * @param {object} backgrounds - Background colors to test against
     * @returns {object} Test results
     */
    testContrast(scheme, backgrounds) {
        const contrastTests = [];
        let passCount = 0;
        let failCount = 0;

        Object.entries(backgrounds).forEach(([bgName, bgColor]) => {
            Object.entries(scheme).forEach(([chemName, chemColor]) => {
                const ratio = this.getContrastRatio(chemColor, bgColor);
                const passesAA = this.meetsWCAG(ratio, 'AA', false);
                const passesAAA = this.meetsWCAG(ratio, 'AAA', false);

                contrastTests.push({
                    chemical: chemName,
                    background: bgName,
                    bgColor,
                    chemColor,
                    ratio,
                    passesAA,
                    passesAAA
                });

                if (passesAA) passCount++;
                else failCount++;
            });
        });

        return {
            tests: contrastTests,
            passCount,
            failCount,
            passRate: passCount / (passCount + failCount)
        };
    }

    /**
     * Calculate color differentiation (for colorblind users)
     * @param {object} harmonyResults - Results from harmony analysis
     * @returns {object} Differentiation analysis
     */
    testDifferentiation(harmonyResults) {
        const colors = Object.entries(harmonyResults.colors);
        let minDiff = 360;
        const pairs = [];

        for (let i = 0; i < colors.length; i++) {
            for (let j = i + 1; j < colors.length; j++) {
                const hue1 = harmonyResults.hslValues[i].h;
                const hue2 = harmonyResults.hslValues[j].h;
                const diff = Math.abs(hue1 - hue2);
                const minAngleDiff = diff > 180 ? 360 - diff : diff;

                if (minAngleDiff < minDiff) minDiff = minAngleDiff;

                pairs.push({
                    color1: colors[i][0],
                    color2: colors[j][0],
                    separation: minAngleDiff
                });
            }
        }

        const goodDifferentiation = minDiff >= 30;

        return {
            minSeparation: minDiff,
            sufficient: goodDifferentiation,
            pairs
        };
    }
}

module.exports = ColorContrastHelper;
