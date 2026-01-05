# WCAG Accessibility Testing

This document describes how to run and maintain WCAG accessibility compliance tests for the CNDQ Marketplace application.

## Overview

The automated accessibility testing suite uses [axe-core](https://github.com/dequelabs/axe-core), the industry-standard accessibility testing engine, to verify WCAG 2.1 Level AA compliance. The tests are run using Puppeteer to simulate real browser environments.

## Quick Start

### Prerequisites

1. Ensure your local development server is running at `http://localhost:8080`
2. All dependencies are installed (`npm install` should have been run)

### Running Tests

```bash
# Run accessibility tests (summary output)
npm run test:a11y

# Run with detailed violation information
npm run test:a11y:verbose
```

## What Gets Tested

The test suite automatically checks:

- **Pages**: All HTML pages (index.html, admin.html)
- **Themes**: Tests each page with all three themes (dark, light, high-contrast)
- **WCAG Standards**:
  - WCAG 2.0 Level A
  - WCAG 2.0 Level AA
  - WCAG 2.1 Level A
  - WCAG 2.1 Level AA
  - WCAG 2.2 Level AA

### Tested Accessibility Rules

The automated tests check for common issues including:

- Missing alt text on images
- Insufficient color contrast
- Missing form labels
- Incorrect heading hierarchy
- Missing ARIA labels on interactive elements
- Keyboard navigation issues
- Invalid HTML structure
- Missing page language
- And 90+ other accessibility rules

## Understanding Results

### Console Output

The test script provides colored console output:

- **Green ✓**: Tests passed with no violations
- **Red ✗**: Violations found
- **Yellow ⚠**: Warnings or incomplete tests

### Violation Severity Levels

Violations are categorized by impact:

- **Critical**: Must fix immediately - prevents access for some users
- **Serious**: Should fix soon - major barriers to accessibility
- **Moderate**: Should fix - noticeable accessibility issues
- **Minor**: Nice to fix - minor accessibility improvements

### Report Files

After each test run, two report files are generated in `./accessibility-reports/`:

1. **JSON Report** (`accessibility-report-TIMESTAMP.json`)
   - Machine-readable format
   - Useful for CI/CD integration
   - Contains complete violation details

2. **HTML Report** (`accessibility-report-TIMESTAMP.html`)
   - Human-readable format
   - Open in any browser
   - Visual summary with:
     - Violation counts by severity
     - Detailed descriptions
     - Links to remediation guides
     - Affected HTML elements
     - WCAG criteria tags

## Interpreting Violations

Each violation in the report includes:

1. **Violation ID**: Unique identifier (e.g., `color-contrast`, `label`)
2. **Description**: What the issue is
3. **Impact Level**: How severe the issue is
4. **Help URL**: Link to detailed remediation guide
5. **Affected Elements**: HTML elements with the issue
6. **WCAG Tags**: Which WCAG criteria are violated

### Example Violation

```
[SERIOUS] color-contrast
Elements must have sufficient color contrast
Affected elements: 3
https://dequeuniversity.com/rules/axe/4.11/color-contrast

Element 1:
<button class="bg-gray-500 text-gray-300">Submit</button>
Selector: #main-content > button
```

**How to fix**: Increase the contrast ratio between text and background to at least 4.5:1 for normal text.

## Continuous Integration

### Exit Codes

The test script exits with different codes:

- `0`: All tests passed, no violations
- `1`: Violations found or test execution failed

This makes it easy to integrate into CI/CD pipelines.

### Example GitHub Actions Workflow

```yaml
name: Accessibility Tests

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm start &  # Start your dev server
      - run: sleep 5  # Wait for server
      - run: npm run test:a11y
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: accessibility-reports
          path: accessibility-reports/
```

## Configuration

You can customize the test configuration by editing `test_accessibility.js`:

```javascript
const CONFIG = {
    baseUrl: 'http://localhost:8080',  // Your local server URL
    pages: [                             // Pages to test
        { name: 'Main Page', url: '/index.html' },
        { name: 'Admin Page', url: '/admin.html' }
    ],
    wcagLevel: 'AA',                     // WCAG compliance level
    standards: [                         // Standards to test against
        'wcag2a', 'wcag2aa',
        'wcag21a', 'wcag21aa',
        'wcag22aa'
    ],
    outputDir: './accessibility-reports', // Report output directory
    themes: ['dark', 'light', 'high-contrast']  // Themes to test
};
```

## Common Issues and Fixes

### Color Contrast

**Problem**: Text doesn't have sufficient contrast against background

**Fix**: Use the browser DevTools or online tools to check contrast ratios. Aim for:
- 4.5:1 for normal text
- 3:1 for large text (18pt+ or 14pt+ bold)
- 3:1 for UI components and graphics

### Missing Alt Text

**Problem**: Images don't have `alt` attributes

**Fix**: Add descriptive alt text to all images:
```html
<img src="logo.png" alt="CNDQ Marketplace Logo">
```

For decorative images, use empty alt:
```html
<img src="decorative.png" alt="">
```

### Form Labels

**Problem**: Form inputs don't have associated labels

**Fix**: Use explicit labels:
```html
<label for="email">Email Address</label>
<input id="email" type="email" name="email">
```

Or use `aria-label`:
```html
<input type="email" name="email" aria-label="Email Address">
```

### Keyboard Navigation

**Problem**: Interactive elements can't be accessed via keyboard

**Fix**: Ensure all interactive elements are focusable:
```html
<!-- Bad -->
<div onclick="doSomething()">Click me</div>

<!-- Good -->
<button onclick="doSomething()">Click me</button>
```

## Beyond Automated Testing

Automated tests catch approximately 30-50% of accessibility issues. You should also:

1. **Manual Keyboard Testing**
   - Navigate entire app using only Tab, Enter, Escape, Arrow keys
   - Ensure focus indicators are visible
   - Verify logical tab order

2. **Screen Reader Testing**
   - Test with NVDA (Windows), JAWS (Windows), or VoiceOver (Mac)
   - Verify all content is announced correctly
   - Check that dynamic content updates are announced

3. **Real User Testing**
   - Test with actual users who use assistive technologies
   - Gather feedback on usability

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Getting Help

If you encounter violations you're not sure how to fix:

1. Click the help URL in the violation report
2. Search the [axe-core GitHub issues](https://github.com/dequelabs/axe-core/issues)
3. Review [WCAG techniques](https://www.w3.org/WAI/WCAG21/Techniques/)
4. Ask in accessibility communities (WebAIM forums, A11y Slack)

## Maintenance

Run accessibility tests:

- **Before every commit** - Catch issues early
- **During code review** - Verify PRs don't introduce issues
- **Before releases** - Ensure production code is accessible
- **After major UI changes** - Themes, layouts, components

Add this to your workflow and accessibility will become second nature!
