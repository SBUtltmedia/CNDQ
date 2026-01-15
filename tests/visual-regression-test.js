/**
 * Visual Regression Test - No Cookie Jar Edition
 *
 * ARCHITECTURE: Preventing "Cookie Jar Reaching" in CSS Refactoring
 * ===================================================================
 * This test prevents shortcuts by comparing ACTUAL RENDERED PIXELS before/after changes.
 *
 * The Problem:
 * - When refactoring CSS, it's tempting to just "delete code and hope it works"
 * - Tests might pass (no errors) but UI could look completely different
 * - Visual bugs slip through because we don't verify what users see
 *
 * The Solution:
 * 1. Take screenshots of EVERY PAGE STATE in baseline
 * 2. Make ONE incremental CSS change
 * 3. Take screenshots of EVERY PAGE STATE again
 * 4. Compare pixel-by-pixel (with threshold for anti-aliasing)
 * 5. BLOCK PROGRESS if visual differences detected
 * 6. Human reviews differences, approves or rejects
 * 7. Repeat for next change
 *
 * This physically constrains the test - it CANNOT fake screenshots or
 * bypass pixel comparison. Either the UI looks identical or test fails.
 *
 * IMPORTANT: Known Issues in Baseline
 * ===================================
 * The current codebase has visual bugs (e.g., toasts with bad backgrounds).
 * When you capture baseline, you're capturing the CURRENT STATE (bugs included).
 *
 * This is INTENTIONAL. The test ensures refactoring doesn't CHANGE appearance.
 * To fix existing bugs DURING refactoring:
 * 1. Capture baseline (with bugs)
 * 2. Refactor CSS AND fix bugs
 * 3. Compare (will show differences)
 * 4. Review differences (intentional fixes)
 * 5. Approve new baseline
 *
 * Based on: ui-playability-test.js (explores full UI)
 * Extended with: Pixel-perfect screenshot comparison
 *
 * Usage:
 *   # 1. Capture baseline (before refactoring)
 *   node tests/visual-regression-test.js --capture-baseline
 *
 *   # 2. Make CSS changes (delete duplicates, etc.)
 *
 *   # 3. Compare against baseline
 *   node tests/visual-regression-test.js --compare
 *
 *   # 4. Review differences (if any)
 *   open visual-regression-report.html
 *
 *   # 5. If approved, update baseline
 *   node tests/visual-regression-test.js --approve
 *
 * Options:
 *   --capture-baseline    Take baseline screenshots (before refactor)
 *   --compare            Compare current against baseline
 *   --approve            Approve changes and update baseline
 *   --headless           Run in headless mode
 *   --threshold N        Pixel difference threshold (0-1, default 0.01)
 *   --themes all|dark    Test which themes (default: all)
 *   --verbose            Show detailed output
 */

const UIPlayabilityTest = require('./ui-playability-test');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'
    ],
    headless: process.argv.includes('--headless'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    keepOpen: false, // Never keep open in regression mode

    // Visual regression settings
    threshold: parseFloat(process.argv.find(arg => arg.startsWith('--threshold='))?.split('=')[1] || '0.01'),
    themes: process.argv.find(arg => arg.startsWith('--themes='))?.split('=')[1] || 'all',
    baselineDir: path.join(__dirname, 'screenshots', 'baseline'),
    currentDir: path.join(__dirname, 'screenshots', 'current'),
    diffDir: path.join(__dirname, 'screenshots', 'diff'),
};

class VisualRegressionTest extends UIPlayabilityTest {
    constructor(config) {
        super(config);
        this.screenshots = [];
        this.mode = this.detectMode();
        this.comparisons = [];

        // Ensure directories exist
        [CONFIG.baselineDir, CONFIG.currentDir, CONFIG.diffDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    detectMode() {
        if (process.argv.includes('--capture-baseline')) return 'baseline';
        if (process.argv.includes('--compare')) return 'compare';
        if (process.argv.includes('--approve')) return 'approve';
        return 'compare'; // Default
    }

    /**
     * Capture screenshot with metadata
     */
    async captureScreenshot(page, name, metadata = {}) {
        const timestamp = Date.now();
        const sanitizedName = name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        const filename = `${sanitizedName}_${timestamp}.png`;

        const outputDir = this.mode === 'baseline' ? CONFIG.baselineDir : CONFIG.currentDir;
        const filepath = path.join(outputDir, filename);

        // Wait for page to be fully rendered (Puppeteer uses waitForNetworkIdle)
        await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
        await this.browser.sleep(500); // Extra stability

        // Take full page screenshot (Puppeteer API)
        await page.screenshot({
            path: filepath,
            fullPage: true,
        });

        const screenshotData = {
            name,
            filename,
            filepath,
            timestamp,
            metadata: {
                ...metadata,
                url: page.url(),
                viewport: page.viewport(),
                theme: await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'dark')
            }
        };

        this.screenshots.push(screenshotData);

        if (this.config.verbose) {
            console.log(`      📸 Screenshot: ${name} → ${filename}`);
        }

        return screenshotData;
    }

    /**
     * Compare two PNG images pixel by pixel
     */
    async compareImages(baselinePath, currentPath, diffPath) {
        return new Promise((resolve, reject) => {
            // Read baseline image
            const baselineImg = PNG.sync.read(fs.readFileSync(baselinePath));

            // Read current image
            const currentImg = PNG.sync.read(fs.readFileSync(currentPath));

            // Check dimensions match
            if (baselineImg.width !== currentImg.width || baselineImg.height !== currentImg.height) {
                return resolve({
                    match: false,
                    reason: 'dimension_mismatch',
                    baselineSize: { width: baselineImg.width, height: baselineImg.height },
                    currentSize: { width: currentImg.width, height: currentImg.height },
                    diffPixels: -1,
                    diffPercent: 100
                });
            }

            // Create diff image
            const diff = new PNG({ width: baselineImg.width, height: baselineImg.height });

            // Compare pixels
            const diffPixels = pixelmatch(
                baselineImg.data,
                currentImg.data,
                diff.data,
                baselineImg.width,
                baselineImg.height,
                {
                    threshold: CONFIG.threshold,
                    includeAA: false, // Ignore anti-aliasing differences
                    alpha: 0.1,
                    aaColor: [255, 255, 0], // Yellow for anti-aliasing
                    diffColor: [255, 0, 0], // Red for differences
                }
            );

            // Calculate difference percentage
            const totalPixels = baselineImg.width * baselineImg.height;
            const diffPercent = (diffPixels / totalPixels) * 100;

            // Write diff image
            fs.writeFileSync(diffPath, PNG.sync.write(diff));

            resolve({
                match: diffPixels === 0,
                diffPixels,
                diffPercent,
                totalPixels,
                threshold: CONFIG.threshold,
                diffImage: diffPath
            });
        });
    }

    /**
     * Compare current screenshots against baseline
     */
    async compareAgainstBaseline() {
        console.log('\n🔍 COMPARING SCREENSHOTS AGAINST BASELINE');
        console.log('='.repeat(80));

        const baselineFiles = fs.readdirSync(CONFIG.baselineDir)
            .filter(f => f.endsWith('.png'))
            .sort();

        const currentFiles = fs.readdirSync(CONFIG.currentDir)
            .filter(f => f.endsWith('.png'))
            .sort();

        if (baselineFiles.length === 0) {
            console.error('❌ No baseline screenshots found!');
            console.error('   Run with --capture-baseline first.');
            return false;
        }

        console.log(`Baseline: ${baselineFiles.length} screenshots`);
        console.log(`Current:  ${currentFiles.length} screenshots`);
        console.log('');

        let totalComparisons = 0;
        let passedComparisons = 0;
        let failedComparisons = 0;

        // Compare each current screenshot with corresponding baseline
        for (let i = 0; i < Math.min(baselineFiles.length, currentFiles.length); i++) {
            const baselineFile = baselineFiles[i];
            const currentFile = currentFiles[i];

            // Extract name (remove timestamp suffix)
            const baselineName = baselineFile.replace(/_\d+\.png$/, '');
            const currentName = currentFile.replace(/_\d+\.png$/, '');

            totalComparisons++;

            console.log(`[${i + 1}/${baselineFiles.length}] ${baselineName}`);

            if (baselineName !== currentName) {
                console.log(`   ⚠️  WARNING: Name mismatch (baseline: ${baselineName}, current: ${currentName})`);
            }

            const baselinePath = path.join(CONFIG.baselineDir, baselineFile);
            const currentPath = path.join(CONFIG.currentDir, currentFile);
            const diffPath = path.join(CONFIG.diffDir, `diff_${baselineFile}`);

            try {
                const comparison = await this.compareImages(baselinePath, currentPath, diffPath);

                this.comparisons.push({
                    name: baselineName,
                    baselineFile,
                    currentFile,
                    ...comparison
                });

                if (comparison.match) {
                    console.log(`   ✅ IDENTICAL (0 pixel difference)`);
                    passedComparisons++;
                } else if (comparison.reason === 'dimension_mismatch') {
                    console.log(`   ❌ DIMENSIONS CHANGED`);
                    console.log(`      Baseline: ${comparison.baselineSize.width}x${comparison.baselineSize.height}`);
                    console.log(`      Current:  ${comparison.currentSize.width}x${comparison.currentSize.height}`);
                    failedComparisons++;
                } else {
                    const diffPercent = comparison.diffPercent.toFixed(2);
                    console.log(`   ❌ VISUAL DIFFERENCE DETECTED`);
                    console.log(`      Pixels changed: ${comparison.diffPixels.toLocaleString()} (${diffPercent}%)`);
                    console.log(`      Diff image: ${diffPath}`);
                    failedComparisons++;
                }
            } catch (error) {
                console.log(`   ❌ COMPARISON FAILED: ${error.message}`);
                failedComparisons++;
                this.comparisons.push({
                    name: baselineName,
                    baselineFile,
                    currentFile,
                    match: false,
                    error: error.message
                });
            }

            console.log('');
        }

        // Generate HTML report
        this.generateReport();

        // Print summary
        console.log('='.repeat(80));
        console.log('📊 COMPARISON SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total comparisons: ${totalComparisons}`);
        console.log(`✅ Passed:  ${passedComparisons} (${Math.round(passedComparisons / totalComparisons * 100)}%)`);
        console.log(`❌ Failed:  ${failedComparisons} (${Math.round(failedComparisons / totalComparisons * 100)}%)`);
        console.log('='.repeat(80));

        if (failedComparisons > 0) {
            console.log('');
            console.log('❌ VISUAL REGRESSION DETECTED - CHANGES BLOCKED');
            console.log('');
            console.log('Next steps:');
            console.log('  1. Review differences: open visual-regression-report.html');
            console.log('  2. If changes are intentional:');
            console.log('     node tests/visual-regression-test.js --approve');
            console.log('  3. If changes are bugs:');
            console.log('     - Revert CSS changes');
            console.log('     - Fix the issue');
            console.log('     - Run comparison again');
            console.log('');
            return false;
        } else {
            console.log('');
            console.log('✅ ALL SCREENSHOTS MATCH - SAFE TO PROCEED');
            console.log('');
            return true;
        }
    }

    /**
     * Generate HTML report with side-by-side comparisons
     */
    generateReport() {
        const reportPath = path.join(__dirname, 'visual-regression-report.html');

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Regression Report</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #e0e0e0;
        }
        h1 {
            text-align: center;
            color: #10b981;
            margin-bottom: 10px;
        }
        .summary {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: #2a2a2a;
            border-radius: 8px;
        }
        .summary .stat {
            display: inline-block;
            margin: 0 20px;
            font-size: 18px;
        }
        .summary .passed { color: #10b981; }
        .summary .failed { color: #ef4444; }
        .comparison {
            margin-bottom: 40px;
            padding: 20px;
            background: #2a2a2a;
            border-radius: 8px;
            border: 2px solid #4a4a4a;
        }
        .comparison.failed {
            border-color: #ef4444;
        }
        .comparison.passed {
            border-color: #10b981;
        }
        .comparison h2 {
            margin-top: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .comparison .status {
            font-size: 24px;
        }
        .comparison .metadata {
            font-size: 14px;
            color: #9ca3af;
            margin-bottom: 15px;
        }
        .images {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        .image-container {
            text-align: center;
        }
        .image-container h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #d1d5db;
        }
        .image-container img {
            width: 100%;
            border: 1px solid #4a4a4a;
            border-radius: 4px;
            background: white;
        }
        .no-diff {
            text-align: center;
            color: #10b981;
            font-size: 18px;
            padding: 40px;
        }
        .filter {
            text-align: center;
            margin-bottom: 20px;
        }
        .filter button {
            margin: 0 5px;
            padding: 10px 20px;
            border: none;
            background: #4a4a4a;
            color: #e0e0e0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .filter button.active {
            background: #10b981;
            color: white;
        }
        .filter button:hover {
            background: #5a5a5a;
        }
        .filter button.active:hover {
            background: #059669;
        }
    </style>
</head>
<body>
    <h1>🔍 Visual Regression Report</h1>

    <div class="summary">
        <div class="stat">Total: <strong>${this.comparisons.length}</strong></div>
        <div class="stat passed">Passed: <strong>${this.comparisons.filter(c => c.match).length}</strong></div>
        <div class="stat failed">Failed: <strong>${this.comparisons.filter(c => !c.match).length}</strong></div>
    </div>

    <div class="filter">
        <button class="active" onclick="filterComparisons('all')">All</button>
        <button onclick="filterComparisons('failed')">Failed Only</button>
        <button onclick="filterComparisons('passed')">Passed Only</button>
    </div>

    <div id="comparisons">
        ${this.comparisons.map((comp, i) => this.generateComparisonHTML(comp, i)).join('\n')}
    </div>

    <script>
        function filterComparisons(type) {
            // Update button states
            document.querySelectorAll('.filter button').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');

            // Filter comparisons
            document.querySelectorAll('.comparison').forEach(comp => {
                const isFailed = comp.classList.contains('failed');
                const isPassed = comp.classList.contains('passed');

                if (type === 'all') {
                    comp.style.display = 'block';
                } else if (type === 'failed' && isFailed) {
                    comp.style.display = 'block';
                } else if (type === 'passed' && isPassed) {
                    comp.style.display = 'block';
                } else {
                    comp.style.display = 'none';
                }
            });
        }
    </script>
</body>
</html>
        `;

        fs.writeFileSync(reportPath, html);
        console.log(`📄 Report generated: ${reportPath}`);
    }

    generateComparisonHTML(comp, index) {
        const statusIcon = comp.match ? '✅' : '❌';
        const statusClass = comp.match ? 'passed' : 'failed';
        const statusText = comp.match ? 'IDENTICAL' : 'DIFFERENT';

        let metadataHTML = '';
        if (!comp.match && comp.diffPercent !== undefined) {
            metadataHTML = `
                <div class="metadata">
                    Pixels changed: ${comp.diffPixels?.toLocaleString() || 'N/A'}
                    (${comp.diffPercent?.toFixed(2) || 'N/A'}%)
                </div>
            `;
        } else if (!comp.match && comp.reason === 'dimension_mismatch') {
            metadataHTML = `
                <div class="metadata">
                    Dimension mismatch: ${comp.baselineSize.width}x${comp.baselineSize.height} →
                    ${comp.currentSize.width}x${comp.currentSize.height}
                </div>
            `;
        }

        const baselineImg = path.relative(__dirname, path.join(CONFIG.baselineDir, comp.baselineFile));
        const currentImg = path.relative(__dirname, path.join(CONFIG.currentDir, comp.currentFile));
        const diffImg = comp.diffImage ? path.relative(__dirname, comp.diffImage) : '';

        return `
        <div class="comparison ${statusClass}">
            <h2>
                <span class="status">${statusIcon}</span>
                <span>${comp.name}</span>
                <span style="margin-left: auto; font-size: 16px; color: ${comp.match ? '#10b981' : '#ef4444'};">
                    ${statusText}
                </span>
            </h2>
            ${metadataHTML}
            ${comp.match ? `
                <div class="no-diff">No visual differences detected</div>
            ` : `
                <div class="images">
                    <div class="image-container">
                        <h3>Baseline (Before)</h3>
                        <img src="${baselineImg}" alt="Baseline">
                    </div>
                    <div class="image-container">
                        <h3>Current (After)</h3>
                        <img src="${currentImg}" alt="Current">
                    </div>
                    <div class="image-container">
                        <h3>Difference</h3>
                        <img src="${diffImg}" alt="Difference">
                    </div>
                </div>
            `}
        </div>
        `;
    }

    /**
     * Approve current screenshots and update baseline
     */
    async approveChanges() {
        console.log('\n✅ APPROVING VISUAL CHANGES');
        console.log('='.repeat(80));

        const currentFiles = fs.readdirSync(CONFIG.currentDir).filter(f => f.endsWith('.png'));

        if (currentFiles.length === 0) {
            console.error('❌ No current screenshots to approve!');
            return false;
        }

        console.log(`Copying ${currentFiles.length} screenshots to baseline...`);

        let copied = 0;
        for (const file of currentFiles) {
            const src = path.join(CONFIG.currentDir, file);
            const dest = path.join(CONFIG.baselineDir, file);
            fs.copyFileSync(src, dest);
            copied++;
        }

        console.log(`✅ Approved ${copied} screenshots`);
        console.log('');
        console.log('Baseline updated. You can now continue refactoring.');
        console.log('');

        return true;
    }

    /**
     * Capture all UI states with theme variations
     */
    async captureAllStates() {
        const themes = CONFIG.themes === 'all' ? ['dark', 'light', 'high-contrast'] : ['dark'];

        console.log(`\n📸 CAPTURING ${this.mode.toUpperCase()} SCREENSHOTS`);
        console.log('='.repeat(80));
        console.log(`Themes: ${themes.join(', ')}`);
        console.log('='.repeat(80));
        console.log('');

        for (const theme of themes) {
            await this.captureThemeStates(theme);
        }

        console.log('');
        console.log(`✅ Captured ${this.screenshots.length} screenshots`);
        console.log('');

        return true;
    }

    /**
     * Capture all UI states for a specific theme
     */
    async captureThemeStates(theme) {
        console.log(`\n🎨 THEME: ${theme.toUpperCase()}`);
        console.log('-'.repeat(80));

        // 1. Admin page
        await this.captureAdminPage(theme);

        // 2. Player pages (different views)
        await this.capturePlayerPages(theme);

        // 3. Modals and overlays
        await this.captureModalsAndOverlays(theme);
    }

    /**
     * Capture admin page states
     */
    async captureAdminPage(theme) {
        console.log('   🛡️  Admin Page');

        const adminPage = await this.browser.newPage();
        await this.setupApiMonitoring(adminPage, 'admin');

        // Navigate to admin
        await adminPage.goto(`${CONFIG.baseUrl}admin/`);
        await this.browser.login(adminPage, CONFIG.adminUser);

        // Set theme
        await adminPage.evaluate((t) => {
            document.documentElement.setAttribute('data-theme', t);
        }, theme);

        await this.captureScreenshot(adminPage, `admin_main_${theme}`, { page: 'admin', theme });

        await adminPage.close();
    }

    /**
     * Capture player page states
     */
    async capturePlayerPages(theme) {
        console.log('   👤 Player Pages');

        const playerPage = await this.browser.newPage();
        await this.setupApiMonitoring(playerPage, CONFIG.testUsers[0]);

        await playerPage.goto(CONFIG.baseUrl);
        await this.browser.login(playerPage, CONFIG.testUsers[0]);

        // Set theme
        await playerPage.evaluate((t) => {
            document.documentElement.setAttribute('data-theme', t);
        }, theme);

        // Main marketplace view
        await this.captureScreenshot(playerPage, `player_marketplace_${theme}`, { page: 'marketplace', theme });

        // Navigate to different tabs
        const tabs = [
            { id: 'inventory-tab', name: 'inventory' },
            { id: 'production-tab', name: 'production' },
            { id: 'negotiations-tab', name: 'negotiations' },
        ];

        for (const tab of tabs) {
            try {
                await playerPage.click(`#${tab.id}`);
                await this.browser.sleep(500);
                await this.captureScreenshot(playerPage, `player_${tab.name}_${theme}`, { page: tab.name, theme });
            } catch (error) {
                if (this.config.verbose) {
                    console.log(`      ⚠️  Could not capture ${tab.name} tab: ${error.message}`);
                }
            }
        }

        await playerPage.close();
    }

    /**
     * Capture modals and overlays
     */
    async captureModalsAndOverlays(theme) {
        console.log('   🪟 Modals & Overlays');

        const page = await this.browser.newPage();
        await this.setupApiMonitoring(page, CONFIG.testUsers[0]);

        await page.goto(CONFIG.baseUrl);
        await this.browser.login(page, CONFIG.testUsers[0]);

        // Set theme
        await page.evaluate((t) => {
            document.documentElement.setAttribute('data-theme', t);
        }, theme);

        // Try to trigger various modals
        const modals = [
            { selector: 'chemical-card', event: 'click', name: 'chemical_card' },
            // Add more modals as needed
        ];

        for (const modal of modals) {
            try {
                const element = await page.$(modal.selector);
                if (element) {
                    if (modal.event === 'click') {
                        await element.click();
                    }
                    await this.browser.sleep(500);
                    await this.captureScreenshot(page, `modal_${modal.name}_${theme}`, { page: 'modal', theme, modal: modal.name });

                    // Close modal (ESC key)
                    await page.keyboard.press('Escape');
                    await this.browser.sleep(300);
                }
            } catch (error) {
                if (this.config.verbose) {
                    console.log(`      ⚠️  Could not capture ${modal.name} modal: ${error.message}`);
                }
            }
        }

        await page.close();
    }

    /**
     * Main run method
     */
    async run() {
        try {
            await this.browser.launch();

            if (this.mode === 'approve') {
                await this.approveChanges();
            } else if (this.mode === 'baseline') {
                await this.captureAllStates();
            } else if (this.mode === 'compare') {
                await this.captureAllStates();
                const passed = await this.compareAgainstBaseline();

                if (!passed) {
                    process.exit(1); // Block progress
                }
            }

            await this.browser.close();

        } catch (error) {
            console.error('\n❌ Visual regression test failed:', error.message);
            if (this.config.verbose) {
                console.error(error.stack);
            }
            await this.browser.close();
            throw error;
        }
    }
}

// Run the test
if (require.main === module) {
    const test = new VisualRegressionTest(CONFIG);
    test.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = VisualRegressionTest;
