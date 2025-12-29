/**
 * WCAG Accessibility Testing Script
 *
 * This script tests WCAG 2.1 compliance for the CNDQ Marketplace application.
 * It runs automated accessibility audits using axe-core and generates detailed reports.
 *
 * Usage:
 *   npm run test:a11y              - Run all accessibility tests
 *   npm run test:a11y -- --verbose - Run with detailed violation output
 */

const puppeteer = require('puppeteer');
const { default: AxeBuilder } = require('@axe-core/puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    baseUrl: 'http://localhost:8080', // Adjust to your local server URL
    pages: [
        { name: 'Main Page', url: '/index.html' },
        { name: 'Admin Page', url: '/admin.html' }
    ],
    wcagLevel: 'AA', // Test for WCAG 2.1 Level AA compliance
    standards: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    outputDir: './accessibility-reports',
    // Test with different themes
    themes: ['dark', 'light', 'high-contrast']
};

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

// Utility functions
function printHeader(text) {
    console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(80)}`);
    console.log(`  ${text}`);
    console.log(`${'='.repeat(80)}${colors.reset}\n`);
}

function printSubHeader(text) {
    console.log(`\n${colors.bold}${colors.blue}${text}${colors.reset}`);
    console.log(`${'-'.repeat(80)}`);
}

function printSuccess(text) {
    console.log(`${colors.green}✓ ${text}${colors.reset}`);
}

function printError(text) {
    console.log(`${colors.red}✗ ${text}${colors.reset}`);
}

function printWarning(text) {
    console.log(`${colors.yellow}⚠ ${text}${colors.reset}`);
}

function printInfo(text) {
    console.log(`${colors.cyan}ℹ ${text}${colors.reset}`);
}

// Create output directory if it doesn't exist
function ensureOutputDir() {
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
}

// Generate HTML report
function generateHtmlReport(results, timestamp) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WCAG Accessibility Report - ${timestamp}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; margin-bottom: 10px; }
        .timestamp { color: #7f8c8d; font-size: 14px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card.critical { background: #fee; border-left: 4px solid #e74c3c; }
        .summary-card.serious { background: #fef3e3; border-left: 4px solid #e67e22; }
        .summary-card.moderate { background: #fff8e1; border-left: 4px solid #f39c12; }
        .summary-card.minor { background: #e8f5e9; border-left: 4px solid #27ae60; }
        .summary-card h3 { font-size: 14px; color: #7f8c8d; margin-bottom: 5px; }
        .summary-card .count { font-size: 32px; font-weight: bold; }
        .page-result { margin-bottom: 40px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .page-header { background: #34495e; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; }
        .page-header h2 { font-size: 18px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .badge.pass { background: #27ae60; color: white; }
        .badge.fail { background: #e74c3c; color: white; }
        .violation { border-bottom: 1px solid #eee; padding: 20px; }
        .violation:last-child { border-bottom: none; }
        .violation-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; }
        .violation-title { font-weight: bold; color: #2c3e50; flex: 1; }
        .impact { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
        .impact.critical { background: #e74c3c; color: white; }
        .impact.serious { background: #e67e22; color: white; }
        .impact.moderate { background: #f39c12; color: white; }
        .impact.minor { background: #95a5a6; color: white; }
        .violation-description { color: #555; margin-bottom: 10px; font-size: 14px; }
        .violation-help { background: #ecf0f1; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 13px; }
        .violation-help a { color: #3498db; text-decoration: none; }
        .violation-help a:hover { text-decoration: underline; }
        .nodes { margin-top: 10px; }
        .node { background: #f8f9fa; border-left: 3px solid #3498db; padding: 10px; margin-bottom: 8px; font-family: monospace; font-size: 12px; }
        .node-html { color: #555; margin-bottom: 5px; word-break: break-all; }
        .node-target { color: #7f8c8d; font-size: 11px; }
        .no-violations { text-align: center; padding: 40px; color: #27ae60; font-size: 18px; }
        .wcag-tags { margin-top: 10px; }
        .tag { display: inline-block; background: #3498db; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-right: 5px; margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>WCAG Accessibility Report</h1>
        <div class="timestamp">Generated: ${timestamp}</div>

        ${generateSummarySection(results)}

        ${results.map(result => generatePageSection(result)).join('')}

        <div style="margin-top: 40px; padding: 20px; background: #ecf0f1; border-radius: 8px; font-size: 14px; color: #555;">
            <strong>About this report:</strong> This automated test uses axe-core to check for WCAG 2.1 Level AA compliance.
            While automated testing catches many issues, manual testing is still required for complete accessibility validation.
            Some checks, like color contrast in custom themes or screen reader navigation flow, may need human verification.
        </div>
    </div>
</body>
</html>
    `;

    return html;
}

function generateSummarySection(results) {
    const totals = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0
    };

    results.forEach(result => {
        result.violations.forEach(violation => {
            const impact = violation.impact || 'minor';
            totals[impact] = (totals[impact] || 0) + violation.nodes.length;
        });
    });

    return `
        <div class="summary">
            <div class="summary-card critical">
                <h3>Critical</h3>
                <div class="count">${totals.critical}</div>
            </div>
            <div class="summary-card serious">
                <h3>Serious</h3>
                <div class="count">${totals.serious}</div>
            </div>
            <div class="summary-card moderate">
                <h3>Moderate</h3>
                <div class="count">${totals.moderate}</div>
            </div>
            <div class="summary-card minor">
                <h3>Minor</h3>
                <div class="count">${totals.minor}</div>
            </div>
        </div>
    `;
}

function generatePageSection(result) {
    const hasViolations = result.violations.length > 0;
    const badge = hasViolations
        ? `<span class="badge fail">${result.violations.length} Issue${result.violations.length !== 1 ? 's' : ''}</span>`
        : `<span class="badge pass">All Passed</span>`;

    return `
        <div class="page-result">
            <div class="page-header">
                <h2>${result.pageName} ${result.theme ? `(${result.theme} theme)` : ''}</h2>
                ${badge}
            </div>
            ${hasViolations ? `
                <div>
                    ${result.violations.map(violation => `
                        <div class="violation">
                            <div class="violation-header">
                                <div class="violation-title">${violation.id}: ${violation.help}</div>
                                <span class="impact ${violation.impact}">${violation.impact}</span>
                            </div>
                            <div class="violation-description">${violation.description}</div>
                            <div class="violation-help">
                                <strong>How to fix:</strong> ${violation.helpUrl ? `<a href="${violation.helpUrl}" target="_blank">Read more</a>` : 'See axe-core documentation'}
                            </div>
                            <div class="wcag-tags">
                                ${violation.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                            </div>
                            <div class="nodes">
                                <strong>Affected elements (${violation.nodes.length}):</strong>
                                ${violation.nodes.slice(0, 5).map(node => `
                                    <div class="node">
                                        <div class="node-html">${escapeHtml(node.html)}</div>
                                        <div class="node-target">Target: ${node.target.join(', ')}</div>
                                        ${node.failureSummary ? `<div style="color: #e74c3c; font-size: 11px; margin-top: 5px;">${node.failureSummary}</div>` : ''}
                                    </div>
                                `).join('')}
                                ${violation.nodes.length > 5 ? `<div style="color: #7f8c8d; font-size: 12px; margin-top: 5px;">... and ${violation.nodes.length - 5} more</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="no-violations">✓ No accessibility violations found!</div>
            `}
        </div>
    `;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Run accessibility test on a page
async function testPage(browser, page, url, pageName, theme = null) {
    try {
        const fullUrl = `${CONFIG.baseUrl}${url}`;
        printInfo(`Testing: ${pageName}${theme ? ` (${theme} theme)` : ''}`);

        await page.goto(fullUrl, { waitUntil: 'networkidle0', timeout: 30000 });

        // If testing a theme, set it
        if (theme) {
            await page.evaluate((themeValue) => {
                document.documentElement.setAttribute('data-theme', themeValue);
                localStorage.setItem('theme', themeValue);
            }, theme);
            await page.waitForTimeout(500); // Wait for theme to apply
        }

        // Run axe accessibility tests
        const results = await new AxeBuilder({ page })
            .withTags(CONFIG.standards)
            .analyze();

        return {
            pageName,
            url,
            theme,
            violations: results.violations,
            passes: results.passes,
            incomplete: results.incomplete
        };
    } catch (error) {
        printError(`Failed to test ${pageName}: ${error.message}`);
        return {
            pageName,
            url,
            theme,
            violations: [],
            passes: [],
            incomplete: [],
            error: error.message
        };
    }
}

// Print test results to console
function printResults(results, verbose = false) {
    let totalViolations = 0;
    let criticalCount = 0;
    let seriousCount = 0;
    let moderateCount = 0;
    let minorCount = 0;

    results.forEach(result => {
        printSubHeader(`${result.pageName}${result.theme ? ` (${result.theme} theme)` : ''}`);

        if (result.error) {
            printError(`Test failed: ${result.error}`);
            return;
        }

        if (result.violations.length === 0) {
            printSuccess('No accessibility violations found!');
        } else {
            printError(`Found ${result.violations.length} violation type(s)`);

            result.violations.forEach(violation => {
                const impact = violation.impact || 'minor';
                const nodeCount = violation.nodes.length;
                totalViolations += nodeCount;

                // Count by severity
                if (impact === 'critical') criticalCount += nodeCount;
                else if (impact === 'serious') seriousCount += nodeCount;
                else if (impact === 'moderate') moderateCount += nodeCount;
                else minorCount += nodeCount;

                const impactColor = {
                    'critical': colors.red,
                    'serious': colors.red,
                    'moderate': colors.yellow,
                    'minor': colors.yellow
                }[impact] || colors.reset;

                console.log(`\n  ${impactColor}[${impact.toUpperCase()}]${colors.reset} ${violation.id}`);
                console.log(`  ${violation.help}`);
                console.log(`  ${colors.blue}Affected elements: ${nodeCount}${colors.reset}`);
                console.log(`  ${colors.cyan}${violation.helpUrl}${colors.reset}`);

                if (verbose) {
                    violation.nodes.slice(0, 3).forEach((node, idx) => {
                        console.log(`\n    ${colors.magenta}Element ${idx + 1}:${colors.reset}`);
                        console.log(`    ${node.html.substring(0, 100)}${node.html.length > 100 ? '...' : ''}`);
                        console.log(`    ${colors.cyan}Selector: ${node.target.join(', ')}${colors.reset}`);
                    });
                    if (violation.nodes.length > 3) {
                        console.log(`    ${colors.yellow}... and ${violation.nodes.length - 3} more${colors.reset}`);
                    }
                }
            });
        }

        console.log('');
    });

    // Print summary
    printHeader('Test Summary');
    console.log(`${colors.bold}Pages tested:${colors.reset} ${results.length}`);
    console.log(`${colors.bold}Total violations:${colors.reset} ${totalViolations}\n`);

    if (totalViolations > 0) {
        console.log(`  ${colors.red}${colors.bold}Critical:${colors.reset}  ${criticalCount}`);
        console.log(`  ${colors.red}${colors.bold}Serious:${colors.reset}   ${seriousCount}`);
        console.log(`  ${colors.yellow}${colors.bold}Moderate:${colors.reset}  ${moderateCount}`);
        console.log(`  ${colors.yellow}${colors.bold}Minor:${colors.reset}     ${minorCount}`);
    }

    return totalViolations;
}

// Main test function
async function runAccessibilityTests() {
    printHeader('WCAG 2.1 Accessibility Testing');

    printInfo(`Testing WCAG Level: ${CONFIG.wcagLevel}`);
    printInfo(`Base URL: ${CONFIG.baseUrl}`);
    printInfo(`Testing ${CONFIG.pages.length} page(s) with ${CONFIG.themes.length} theme(s)`);

    const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

    ensureOutputDir();

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        const results = [];

        // Test each page with each theme
        for (const pageConfig of CONFIG.pages) {
            // Test default (no theme override)
            const defaultResult = await testPage(browser, page, pageConfig.url, pageConfig.name, null);
            results.push(defaultResult);

            // Test each theme
            for (const theme of CONFIG.themes) {
                const themeResult = await testPage(browser, page, pageConfig.url, pageConfig.name, theme);
                results.push(themeResult);
            }
        }

        // Print console results
        const totalViolations = printResults(results, verbose);

        // Generate reports
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // JSON report
        const jsonPath = path.join(CONFIG.outputDir, `accessibility-report-${timestamp}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
        printSuccess(`JSON report saved: ${jsonPath}`);

        // HTML report
        const htmlReport = generateHtmlReport(results, new Date().toLocaleString());
        const htmlPath = path.join(CONFIG.outputDir, `accessibility-report-${timestamp}.html`);
        fs.writeFileSync(htmlPath, htmlReport);
        printSuccess(`HTML report saved: ${htmlPath}`);

        // Exit with error code if violations found
        if (totalViolations > 0) {
            printWarning(`\nTests completed with ${totalViolations} violation(s). Please review the reports.`);
            process.exit(1);
        } else {
            printSuccess('\nAll accessibility tests passed!');
            process.exit(0);
        }

    } catch (error) {
        printError(`Test execution failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

// Run tests
runAccessibilityTests();
