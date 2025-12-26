# CNDQ Game Implementation - Current Architecture

## Executive Summary

The CNDQ (Deicer and Solvent) game has been implemented as a decentralized, "admin-less" market simulation. It focuses on the pedagogical goals of teaching Linear Programming (LP), shadow pricing, and non-zero-sum cooperation.

The game uses a **Continuous Production Loop** model. Instead of discrete rounds managed by an instructor, production occurs automatically and immediately whenever a team's inventory or funds change (e.g., after a trade). This allows for a fluid, real-time trading experience.

---

## Core Mechanics (Implemented)

### 1. Automatic Continuous Production
- **No Manual Controls:** Users do not manually produce drums. The system automatically calculates the profit-maximizing product mix using a Simplex-based LP solver.
- **Triggered Events:** Production runs automatically:
    1. Upon team initialization (new user login).
    2. After every successful trade (for both buyer and seller).
- **Logic:** The solver finds the optimal number of Deicer and Solvent drums to produce based on current C, N, D, and Q inventory.
- **Outcome:** Inventory is consumed according to recipe ratios, and the resulting profit is immediately added to the team's balance.

### 2. Financial & Performance Model
- **Initial Capital:** Every team starts with **$100,000** in cash.
- **Initial Inventory:** Teams receive a randomized starting inventory of C, N, D, and Q (500–1500 gallons each).
- **ROI Tracking:** Performance is measured by **Net Profit** (Current Balance - Initial Capital) and **ROI %**.
- **Realized Profit:** Production generates immediate revenue ($100 per Deicer drum, $60 per Solvent drum) added to the bank balance.

---

## Data Architecture (Decentralized Model)

The system uses a **Folder per User** model to ensure high concurrency without database lock contention.

### Path Structure: `data/users/{safe_email}/`
- **`data.json`**: Core team data (Inventory, Funds, Notifications, Initial Capital, Last Production results).
- **`offers.json`**: Sell offers created by this specific team.
- **`trades.json`**: A log of completed trades for this team.

### Shared Files:
- **`js/config.js`**: Centralized recipes and default values.
- **`productionLib.php`**: Shared logic for the LP solver and production execution.

---

## Market & Negotiation System

The market is effectively always in a **TRADING** state. 

### Trading Flow:
1.  **Seller Creates Offer:** Seller lists a chemical, quantity, and a **Reserve Price** (minimum they will accept).
2.  **Buyer Expresses Interest:** Buyer sees the offer and clicks "Express Interest".
3.  **Seller Sets Price:** Seller is notified and sets an initial starting price (must be $\ge$ reserve price).
4.  **Buyer Responds:** Buyer can **Accept** (trade executes) or **Reject**.
5.  **Counter-Offer:** If rejected, the Seller can counter with a **lower** price (must be $<$ previous and $\ge$ reserve).
6.  **Loop:** This continues until the trade is accepted or the offer is cancelled.

### Shadow Price Integration:
- **Real-Time Calculation:** Shadow prices are recalculated locally on the frontend whenever inventory changes.
- **Decision Support:** The UI explicitly guides users:
    - *Seller:* "Sell if Price $>$ Shadow Price."
    - *Buyer:* "Buy if Price $<$ Shadow Price."
- **Win-Win Verification:** Post-trade analysis confirms that both parties increased their total wealth if they followed shadow price logic.

---

## Real-Time Polling

The frontend uses a 3-second polling interval via `getMarketUpdates.php`.

**Aggregated Data:**
- Polls its own `data.json` for funds/inventory/notifications.
- Aggregates `offers.json` from **all** user folders to build the global market view.
- Filters and categorizes offers into "Available", "My Offers", and "Active Negotiations".

---

## File Locking & Atomicity

- **`flock()`**: All file operations use PHP's `flock()` to ensure atomic read-modify-write cycles.
- **Trade Atomicity:** `executeTrade()` in `fileHelpers.php` locks **both** the buyer and seller's `data.json` files (in alphabetical order to prevent deadlocks) to ensure funds and inventory are transferred as a single atomic unit.
- **Immediate Production:** Production is triggered *inside* the locked trade transaction, ensuring the team's balance always reflects their optimal output after a resource change.

---

## Key Files Summary

- **`userData.php`**: Handles user initialization and path management.
- **`productionLib.php`**: The LP Solver and inventory consumption logic.
- **`fileHelpers.php`**: Core file I/O, locking, and trade execution.
- **`getMarketUpdates.php`**: The polling hub that aggregates decentralized data.
- **`js/market.js` & `js/marketPolling.js`**: Frontend trading logic and real-time updates.
- **`js/solver.js`**: Frontend implementation of the LP solver for shadow price display.
- **`index.html`**: The main dashboard showing ROI, ROI %, and inventory levels.
- **`market.html`**: The trading dashboard with the negotiation interface.