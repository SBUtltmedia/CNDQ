/**
 * Verify Text Color Contrast
 * Checks all text colors against their backgrounds
 */

const ColorContrastHelper = require('./helpers/color-contrast');
const ReportingHelper = require('./helpers/reporting');

const CONFIG = {
    darkTheme: {
        backgrounds: {
            primary: '#111827',
            secondary: '#1f2937',
            tertiary: '#374151'
        },
        textColors: {
            primary: '#f9fafb',
            secondary: '#e5e7eb',
            tertiary: '#d1d5db'
        }
    },
    lightTheme: {
        backgrounds: {
            primary: '#ffffff',
            secondary: '#f3f4f6',
            tertiary: '#e5e7eb'
        },
        textColors: {
            primary: '#111827',
            secondary: '#1f2937',
            tertiary: '#374151'
        }
    }
};

function testTextColors() {
    ReportingHelper.printHeader('Text Color Contrast Verification');

    const contrast = new ColorContrastHelper();
    const issues = [];

    // Test Dark Theme
    ReportingHelper.printStep(1, 'Testing dark theme text colors');

    Object.entries(CONFIG.darkTheme.backgrounds).forEach(([bgName, bgColor]) => {
        console.log(`  On ${bgName} background (${bgColor}):`);

        Object.entries(CONFIG.darkTheme.textColors).forEach(([textName, textColor]) => {
            const ratio = contrast.getContrastRatio(textColor, bgColor);
            const passes = ratio >= 4.5;
            const status = passes ? '✓' : '✗';

            console.log(`    ${status} ${textName} text (${textColor}): ${ratio.toFixed(2)}:1`);

            if (!passes) {
                issues.push({
                    theme: 'dark',
                    background: bgName,
                    text: textName,
                    textColor,
                    bgColor,
                    ratio
                });
            }
        });
        console.log();
    });

    // Test Light Theme
    ReportingHelper.printStep(2, 'Testing light theme text colors');

    Object.entries(CONFIG.lightTheme.backgrounds).forEach(([bgName, bgColor]) => {
        console.log(`  On ${bgName} background (${bgColor}):`);

        Object.entries(CONFIG.lightTheme.textColors).forEach(([textName, textColor]) => {
            const ratio = contrast.getContrastRatio(textColor, bgColor);
            const passes = ratio >= 4.5;
            const status = passes ? '✓' : '✗';

            console.log(`    ${status} ${textName} text (${textColor}): ${ratio.toFixed(2)}:1`);

            if (!passes) {
                issues.push({
                    theme: 'light',
                    background: bgName,
                    text: textName,
                    textColor,
                    bgColor,
                    ratio
                });
            }
        });
        console.log();
    });

    // Summary
    ReportingHelper.printSection('📊', 'Summary');
    ReportingHelper.doubleSeparator();

    if (issues.length === 0) {
        ReportingHelper.printSuccess('All text colors pass WCAG AA standards!');
    } else {
        ReportingHelper.printError(`Found ${issues.length} contrast issues:`);
        console.log();

        issues.forEach(issue => {
            console.log(`  ✗ ${issue.theme} theme: ${issue.text} text on ${issue.background} bg`);
            console.log(`    ${issue.textColor} on ${issue.bgColor} = ${issue.ratio.toFixed(2)}:1 (need 4.5:1)`);
        });
    }

    ReportingHelper.doubleSeparator();

    return {
        issues,
        passed: issues.length === 0
    };
}

if (require.main === module) {
    const results = testTextColors();
    process.exit(results.passed ? 0 : 1);
}

module.exports = { testTextColors };
