# Human-Readable Game Loop: User vs. NPC Negotiation

This guide explains how a human player interacts with an NPC through the "No-M" event-sourced system, now featuring the **"Witcher 3" Style Haggling** mechanics.

---

## Session 1: The Public Shout & The Private Response

1.  **The Ad (Public):** During the **Trading Phase**, the user posts a "Buy Ad" on the marketplace: *"I need 50 units of Nitrogen (N)."*
    - **No-M Event:** `add_ad` is emitted.
2.  **The NPC Notice:** The NPC (running on a 10-second heartbeat) scans the board. It sees the user's ad, checks its own inventory, and decides it wants to sell.
3.  **The Initiation (Private):** The NPC starts a **Private Negotiation**. It sends the user an opening price based on its internal **Shadow Price** (break-even value). 
    - **No-M Event:** A negotiation thread is created.

## Session 2: The Art of the Haggle (The Sliders)

1.  **The Haggle Interface:** Instead of typing numbers, the user opens the negotiation and sees two sliders:
    - **Quantity Slider:** Maxes out at the seller's total stock (or the buyer's need).
    - **Price Slider (The Greed Bar):** Ranges from $0 to 300% of the item's value.
2.  **The Annoyance Meter (NPC Patience):** As the user slides the price up (if selling) or down (if buying), a visual meter changes color:
    - **Excited (Green):** A very generous offer. The NPC will almost certainly accept.
    - **Interested (Green/Yellow):** A fair deal.
    - **Annoyed (Yellow/Orange):** The user is being greedy. The NPC will likely counter-offer.
    - **Furious (Red):** "You're robbing me!" The NPC is likely to reject the deal entirely.
3.  **The Counter-Offer:** The user sets the sliders to a "Greedy" but reasonable level and clicks **Send Offer**.
    - **No-M Event:** `add_counter_offer` is emitted with the slider values.

## Session 3: Closing the Deal (The "Pop")

1.  **New Round, New Inventory:** The game advances. Automatic production runs. 
2.  **The Acceptance:** The user re-opens the negotiation. The NPC has countered with a slightly better price. The user sees the meter is in the "Interested" zone and clicks **Accept**.
3.  **The "Pop" (Atomic Execution):** The system fires a synchronized burst of events:
    - **Money Swap:** User's funds and NPC's funds are updated.
    - **Chemical Swap:** Inventory units are moved between directories.
    - **No-M Event:** `adjust_chemical` and `set_funds` events are written to the disk.

---

## Logic Summary for Developers

- **Greed Ratio:** The core logic is `Price / Shadow Price`. 
    - Ratio < 1.0 = NPC Profit (if NPC is seller).
    - Ratio > 1.5 = "Greedy" (Triggering counters).
    - Ratio > 2.5 = "Robbery" (Triggering rejection).
- **Shadow Prices:** Calculated via the `LPSolver`. It represents the marginal utility of 1 gallon of chemical to that specific team's production.
- **Why Sliders?** Sliders constrain user input to "meaningful" ranges (0-300% of value), preventing broken trades while gamifying the negotiation.
- **Atomic Integrity:** Even with complex haggling, the "No-M" model ensures that every slider move and every "Accept" click is a discrete, un-editable JSON event on the filesystem.