#!/usr/bin/env node
/**
 * Fix Outdated Puppeteer Syntax
 *
 * Updates old Puppeteer headless syntax to modern format.
 * In Puppeteer v21+:
 *   headless: true → headless: true
 *   headless: false → headless: false (no change)
 *   headless: true → headless: true (no change)
 *
 * Usage:
 *   node tests/fix-puppeteer-syntax.js
 *   node tests/fix-puppeteer-syntax.js --dry-run  (preview changes)
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const TESTS_DIR = path.join(__dirname);

console.log('🔧 Fixing Outdated Puppeteer Syntax');
console.log('='.repeat(60));
console.log(`Directory: ${TESTS_DIR}`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'APPLY CHANGES'}`);
console.log('='.repeat(60));
console.log('');

/**
 * Find all .js files in tests directory
 */
function findTestFiles() {
    const files = [];

    function scanDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory() && entry.name !== 'node_modules') {
                scanDir(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                files.push(fullPath);
            }
        }
    }

    scanDir(TESTS_DIR);
    return files;
}

/**
 * Fix outdated syntax in a file
 */
function fixFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    let changes = [];

    // Pattern 1: headless: true → headless: true
    if (content.includes('headless: true') || content.includes("headless: true")) {
        newContent = newContent.replace(/headless:\s*["']new["']/g, 'headless: true');
        changes.push('headless: true → headless: true');
    }

    // Pattern 2: headless: true (deprecated) → headless: true
    if (content.includes('headless: true') || content.includes("headless: true")) {
        newContent = newContent.replace(/headless:\s*["']shell["']/g, 'headless: true');
        changes.push('headless: true → headless: true');
    }

    // Check for other potential issues
    if (content.includes('puppeteer.launch') && !content.includes('headless:')) {
        changes.push('⚠️  Note: Launch without headless option (will use new default)');
    }

    return { content: newContent, changes, hasChanges: newContent !== content };
}

/**
 * Main function
 */
function main() {
    const files = findTestFiles();
    console.log(`Found ${files.length} JavaScript files\n`);

    let totalFixed = 0;
    let totalChanges = 0;

    for (const file of files) {
        const relativePath = path.relative(TESTS_DIR, file);
        const { content, changes, hasChanges } = fixFile(file);

        if (hasChanges || changes.length > 0) {
            console.log(`📝 ${relativePath}`);

            if (changes.length > 0) {
                changes.forEach(change => {
                    console.log(`   ${change}`);
                    totalChanges++;
                });
            }

            if (hasChanges) {
                if (!DRY_RUN) {
                    fs.writeFileSync(file, content, 'utf8');
                    console.log(`   ✅ Updated`);
                } else {
                    console.log(`   ℹ️  Would update (dry run)`);
                }
                totalFixed++;
            }

            console.log('');
        }
    }

    console.log('='.repeat(60));
    console.log(`📊 Summary`);
    console.log('='.repeat(60));
    console.log(`Files checked: ${files.length}`);
    console.log(`Files ${DRY_RUN ? 'to update' : 'updated'}: ${totalFixed}`);
    console.log(`Total changes: ${totalChanges}`);
    console.log('='.repeat(60));

    if (DRY_RUN && totalFixed > 0) {
        console.log('\n💡 Run without --dry-run to apply changes:');
        console.log('   node tests/fix-puppeteer-syntax.js');
    } else if (!DRY_RUN && totalFixed > 0) {
        console.log('\n✅ All files updated successfully!');
    } else {
        console.log('\n✅ No changes needed - all files are up to date!');
    }
}

// Run
main();
