/**
 * Reporting Helper - Console output and formatting
 */

// ANSI color codes
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

class ReportingHelper {
    static printHeader(text) {
        console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(80)}`);
        console.log(`  ${text}`);
        console.log(`${'='.repeat(80)}${colors.reset}\n`);
    }

    static printSubHeader(text) {
        console.log(`\n${colors.bold}${colors.blue}${text}${colors.reset}`);
        console.log(`${'-'.repeat(80)}`);
    }

    static printSuccess(text) {
        console.log(`${colors.green}✓ ${text}${colors.reset}`);
    }

    static printError(text) {
        console.log(`${colors.red}✗ ${text}${colors.reset}`);
    }

    static printWarning(text) {
        console.log(`${colors.yellow}⚠ ${text}${colors.reset}`);
    }

    static printInfo(text) {
        console.log(`${colors.cyan}ℹ ${text}${colors.reset}`);
    }

    static printStep(stepNumber, text) {
        console.log(`\n${colors.bold}📋 Step ${stepNumber}: ${text}${colors.reset}`);
    }

    static printSection(emoji, text) {
        console.log(`\n${colors.bold}${emoji} ${text}${colors.reset}`);
    }

    static printLeaderboard(teams, session) {
        console.log(`\n${colors.bold}📊 Leaderboard - Session ${session}:${colors.reset}`);
        teams.forEach((team, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
            const funds = team.currentFunds.toFixed(2).padStart(10);
            const roi = team.roi >= 0 ? '+' : '';
            console.log(`   ${medal} #${rank} ${team.teamName.padEnd(20)} - $${funds} (${roi}${team.roi.toFixed(1)}%)`);
        });
    }

    static printSummary(title, items) {
        console.log(`\n${colors.bold}${colors.green}${title}${colors.reset}`);
        items.forEach(item => {
            console.log(`   ✓ ${item}`);
        });
    }

    static printSessionHeader(session, phase) {
        console.log(`\n${colors.bold}${colors.magenta}🎯 Session ${session} - ${phase.toUpperCase()}${colors.reset}`);
        console.log('─'.repeat(60));
    }

    static separator() {
        console.log('─'.repeat(60));
    }

    static doubleSeparator() {
        console.log('='.repeat(60));
    }
}

module.exports = ReportingHelper;
