# CNDQ Accessibility & UX Roadmap (Priority: Accessibility-First)

> **Context:** This simulation must be fully accessible to users who are legally blind. Accessibility is not a separate phase; it is the foundation of every visual and functional update.

---

## 🟢 Phase 0: Accessibility Foundation (IMMEDIATE)
*Goal: Ensure the game is fully navigable and understandable via Screen Readers and Keyboard.*

| Feature | Description | Implementation Detail |
| :--- | :--- | :--- |
| **ARIA Live Notifications** | Announcements for trade completions, price changes, and NPC responses. | Use `aria-live="polite"` for background updates and `"assertive"` for alerts. |
| **Semantic Sectioning** | Ensure every component uses correct HTML5 tags (`<section>`, `<h3>`, etc.). | Wrap chemical cards in `<article>` tags with descriptive headings. |
| **Screen Reader Summary** | A hidden-from-view summary that tells the player their total health in one sentence. | "You have $5,000. Your primary bottleneck is Chemical N. Your profit is up 5%." |
| **Descriptive Labels** | Buttons should describe exactly what they do. | Change "Sell" to "Sell [Quantity] of [Chemical] to [Team]." |
| **Keyboard Focus Traps** | Ensure modals (like the Haggle modal) correctly trap focus for users not using a mouse. | Update `ModalManager.js` to handle Tab and Shift+Tab focus cycling. |

## 🟡 Phase 1: High-Visibility & Audio (Visual Polish)
*Goal: Provide redundant feedback loops (Sound + Sight + Touch).*

| Feature | Description | Implementation Detail |
| :--- | :--- | :--- |
| **Audio "Earcons"** | Sound effects for success, warning, and urgency. | Use Web Audio API for subtle, non-intrusive chimes. |
| **True High Contrast** | A black-and-yellow theme designed for maximum legibility. | `[data-theme="high-contrast"]` update with thicker borders and larger text. |
| **Pulsing Focus** | Highly visible focus rings (4px thickness) for all interactive elements. | Update `styles.css` `:focus-visible` styles. |
| **Haptic Feedback** | Vibration on mobile when trades occur or buttons are clicked. | `navigator.vibrate([100])` for tactical feedback. |

## 🔵 Phase 2: Simplified Concepts (Pedagogy)
*Goal: Explain complex Linear Programming in plain language.*

| Feature | Description | Implementation Detail |
| :--- | :--- | :--- |
| **The "Why" Tooltip** | Plain-English explanations of Shadow Prices and Slack. | Hover/Focus tooltip: "This is the value of 1 more gallon to you." |
| **Impact Preview** | Real-time calculation of ROI % change before sending an offer. | "This trade will increase your final profit by X%." |
| **Recipe Visuals** | Screen-reader friendly breakdown of ingredient requirements. | Use lists instead of just icons for recipes. |

## 🟣 Phase 3: Market Presence & Narrative
*Goal: Make the simulation feel alive and provide meaningful reflection.*

| Feature | Description | Implementation Detail |
| :--- | :--- | :--- |
| **Live Market Ticker** | A ticker that is also accessible as a list of recent events. | Horizontal scroll for sighted users; accessible list for SR users. |
| **Infographic Summary** | Narrative-driven end-of-game summary (e.g., "The Master of Chemical D"). | Text-based summary of trading style and successes. |
| **"What If" Analysis** | Post-game tip showing missed opportunities based on shadow prices. | "You left $200 on the table by not buying more N." |

---

## Implementation Priority

### 1. Accessibility & Screen Reader Support (Phase 0)
*   ARIA Live regions for notifications.
*   Keyboard navigation fixes for all modals.
*   Descriptive button labels.

### 2. Low-Vision Optimization (Phase 1)
*   Yellow/Black High Contrast theme.
*   Audio cues for key events.
*   Scalable text (rem units).

### 3. Visual & Tactical Polish (Phase 2 & 3)
*   Bottleneck Glows.
*   Price Trend Arrows.
*   Infographic Narratives.
