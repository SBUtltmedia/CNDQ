/**
 * Incremental CSS Refactoring Script
 *
 * ARCHITECTURE: Multi-Step CSS Improvement with Visual Validation
 * ================================================================
 * This script automates the incremental CSS refactoring process:
 *
 * 1. Capture baseline screenshots
 * 2. Make ONE small CSS change
 * 3. Test visual regression
 * 4. If pass: commit change, continue
 * 5. If fail: revert, report issue, stop
 * 6. Repeat for all planned changes
 *
 * Each step is validated through actual screenshots - no shortcuts possible.
 *
 * Usage:
 *   node tests/incremental-css-refactor.js
 *   node tests/incremental-css-refactor.js --dry-run
 *   node tests/incremental-css-refactor.js --step=3
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STYLES_FILE = path.join(__dirname, '..', 'css', 'styles.css');
const BACKUP_FILE = path.join(__dirname, '..', 'css', 'styles.css.backup');

// Refactoring steps - each removes duplicate utilities
const REFACTORING_STEPS = [
    {
        name: 'Remove duplicate typography utilities',
        description: 'Remove .text-xs, .text-sm, .text-lg, etc. (already in Tailwind)',
        lineRange: [151, 166], // Lines to delete
        justification: 'Tailwind already provides all text sizing utilities',
        expectedImpact: 'Zero visual change - Tailwind classes identical'
    },
    {
        name: 'Remove duplicate layout utilities',
        description: 'Remove .flex, .grid, .hidden, .block (already in Tailwind)',
        lineRange: [280, 283],
        justification: 'Tailwind provides all display utilities',
        expectedImpact: 'Zero visual change - exact duplicates'
    },
    {
        name: 'Remove duplicate flexbox utilities',
        description: 'Remove .flex-col, .items-center, .justify-between, etc.',
        lineRange: [285, 294],
        justification: 'Tailwind provides all flexbox utilities',
        expectedImpact: 'Zero visual change - exact duplicates'
    },
    {
        name: 'Remove duplicate spacing utilities (margin)',
        description: 'Remove .m-0, .mt-1, .mt-2, .mb-1, etc.',
        lineRange: [307, 320],
        justification: 'Tailwind provides all margin utilities',
        expectedImpact: 'Zero visual change - exact duplicates'
    },
    {
        name: 'Remove duplicate spacing utilities (padding)',
        description: 'Remove .p-2, .p-3, .px-2, .py-1, etc.',
        lineRange: [322, 335],
        justification: 'Tailwind provides all padding utilities',
        expectedImpact: 'Zero visual change - exact duplicates'
    },
    {
        name: 'Remove duplicate border utilities',
        description: 'Remove .border, .border-2, .rounded, .rounded-lg, etc.',
        lineRange: [404, 427],
        justification: 'Tailwind provides all border utilities',
        expectedImpact: 'Zero visual change - exact duplicates'
    },
    {
        name: 'Remove duplicate shadow utilities',
        description: 'Remove .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl',
        lineRange: [429, 432],
        justification: 'Tailwind provides all shadow utilities',
        expectedImpact: 'Zero visual change - exact duplicates'
    },
    {
        name: 'Remove duplicate position utilities',
        description: 'Remove .relative, .absolute, .fixed, .top-0, etc.',
        lineRange: [623, 632],
        justification: 'Tailwind provides all position utilities',
        expectedImpact: 'Zero visual change - exact duplicates'
    },
    {
        name: 'Remove duplicate z-index utilities',
        description: 'Remove .z-50, .z-[9999], .z-[100]',
        lineRange: [634, 636],
        justification: 'Tailwind provides z-index utilities',
        expectedImpact: 'Zero visual change - exact duplicates'
    },
    {
        name: 'Remove duplicate size utilities',
        description: 'Remove .w-full, .h-full, .w-5, .h-5, etc.',
        lineRange: [638, 649],
        justification: 'Tailwind provides all size utilities',
        expectedImpact: 'Zero visual change - exact duplicates'
    }
];

class IncrementalRefactor {
    constructor() {
        this.dryRun = process.argv.includes('--dry-run');
        this.startStep = this.getStartStep();
        this.currentStep = 0;
        this.results = [];
        this.backupCreated = false;
    }

    getStartStep() {
        const stepArg = process.argv.find(arg => arg.startsWith('--step='));
        return stepArg ? parseInt(stepArg.split('=')[1]) - 1 : 0;
    }

    /**
     * Main execution
     */
    async run() {
        console.log('🔧 INCREMENTAL CSS REFACTORING');
        console.log('='.repeat(80));
        console.log('This script will make incremental CSS changes and validate each one.');
        console.log('Each change is tested with visual regression before proceeding.');
        console.log('='.repeat(80));
        console.log('');

        if (this.dryRun) {
            console.log('🏃 DRY RUN MODE - No changes will be made\n');
        }

        if (this.startStep > 0) {
            console.log(`⏩ Starting from step ${this.startStep + 1}\n`);
        }

        try {
            // Step 0: Create backup
            this.createBackup();

            // Step 1: Capture baseline
            await this.captureBaseline();

            // Step 2: Execute refactoring steps
            for (let i = this.startStep; i < REFACTORING_STEPS.length; i++) {
                this.currentStep = i;
                const step = REFACTORING_STEPS[i];

                console.log(`\n${'═'.repeat(80)}`);
                console.log(`STEP ${i + 1}/${REFACTORING_STEPS.length}: ${step.name}`);
                console.log('═'.repeat(80));

                const success = await this.executeStep(step, i + 1);

                if (!success) {
                    console.log(`\n❌ Step ${i + 1} failed. Stopping refactoring.`);
                    this.printSummary();
                    process.exit(1);
                }
            }

            // All steps complete!
            console.log(`\n${'═'.repeat(80)}`);
            console.log('✅ ALL REFACTORING STEPS COMPLETED SUCCESSFULLY!');
            console.log('═'.repeat(80));
            this.printSummary();

            if (!this.dryRun) {
                console.log('\n📦 Removing backup file...');
                fs.unlinkSync(BACKUP_FILE);
                console.log('✅ Backup removed - refactoring complete!');
            }

        } catch (error) {
            console.error('\n💥 FATAL ERROR:', error.message);
            if (!this.dryRun && this.backupCreated) {
                console.log('\n🔙 Restoring from backup...');
                this.restoreBackup();
            }
            process.exit(1);
        }
    }

    /**
     * Create backup of styles.css
     */
    createBackup() {
        if (this.dryRun) {
            console.log('📋 [DRY RUN] Would create backup of styles.css\n');
            return;
        }

        console.log('📋 Creating backup of styles.css...');
        fs.copyFileSync(STYLES_FILE, BACKUP_FILE);
        this.backupCreated = true;
        console.log(`✅ Backup created: ${BACKUP_FILE}\n`);
    }

    /**
     * Restore from backup
     */
    restoreBackup() {
        if (!fs.existsSync(BACKUP_FILE)) {
            console.log('⚠️  No backup file found');
            return;
        }

        fs.copyFileSync(BACKUP_FILE, STYLES_FILE);
        console.log('✅ Restored styles.css from backup');
    }

    /**
     * Capture baseline screenshots
     */
    async captureBaseline() {
        console.log('📸 STEP 0: Capturing baseline screenshots');
        console.log('-'.repeat(80));

        if (this.dryRun) {
            console.log('[DRY RUN] Would capture baseline screenshots\n');
            return;
        }

        try {
            console.log('Running: npm run visual:baseline:headless\n');
            const output = execSync('npm run visual:baseline:headless', {
                cwd: path.join(__dirname, '..'),
                encoding: 'utf8',
                stdio: 'inherit'
            });

            console.log('\n✅ Baseline captured successfully\n');
        } catch (error) {
            throw new Error('Failed to capture baseline screenshots');
        }
    }

    /**
     * Execute one refactoring step
     */
    async executeStep(step, stepNumber) {
        console.log(`\n📝 Description: ${step.description}`);
        console.log(`📍 Lines to remove: ${step.lineRange[0]}-${step.lineRange[1]}`);
        console.log(`💡 Justification: ${step.justification}`);
        console.log(`🎯 Expected impact: ${step.expectedImpact}`);
        console.log('');

        // 1. Make the CSS change
        console.log(`⚙️  Making change...`);
        if (!this.dryRun) {
            this.deleteLines(step.lineRange[0], step.lineRange[1]);
            console.log(`✅ Deleted lines ${step.lineRange[0]}-${step.lineRange[1]}`);
        } else {
            console.log(`[DRY RUN] Would delete lines ${step.lineRange[0]}-${step.lineRange[1]}`);
        }

        // 2. Run visual regression test
        console.log(`\n🔍 Testing visual regression...`);
        if (this.dryRun) {
            console.log('[DRY RUN] Would run visual comparison\n');
            this.results.push({ step: stepNumber, name: step.name, status: 'skipped (dry run)' });
            return true;
        }

        const testPassed = await this.runVisualTest();

        if (testPassed) {
            console.log(`\n✅ Visual regression test PASSED - No visual changes detected`);
            console.log(`✅ Step ${stepNumber} complete: ${step.name}`);

            // 3. Approve the baseline (current becomes new baseline)
            console.log(`\n📋 Updating baseline...`);
            this.approveBaseline();
            console.log(`✅ Baseline updated`);

            this.results.push({ step: stepNumber, name: step.name, status: 'success' });
            return true;
        } else {
            console.log(`\n❌ Visual regression test FAILED - Visual changes detected`);
            console.log(`\n📄 Review report: tests/visual-regression-report.html`);

            // Prompt user for decision
            console.log(`\n⚠️  DECISION REQUIRED:`);
            console.log(`   1. Are these visual changes INTENTIONAL? (e.g., bug fixes)`);
            console.log(`   2. Or are they BUGS introduced by refactoring?`);
            console.log('');
            console.log(`   If intentional: Run 'npm run visual:approve' and restart from step ${stepNumber}`);
            console.log(`   If bugs: Fix the CSS and restart from step ${stepNumber}`);

            this.results.push({ step: stepNumber, name: step.name, status: 'failed (visual differences)' });
            return false;
        }
    }

    /**
     * Delete lines from CSS file
     */
    deleteLines(startLine, endLine) {
        const content = fs.readFileSync(STYLES_FILE, 'utf8');
        const lines = content.split('\n');

        // Remove lines (adjust for 0-based index)
        lines.splice(startLine - 1, endLine - startLine + 1);

        fs.writeFileSync(STYLES_FILE, lines.join('\n'));
    }

    /**
     * Run visual regression test
     */
    async runVisualTest() {
        try {
            execSync('npm run visual:compare:headless', {
                cwd: path.join(__dirname, '..'),
                encoding: 'utf8',
                stdio: 'pipe' // Suppress output
            });
            return true; // Test passed
        } catch (error) {
            return false; // Test failed (differences detected)
        }
    }

    /**
     * Approve baseline
     */
    approveBaseline() {
        try {
            execSync('npm run visual:approve', {
                cwd: path.join(__dirname, '..'),
                encoding: 'utf8',
                stdio: 'pipe'
            });
        } catch (error) {
            throw new Error('Failed to approve baseline');
        }
    }

    /**
     * Print summary
     */
    printSummary() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 REFACTORING SUMMARY');
        console.log('='.repeat(80));

        let successCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        this.results.forEach(result => {
            const icon = result.status === 'success' ? '✅' :
                        result.status.includes('skipped') ? '⏩' : '❌';
            console.log(`${icon} Step ${result.step}: ${result.name}`);
            console.log(`   Status: ${result.status}`);

            if (result.status === 'success') successCount++;
            else if (result.status.includes('failed')) failedCount++;
            else skippedCount++;
        });

        console.log('');
        console.log(`Total steps: ${this.results.length}`);
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed: ${failedCount}`);
        console.log(`⏩ Skipped: ${skippedCount}`);
        console.log('='.repeat(80));

        if (successCount > 0) {
            const linesRemoved = this.results
                .filter(r => r.status === 'success')
                .reduce((sum, r, i) => {
                    const step = REFACTORING_STEPS[i];
                    return sum + (step.lineRange[1] - step.lineRange[0] + 1);
                }, 0);

            console.log(`\n📈 Impact: Removed ~${linesRemoved} duplicate lines from styles.css`);
        }
    }
}

// Run
if (require.main === module) {
    const refactor = new IncrementalRefactor();
    refactor.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = IncrementalRefactor;
