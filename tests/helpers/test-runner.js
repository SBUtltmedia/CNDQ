#!/usr/bin/env node
/**
 * Real-Time Puppeteer Test Runner
 *
 * Runs Puppeteer tests with real-time output streaming and proper signal handling.
 * Allows tests to be interrupted (Ctrl+C) while preserving all output up to that point.
 *
 * PERSISTENT LOGGING: All test output is automatically saved to puppeteer.out
 * in the CNDQ root directory (cleared each run). After interrupting a test, you
 * can refer to this file to see exactly what happened.
 *
 * Usage:
 *   node tests/helpers/test-runner.js tests/haggle-test.js
 *   node tests/helpers/test-runner.js tests/auto-advance-test.js --save-log
 *
 * Options:
 *   --save-log     Also save output to timestamped log file in tests/logs/
 *   --timestamp    Prefix each line with timestamp
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor(testFilePath, options = {}) {
        this.testFilePath = testFilePath;
        this.options = options;
        this.testProcess = null;
        this.logStream = null;
        this.persistentLogStream = null;
        this.startTime = Date.now();
    }

    async run() {
        const testName = path.basename(this.testFilePath, '.js');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const startDateTime = new Date().toLocaleString();

        // Setup persistent puppeteer.out in CNDQ root (cleared on each run)
        const projectRoot = path.resolve(__dirname, '../..');
        const persistentLogFile = path.join(projectRoot, 'puppeteer.out');
        this.persistentLogStream = fs.createWriteStream(persistentLogFile, { flags: 'w' }); // 'w' truncates file

        // Write session separator to persistent log
        const separator = '\n' + '='.repeat(80) + '\n';
        this.persistentLogStream.write(separator);
        this.persistentLogStream.write(`🧪 Test: ${testName}\n`);
        this.persistentLogStream.write(`📄 File: ${this.testFilePath}\n`);
        this.persistentLogStream.write(`⏰ Started: ${startDateTime}\n`);
        this.persistentLogStream.write(separator + '\n');

        console.log('='.repeat(80));
        console.log(`🧪 Running Test: ${testName}`);
        console.log(`📄 File: ${this.testFilePath}`);
        console.log(`⏰ Started: ${startDateTime}`);
        console.log(`📝 Logging to: puppeteer.out`);
        console.log('='.repeat(80));
        console.log();

        // Setup optional individual log file
        if (this.options.saveLog) {
            const logDir = path.join(path.dirname(this.testFilePath), '../tests/logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const logFile = path.join(logDir, `${testName}_${timestamp}.log`);
            this.logStream = fs.createWriteStream(logFile);
            console.log(`💾 Also saving to: ${logFile}\n`);
        }

        return new Promise((resolve, reject) => {
            // Spawn test process
            this.testProcess = spawn('node', [this.testFilePath], {
                stdio: ['inherit', 'pipe', 'pipe'],
                env: process.env
            });

            // Handle stdout
            this.testProcess.stdout.on('data', (data) => {
                this.handleOutput(data, 'stdout');
            });

            // Handle stderr
            this.testProcess.stderr.on('data', (data) => {
                this.handleOutput(data, 'stderr');
            });

            // Handle process exit
            this.testProcess.on('close', (code) => {
                const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
                const endTime = new Date().toLocaleString();

                const summary = [
                    '',
                    '='.repeat(80),
                    `⏱️  Duration: ${duration}s`,
                    `⏰ Ended: ${endTime}`,
                    code === 0 ? `✅ Test Passed: ${testName}` :
                    code === null ? `⚠️  Test Interrupted: ${testName}` :
                    `❌ Test Failed: ${testName} (exit code: ${code})`,
                    '='.repeat(80)
                ].join('\n');

                console.log(summary);

                // Write to persistent log
                if (this.persistentLogStream) {
                    this.persistentLogStream.write('\n' + summary + '\n\n');
                    this.persistentLogStream.end();
                }

                // Close optional individual log
                if (this.logStream) {
                    this.logStream.write('\n' + summary + '\n');
                    this.logStream.end();
                }

                if (code === 0 || code === null) {
                    resolve({ success: code === 0, interrupted: code === null });
                } else {
                    reject(new Error(`Test failed with exit code ${code}`));
                }
            });

            // Handle errors
            this.testProcess.on('error', (error) => {
                console.error(`\n❌ Failed to start test: ${error.message}`);
                if (this.persistentLogStream) {
                    this.persistentLogStream.write(`\n❌ Failed to start test: ${error.message}\n`);
                    this.persistentLogStream.end();
                }
                if (this.logStream) {
                    this.logStream.end();
                }
                reject(error);
            });

            // Handle Ctrl+C
            process.on('SIGINT', () => {
                const interruptMsg = '\n\n⚠️  Received interrupt signal (Ctrl+C)\n📊 Output preserved in puppeteer.out\n';
                console.log(interruptMsg);

                if (this.persistentLogStream) {
                    this.persistentLogStream.write(interruptMsg);
                }

                if (this.testProcess) {
                    this.testProcess.kill('SIGTERM');
                }

                // Give process time to clean up
                setTimeout(() => {
                    if (this.persistentLogStream) {
                        this.persistentLogStream.end();
                    }
                    if (this.logStream) {
                        this.logStream.end();
                    }
                    process.exit(130); // Standard exit code for SIGINT
                }, 1000);
            });
        });
    }

    handleOutput(data, stream) {
        const lines = data.toString().split('\n');

        lines.forEach(line => {
            if (line.trim() === '') return;

            let output = line;

            // Add timestamp if requested
            if (this.options.timestamp) {
                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                const ms = now.getMilliseconds().toString().padStart(3, '0');
                output = `[${timeStr}.${ms}] ${line}`;
            }

            // Output to console (with color for stderr)
            if (stream === 'stderr') {
                console.error('\x1b[31m' + output + '\x1b[0m'); // Red
            } else {
                console.log(output);
            }

            // ALWAYS write to persistent log (puppeteer.out)
            if (this.persistentLogStream) {
                this.persistentLogStream.write(output + '\n');
            }

            // Also save to optional individual log file
            if (this.logStream) {
                this.logStream.write(output + '\n');
            }
        });
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        console.log('Usage: node test-runner.js <test-file> [options]');
        console.log();
        console.log('Options:');
        console.log('  --save-log     Save output to timestamped log file');
        console.log('  --timestamp    Prefix each line with timestamp');
        console.log('  --help, -h     Show this help message');
        console.log();
        console.log('Examples:');
        console.log('  node test-runner.js tests/haggle-test.js');
        console.log('  node test-runner.js tests/auto-advance-test.js --save-log --timestamp');
        process.exit(0);
    }

    const testFilePath = args[0];
    const options = {
        saveLog: args.includes('--save-log'),
        timestamp: args.includes('--timestamp')
    };

    // Validate test file exists
    if (!fs.existsSync(testFilePath)) {
        console.error(`❌ Error: Test file not found: ${testFilePath}`);
        process.exit(1);
    }

    const runner = new TestRunner(testFilePath, options);

    runner.run()
        .then((result) => {
            process.exit(result.success ? 0 : 1);
        })
        .catch((error) => {
            console.error(`\n❌ Runner error: ${error.message}`);
            process.exit(1);
        });
}

module.exports = TestRunner;
