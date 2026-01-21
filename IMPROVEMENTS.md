# CNDQ Project Improvement Roadmap

This document outlines architectural and quality improvements to enhance developer experience, maintainability, and code quality.

## 1. 🧹 Immediate Housekeeping (High Impact, Low Risk)
**Goal:** Clean up the project root and organize artifacts.

*   **Action:** Create a `logs/` or `artifacts/` directory.
*   **Action:** Move temporary files (`api-call-log-*.json`, `screenshot-*.png`, `test_output.log`) to this directory.
*   **Action:** Update `.gitignore` to exclude these files but keep the directory structure.

## 2. 📚 Documentation (The "Welcome Mat")
**Goal:** Provide a standard entry point for new developers.

*   **Action:** Create a root `README.md`.
*   **Content:**
    *   Project Overview (What is CNDQ?)
    *   **Environment Note:** "Windows Users: Use Git Bash. Avoid WSL."
    *   Quick Start (Link to `SETUP.md`)
    *   Architecture Summary (Link to `topology.md`)
    *   Testing Guide (How to run `dual-playability-test.js`)

## 3. 🏗️ Refactoring & Modernization
**Goal:** Decouple the monolithic `marketplace.js` and improve build processes.

*   **Code Structure:**
    *   Break `js/marketplace.js` (~2800 lines) into:
        *   `services/NotificationService.js` (Toasts/Alerts)
        *   `services/StateManager.js` (Inventory, User, Prices)
        *   `services/PollingService.js` (Game loop)
        *   `components/ModalManager.js` (Dialogs)
        *   `MarketplaceApp.js` (Main Controller)
*   **Build System:**
    *   **Decision:** Maintain "No-Build" architecture (Runtime CDNs) to ensure code remains readable, hackable, and debuggable directly in the browser.
    *   **Optimization:** Focus on efficient Import Maps and browser caching strategies rather than compilation.

## 4. 🚫 Ad Blocker Compliance (Renaming "Ads" to "Listings")
**Goal:** Prevent ad blockers from hiding critical UI elements.

*   **Context:** See `docs/AD_BLOCKER_REFACTOR.md`.
*   **Action:** Rename all CSS selectors, IDs, and internal variables from `ad`/`advertisement` to `listing` or `trade`.
*   **Scope:** Frontend selectors (Immediate), Backend Logic (Follow-up), API Endpoints (Final).

## 5. 🛡️ Code Quality Checks
**Goal:** Automate style enforcement and catch errors early.

*   **Action:** Add **Prettier** and **ESLint** to `package.json`.
*   **Action:** Configure `.eslintrc` and `.prettierrc` to match existing style (mostly).
*   **Action:** Add pre-commit hooks (Husky) or CI checks.

## 5. 🧪 Testing Strategy
**Goal:** Ensure robust regression testing during refactoring.

*   **Strategy:** Use `tests/dual-playability-test.js` as the primary gatekeeper.
*   **Protocol:** Run tests *before* and *after* each refactoring step.
