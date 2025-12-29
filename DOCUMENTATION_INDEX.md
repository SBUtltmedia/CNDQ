# CNDQ Documentation Index

> **Last Updated**: December 29, 2024
>
> Comprehensive guide to all documentation files in the CNDQ project

---

## Quick Start

**New to CNDQ?** Start here:

1. 📖 [**README.md**](./README.md) - Main project overview and quick start
2. 🖥️ Platform-specific setup:
   - macOS: [**setup_mac_localdev.md**](./setup_mac_localdev.md)
   - Windows: [**LOCAL_SETUP.md**](./LOCAL_SETUP.md)
3. 🎮 [**Problem.md**](./Problem.md) - Understanding the game concept

---

## Core Documentation

### Essential Reading

| Document | Purpose | Audience |
|----------|---------|----------|
| [**README.md**](./README.md) | Project overview, architecture, quick start | Everyone |
| [**Problem.md**](./Problem.md) | Original game specification and pedagogical goals | Instructors, Developers |
| [**Problem_vs_dev.md**](./Problem_vs_dev.md) | Comparison of original vision vs. current implementation | Product Managers, Instructors |

### Setup Guides

| Document | Platform | Status |
|----------|----------|--------|
| [**setup_mac_localdev.md**](./setup_mac_localdev.md) | macOS + Laravel Valet | ✅ Current (PHP 8.5.1, Composer 2.9.2) |
| [**LOCAL_SETUP.md**](./LOCAL_SETUP.md) | Windows + Laravel Herd | ✅ Current |
| [**README_LOCALDEV.md**](./README_LOCALDEV.md) | General local development notes | 📝 Reference |

### Testing Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| [**tests/README.md**](./tests/README.md) | Testing framework overview (3 teams, 2 sessions) | ✅ Up-to-date |
| [**TEST_AUTOMATION.md**](./TEST_AUTOMATION.md) | Automated testing guide | ✅ Current |
| [**TESTING.md**](./TESTING.md) | Manual testing procedures | 📝 Reference |

---

## Technical Documentation

### Game Mechanics

| Document | Topic | Last Updated |
|----------|-------|--------------|
| [**SHADOW_PRICE_WORKFLOW.md**](./SHADOW_PRICE_WORKFLOW.md) | LP solver integration and shadow price calculation | Current |

### UI/UX

| Document | Topic | Last Updated |
|----------|-------|--------------|
| [**ACCESSIBILITY.md**](./ACCESSIBILITY.md) | WCAG 2.2 AA compliance details | Current |
| [**docs/color-theory-wcag-compliance-summary.md**](./docs/color-theory-wcag-compliance-summary.md) | Color contrast analysis | Current |
| [**docs/color-recommendations.md**](./docs/color-recommendations.md) | Color palette recommendations | Current |
| [**docs/toast-features.md**](./docs/toast-features.md) | Toast notification system | Current |

### Features

| Document | Topic | Last Updated |
|----------|-------|--------------|
| [**docs/duplicate-ad-prevention-implementation.md**](./docs/duplicate-ad-prevention-implementation.md) | Duplicate advertisement prevention | Current |

---

## Planning & Historical Documents

| Document | Purpose | Status |
|----------|---------|--------|
| [**PLAN.md**](./PLAN.md) | Development roadmap | 📝 Historical |
| [**SIMULATION_README.md**](./SIMULATION_README.md) | Simulation notes | 📝 Reference |
| [**geminiWeb.md**](./geminiWeb.md) | AI-assisted development notes | 📝 Reference |
| [**excel_report.md**](./excel_report.md) | Excel export feature | 📝 Reference |

---

## Test Documentation

| Document | Purpose |
|----------|---------|
| [**test/manual-duplicate-test.md**](./test/manual-duplicate-test.md) | Manual testing for duplicate ads |

---

## Documentation by Use Case

### I want to set up local development

**macOS**:
1. Read [**setup_mac_localdev.md**](./setup_mac_localdev.md)
2. Follow step-by-step Valet installation
3. Configure `.env` file for authentication

**Windows**:
1. Read [**LOCAL_SETUP.md**](./LOCAL_SETUP.md)
2. Install Laravel Herd
3. Configure `.env` file for authentication

### I want to understand the game

1. Read [**Problem.md**](./Problem.md) for original concept
2. Read [**README.md**](./README.md) for current implementation
3. Review [**Problem_vs_dev.md**](./Problem_vs_dev.md) to understand design decisions

### I want to run tests

1. Read [**tests/README.md**](./tests/README.md) for testing overview
2. Run `npm test` for all tests
3. See [**TEST_AUTOMATION.md**](./TEST_AUTOMATION.md) for advanced testing

### I want to understand shadow prices

1. Read [**SHADOW_PRICE_WORKFLOW.md**](./SHADOW_PRICE_WORKFLOW.md)
2. Review LP solver integration in `api/calculations/`
3. See game mechanics section in [**README.md**](./README.md)

### I want to ensure accessibility

1. Read [**ACCESSIBILITY.md**](./ACCESSIBILITY.md)
2. Review color compliance in [**docs/color-theory-wcag-compliance-summary.md**](./docs/color-theory-wcag-compliance-summary.md)
3. Run accessibility tests: `npm run test:a11y`

### I want to modify the UI

1. Review [**docs/color-recommendations.md**](./docs/color-recommendations.md) for color palette
2. Check [**ACCESSIBILITY.md**](./ACCESSIBILITY.md) for WCAG requirements
3. Update Web Components in `js/components/`

### I want to deploy to production

1. Read production deployment section in [**README.md**](./README.md)
2. Configure Apache + Shibboleth authentication
3. Set file permissions as documented

---

## Documentation Status

### ✅ Up-to-Date Documents

These documents reflect the current state of the project:

- **README.md** - Comprehensive project overview
- **setup_mac_localdev.md** - macOS Valet setup (PHP 8.5.1, Composer 2.9.2)
- **Problem_vs_dev.md** - Current implementation comparison
- **tests/README.md** - Testing framework (3 teams, 2 sessions)
- **SHADOW_PRICE_WORKFLOW.md** - LP solver integration
- **ACCESSIBILITY.md** - WCAG 2.2 AA compliance

### 📝 Reference Documents

These documents are older but still contain useful information:

- **PLAN.md** - Historical development planning
- **SIMULATION_README.md** - Older simulation notes
- **geminiWeb.md** - AI development notes
- **TESTING.md** - Manual testing procedures

### 🔄 Living Documents

These documents are frequently updated:

- **README.md** - As features are added
- **tests/README.md** - As tests are modified
- **ACCESSIBILITY.md** - As WCAG standards evolve

---

## Contributing to Documentation

### When to Update Documentation

Update documentation when:
- ✅ Adding new features
- ✅ Changing test configuration
- ✅ Modifying setup procedures
- ✅ Updating dependencies (PHP, Composer, npm packages)
- ✅ Changing API endpoints

### Documentation Standards

Follow these standards:
- ✅ Use Markdown format (GitHub-flavored)
- ✅ Include code examples with syntax highlighting
- ✅ Add "Last Updated" dates to technical documents
- ✅ Link between related documents
- ✅ Include both quick start AND detailed sections

### Checking Documentation

Before committing documentation updates:
```bash
# Check for broken internal links
grep -r "\[.*\](./" *.md

# Verify code blocks are properly formatted
grep -r "```" *.md | grep -v "```bash" | grep -v "```javascript"
```

---

## External Resources

### Technology Documentation

- [Laravel Valet](https://laravel.com/docs/valet) - Local development environment
- [Puppeteer](https://pptr.dev/) - Browser automation for testing
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/) - Accessibility standards

### Educational Resources

- Linear Programming textbooks for shadow price theory
- Game theory for understanding win-win negotiations
- Shibboleth SSO documentation for authentication

---

## Quick Reference

### File Paths

```
CNDQ/
├── README.md                           # Main documentation
├── setup_mac_localdev.md               # macOS setup
├── Problem.md                          # Original specification
├── Problem_vs_dev.md                   # Implementation comparison
├── tests/README.md                     # Testing guide
├── SHADOW_PRICE_WORKFLOW.md            # LP solver docs
├── ACCESSIBILITY.md                    # WCAG compliance
└── docs/                               # Additional technical docs
```

### Common Commands

```bash
# Setup
valet link cndq              # Link site with Valet (macOS)
cp .env.example .env         # Configure authentication

# Testing
npm test                     # Run all tests
npm run test:game            # Game simulation (3 teams, 2 sessions)
npm run test:a11y            # Accessibility tests

# Development
open http://cndq.test        # Open site in browser
valet restart                # Restart Valet services
```

---

## Need Help?

1. **Check documentation** - Start with [README.md](./README.md)
2. **Review setup guides** - Platform-specific instructions
3. **Run tests** - See [tests/README.md](./tests/README.md)
4. **Check issue tracker** - GitHub Issues
5. **Contact support** - cndq-support@stonybrook.edu

---

**Document Version**: 1.0
**Last Updated**: December 29, 2024
**Maintained By**: CNDQ Development Team
