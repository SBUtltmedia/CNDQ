# Request for Comprehensive Project Audit: CNDQ Simulation Game

## Objective
Generate a detailed project report (`Gemini3Report.md`) for the CNDQ project, a PHP/JS-based simulation game designed for educational exercises (Deicer and Solvent industry). The report should assess the current state of the codebase, identify bugs, and propose architectural and functional improvements suitable for "small runs" of approximately 100 concurrent players.

## Source Material & Context
- **Core Problem Definition:** Refer to `CNDQ/unused/Problem.md` for the original "Deicer and Solvent" exercise logic (Linear Programming, Shadow Prices, and non-zero-sum cooperation).
- **Simplified Marketplace:** Note that "Sell requests" have been deemed unnecessary; the marketplace logic should be evaluated with this simplification in mind.
- **Scale:** The system must handle ~100 players divided into teams of 3-4.

## Report Requirements

### 1. Architectural Overview
- Analyze the current hybrid PHP (backend) and JS (frontend) architecture.
- Evaluate the data storage mechanism (JSON-based file storage in `CNDQ/data/`) and its suitability for 100 players (concurrency, locking, performance).
- Review the `lib/` directory for core logic encapsulation (LPSolver, NPCManager, SessionManager).

### 2. Bug Report & Technical Debt
- Perform a scan of the codebase for common vulnerabilities (SQL injection, XSS in JS components, insecure direct object references).
- Identify logical errors in the "Shadow Price" calculation or the production loop.
- Spot inconsistencies between the original `Problem.md` and the current implementation.
- Check for "dead code" or unused scripts in `unused/` that might still be affecting the system.

### 3. Gameplay & UX Improvements
- **Shadow Price Visualization:** How can the internal value of chemicals be better communicated to students to prevent "bad deals"?
- **Marketplace Flow:** Refine the negotiation flow given the removal of sell requests.
- **NPC Integration:** Evaluate how NPCs interact with humans and whether their trading strategies (Shadow-price-based) are effective.
- **Session Management:** Propose improvements for "auto-advancing" sessions and real-time updates.

### 4. Scalability & Deployment
- Suggestions for moving from file-based storage to a database (if necessary) or improving file-locking mechanisms.
- Frontend optimization (Lit components transition, bundling).
- Admin dashboard enhancements for managing 25-30 teams simultaneously.

### 5. Historical Analysis
- Review the Git history (`git log`) to identify recurring issues or recent regressions.

## Deliverable
A markdown file named `Gemini3Report.md` that is structured, professional, and actionable.
