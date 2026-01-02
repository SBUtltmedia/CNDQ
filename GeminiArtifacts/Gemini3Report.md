# CNDQ Project Report (Gemini 3)

## Executive Summary
The CNDQ simulation game is a robust educational tool for teaching Linear Programming (LP) and Shadow Prices through a competitive chemical trading market. The project has recently transitioned to a "No-M" (No-Model/Filesystem-as-State) architecture, which provides high auditability but introduces significant scalability and concurrency risks, especially for the target audience of ~100 concurrent players.

## Core Findings

### 1. Architectural Assessment: "No-M" (Filesystem-as-State)
The system stores team state as a series of event-sourced JSON files in `data/teams/{email}/`.
- **Pros:** Full audit log of every transaction, no database setup required, easy to debug by inspecting files.
- **Cons:** Extremely high I/O overhead. Every state read requires aggregating all historical event files for a team.
- **Scalability Risk:** For 100 players, the server will experience I/O saturation due to constant polling and event aggregation.

## Adherence to "No-M Architecture Philosophy"

An analysis of the codebase against the `Philosophy.md` document reveals several deviations from the core "No-M" principles:

### 1. Violation of Atomic Isolation (Cross-Namespace Writes)
**Philosophy:** "Write-conflicts are physically impossible because users only ever write to their own isolated namespaces."
**Implementation:** `TradeExecutor::executeTrade()` writes directly into both the seller's and the buyer's folders. 
- **Risk:** This breaks the "sovereignty" of the user directory. A bug in the buyer's session could theoretically corrupt the seller's data during a write.
- **Correction:** Actions should only emit an event to the *acting* user's directory. A background "System Aggregator" or a "Marketplace Watcher" should detect these events and emit corresponding "reflected" events to the counterparty.

### 2. Monolithic Shared State (Legacy Artifacts)
**Philosophy:** "Every user is a directory; every data point is a file."
**Implementation:** The system still relies on global monolithic files like `data/session_state.json`, `data/npc_config.json`, and `data/advertisements.json`.
- **Risk:** These files require `flock()` to prevent corruption, which is the exact "overhead of RDBMS management" the philosophy aims to avoid.
- **Correction:** The "System" should be treated as a special user directory (e.g., `data/teams/system/`) where session changes are emitted as events.

### 3. Non-Atomic Fund Updates
**Philosophy:** "Event Sourcing... provides a natural audit log and state recovery."
**Implementation:** `TeamStorage::updateFunds()` and `set_funds` events currently store the *absolute result* of a calculation (`amount => 10500`) rather than the *delta* (`change => +500`).
- **Risk:** If two events are emitted before the aggregator runs, the second "absolute" event will overwrite the first, losing data.
- **Correction:** Use `adjust_funds` events (like `adjust_chemical`) to ensure mathematical consistency across concurrent events.

### 4. Aggregation Overhead ($O(N)$ Scanning)
**Philosophy:** "PHP glob() / scandir() | Query Engine"
**Implementation:** `MarketplaceAggregator::getAllTeams()` and `getActiveOffers()` perform a full scan of every directory in `data/teams/` on every request.
- **Risk:** With 100 players, a single marketplace load performs hundreds of `scandir` and `file_exists` calls. This will cause significant disk I/O wait times.
- **Correction:** Implement a "Marketplace Snapshot" or use a shared "Event Log" directory where all public-facing events (like `add_ad`) are symlinked or duplicated for fast global querying.

## Critical Bug Reports

#### A. Race Condition in Fund/Profile Updates
In `TeamStorage.php`, methods like `updateFunds` and `updateProfile` read the state, calculate a new value in memory, and then emit a "set" event.
- **Problem:** If two trades execute simultaneously for the same user, one will overwrite the other's funds update because they both read the same "initial" state.
- **Impact:** Loss of virtual currency for students, leading to frustration and inaccurate results.
- **Fix:** Transition to relative delta events (e.g., `adjust_funds`) that the Aggregator sums up, similar to how `adjust_chemical` works.

#### B. NPC Execution Bottleneck
The `SessionManager` triggers NPC trading cycles inside the `getState()` method, which is called by every user's polling request (~every 3 seconds).
- **Problem:** If 100 players are online, the NPC logic runs 100 times every 10 seconds.
- **Impact:** Massive server load and potential race conditions in NPC decision-making.
- **Fix:** Offload NPC execution to a single background process or a dedicated admin-triggered hook.

#### C. $O(N^2)$ State Aggregation
The `NoM\Aggregator` reads all `event_*.json` files in a team's directory to build the state.
- **Problem:** As a team makes more trades, the number of files increases. By session 10, a team might have 200+ events. Reading 200 files for every poll request is unsustainable.
- **Fix:** Implement periodic "snapshots" that collapse historical events into a single baseline file.

### 3. Suggestions for Improvements

#### Gameplay & UX
- **Shadow Price Visualizer:** The current UI shows shadow prices but doesn't explain *why* they changed. A "Shadow Price History" sparkline would help students see the impact of their trades on their internal valuations.
- **Hot/Cold Trade Feedback:** The "Hot Trade" (mutually beneficial) notification is a great feature. This should be expanded into a post-session "Cooperation Score" to reinforce the non-zero-sum game lesson.
- **Simplified Marketplace:** Confirming that "Sell requests" are unneeded was a good move. The current "Buy Request" + "Offer to Sell" flow is more focused and mirrors real-world procurement.

#### Technical Debt & Performance
- **Transition to SQLite:** For 100 players, a single SQLite database would be significantly faster than thousands of JSON files while remaining "serverless" and portable.
- **WebSockets:** Replace 3-second polling with WebSockets (e.g., via a small Node.js sidecar or PHP library) to reduce server load by 90%.
- **Path Handling:** Standardize absolute vs relative paths. The Git history shows multiple commits "struggling with paths," indicating brittle configuration.

#### Security
- **Admin Trigger:** Ensure `runAutoProduction` cannot be triggered by malicious POST requests to `api/admin/session.php` without a valid admin session. (Currently, the logic is gated, but the trigger mechanism is in a public-facing GET request).

## Conclusion
The CNDQ simulation is functionally complete and visually polished (using Lit components and Witcher-style haggling). However, the "No-M" architecture is currently a liability for runs of 100+ players. Addressing the atomicity of fund updates and the I/O overhead of the Aggregator is critical before the next large-scale session.
