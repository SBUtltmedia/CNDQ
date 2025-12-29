const fs = require('fs');
const path = require('path');

// Find the most recent report file
const reportsDir = 'accessibility-reports';
const files = fs.readdirSync(reportsDir)
  .filter(f => f.startsWith('accessibility-report') && f.endsWith('.json'))
  .map(f => ({
    name: f,
    time: fs.statSync(path.join(reportsDir, f)).mtime.getTime()
  }))
  .sort((a, b) => b.time - a.time);

const latestReport = files[0].name;
console.log(`Analyzing: ${latestReport}\n`);

const report = JSON.parse(fs.readFileSync(path.join(reportsDir, latestReport), 'utf8'));
const results = Object.values(report);

const violations = results.flatMap(r => r.violations || []).filter(v => v.id === 'color-contrast');

const issues = [];
violations.forEach(v => {
  v.nodes.forEach(n => {
    const data = n.any[0]?.data;
    if (data) {
      issues.push({
        selector: n.target[0],
        fg: data.fgColor,
        bg: data.bgColor,
        ratio: data.contrastRatio,
        html: n.html.substring(0, 80)
      });
    }
  });
});

// Group by pattern
const grouped = {};
issues.forEach(issue => {
  const pattern = issue.selector
    .replace(/\[\d+\]/g, '[n]')
    .replace(/#[a-z0-9-]+/gi, '#ID')
    .replace(/\.[a-z0-9-]+/gi, '.CLASS');
  if (!grouped[pattern]) grouped[pattern] = [];
  grouped[pattern].push(issue);
});

console.log('Color Contrast Issues:\n');
Object.entries(grouped).slice(0, 15).forEach(([pattern, items]) => {
  const first = items[0];
  console.log(`${pattern} (${items.length}x)`);
  console.log(`  ${first.fg} on ${first.bg} = ${first.ratio}:1`);
  console.log(`  ${first.html}...`);
  console.log('');
});

console.log(`\nTotal: ${issues.length} violations in ${Object.keys(grouped).length} unique patterns`);
