const fs = require('fs');
const report = JSON.parse(fs.readFileSync('accessibility-reports/accessibility-report-2025-12-29T19-59-36-981Z.json', 'utf8'));

const violations = report.results
  .flatMap(r => r.violations)
  .filter(v => v.id === 'color-contrast');

console.log('Color Contrast Violations:\n');

const issues = [];
violations.forEach(v => {
  v.nodes.forEach(n => {
    const selector = n.target[0];
    const data = n.any[0]?.data;
    if (data) {
      issues.push({
        selector,
        fg: data.fgColor,
        bg: data.bgColor,
        ratio: data.contrastRatio,
        html: n.html.substring(0, 100)
      });
    }
  });
});

// Group by selector pattern
const grouped = {};
issues.forEach(issue => {
  const pattern = issue.selector.replace(/\[\d+\]/g, '[n]');
  if (!grouped[pattern]) {
    grouped[pattern] = [];
  }
  grouped[pattern].push(issue);
});

Object.entries(grouped).slice(0, 15).forEach(([pattern, items]) => {
  const first = items[0];
  console.log(`${pattern} (${items.length} elements)`);
  console.log(`  FG: ${first.fg}, BG: ${first.bg}, Ratio: ${first.ratio}`);
  console.log(`  HTML: ${first.html}`);
  console.log('');
});

console.log(`\nTotal violations: ${issues.length}`);
console.log(`Unique patterns: ${Object.keys(grouped).length}`);
