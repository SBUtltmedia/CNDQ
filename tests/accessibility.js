/**
 * Accessibility Test
 *
 * WCAG 2.1 Level AA compliance testing using axe-core
 */

const { default: AxeBuilder } = require('@axe-core/puppeteer');
const BrowserHelper = require('./helpers/browser');
const ReportingHelper = require('./helpers/reporting');
const fs = require('fs');
const path = require('path');

class AccessibilityTest {
    constructor(config, browserHelper) {
        this.config = config;
        this.browser = browserHelper;
        this.outputDir = config.outputDir || './accessibility-reports';
    }

    async run() {
        ReportingHelper.printHeader('WCAG 2.1 Accessibility Testing');

        ReportingHelper.printInfo(`Testing WCAG Level: ${this.config.wcagLevel || 'AA'}`);
        ReportingHelper.printInfo(`Base URL: ${this.config.baseUrl}`);
        ReportingHelper.printInfo(`Testing ${this.config.pages.length} page(s) with ${this.config.themes.length} theme(s)`);

        this.ensureOutputDir();

        try {
            const page = await this.browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });

            const results = [];

            // Test each page with each theme
            for (const pageConfig of this.config.pages) {
                // Test default
                const defaultResult = await this.testPage(page, pageConfig.url, pageConfig.name, null);
                results.push(defaultResult);

                // Test each theme
                for (const theme of this.config.themes) {
                    const themeResult = await this.testPage(page, pageConfig.url, pageConfig.name, theme);
                    results.push(themeResult);
                }
            }

            await page.close();

            // Print and save results
            const totalViolations = this.printResults(results);
            await this.saveReports(results);

            if (totalViolations > 0) {
                ReportingHelper.printWarning(`\nTests completed with ${totalViolations} violation(s)`);
                return { success: false, violations: totalViolations };
            } else {
                ReportingHelper.printSuccess('\nAll accessibility tests passed!');
                return { success: true, violations: 0 };
            }

        } catch (error) {
            ReportingHelper.printError(`Accessibility test failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async testModals(page) {
        const modalButtons = [
            '#production-guide-btn',
            '#leaderboard-btn',
            '#settings-btn'
        ];

        let allViolations = [];
        let allPasses = [];
        let allIncomplete = [];

        for (const buttonSelector of modalButtons) {
            try {
                // Check if button exists
                const buttonExists = await page.$(buttonSelector);
                if (!buttonExists) continue;

                // Open modal
                await page.click(buttonSelector);
                await new Promise(resolve => setTimeout(resolve, 500));

                // Test modal
                const modalResults = await new AxeBuilder(page)
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                    .analyze();

                allViolations = [...allViolations, ...modalResults.violations];
                allPasses = [...allPasses, ...modalResults.passes];
                allIncomplete = [...allIncomplete, ...modalResults.incomplete];

                // Close modal (ESC key)
                await page.keyboard.press('Escape');
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                // Continue testing other modals even if one fails
                console.error(`Error testing modal ${buttonSelector}:`, error.message);
            }
        }

        return {
            violations: allViolations,
            passes: allPasses,
            incomplete: allIncomplete
        };
    }

    async testPage(page, url, pageName, theme) {
        try {
            const fullUrl = `${this.config.baseUrl}${url}`;
            ReportingHelper.printInfo(`Testing: ${pageName}${theme ? ` (${theme} theme)` : ''}`);

            await page.goto(fullUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            if (theme) {
                await page.evaluate((themeValue) => {
                    document.documentElement.setAttribute('data-theme', themeValue);
                    localStorage.setItem('theme', themeValue);
                }, theme);
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // First test: Initial page state
            const initialResults = await new AxeBuilder(page)
                .withTags(this.config.standards || ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            // Second test: Open modals and test them
            const modalResults = await this.testModals(page);

            // Combine results
            const results = {
                violations: [...initialResults.violations, ...modalResults.violations],
                passes: [...initialResults.passes, ...modalResults.passes],
                incomplete: [...initialResults.incomplete, ...modalResults.incomplete]
            };

            return {
                pageName,
                url,
                theme,
                violations: results.violations,
                passes: results.passes,
                incomplete: results.incomplete
            };
        } catch (error) {
            return {
                pageName,
                url,
                theme,
                violations: [],
                error: error.message
            };
        }
    }

    printResults(results) {
        let totalViolations = 0;
        const totals = { critical: 0, serious: 0, moderate: 0, minor: 0 };

        results.forEach(result => {
            ReportingHelper.printSubHeader(`${result.pageName}${result.theme ? ` (${result.theme} theme)` : ''}`);

            if (result.error) {
                ReportingHelper.printError(`Test failed: ${result.error}`);
                return;
            }

            if (result.violations.length === 0) {
                ReportingHelper.printSuccess('No accessibility violations found!');
            } else {
                ReportingHelper.printError(`Found ${result.violations.length} violation type(s)`);

                result.violations.forEach(violation => {
                    const impact = violation.impact || 'minor';
                    const nodeCount = violation.nodes.length;
                    totalViolations += nodeCount;

                    totals[impact] = (totals[impact] || 0) + nodeCount;

                    console.log(`\n  [${impact.toUpperCase()}] ${violation.id}`);
                    console.log(`  ${violation.help}`);
                    console.log(`  Affected elements: ${nodeCount}`);
                    console.log(`  ${violation.helpUrl}`);
                });
            }
            console.log('');
        });

        // Print summary
        ReportingHelper.printHeader('Test Summary');
        console.log(`Pages tested: ${results.length}`);
        console.log(`Total violations: ${totalViolations}\n`);

        if (totalViolations > 0) {
            console.log(`  Critical:  ${totals.critical}`);
            console.log(`  Serious:   ${totals.serious}`);
            console.log(`  Moderate:  ${totals.moderate}`);
            console.log(`  Minor:     ${totals.minor}`);
        }

        return totalViolations;
    }

    async saveReports(results) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // JSON report
        const jsonPath = path.join(this.outputDir, `accessibility-report-${timestamp}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
        ReportingHelper.printSuccess(`JSON report saved: ${jsonPath}`);

        // HTML report
        const htmlPath = path.join(this.outputDir, `accessibility-report-${timestamp}.html`);
        const htmlContent = this.generateHtmlReport(results, new Date().toLocaleString());
        fs.writeFileSync(htmlPath, htmlContent);
        ReportingHelper.printSuccess(`HTML report saved: ${htmlPath}`);
    }

    generateHtmlReport(results, timestamp) {
        // Simplified HTML report (use the detailed one from test_accessibility.js if needed)
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Accessibility Report - ${timestamp}</title>
    <style>
        body { font-family: sans-serif; max-width: 1200px; margin: 20px auto; padding: 20px; }
        h1 { color: #2c3e50; }
        .violation { border: 1px solid #ddd; margin: 20px 0; padding: 15px; }
        .critical { border-left: 4px solid #e74c3c; }
        .serious { border-left: 4px solid #e67e22; }
        .moderate { border-left: 4px solid #f39c12; }
        .minor { border-left: 4px solid #95a5a6; }
    </style>
</head>
<body>
    <h1>WCAG Accessibility Report</h1>
    <p>Generated: ${timestamp}</p>
    <pre>${JSON.stringify(results, null, 2)}</pre>
</body>
</html>`;
    }

    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
}

module.exports = AccessibilityTest;
