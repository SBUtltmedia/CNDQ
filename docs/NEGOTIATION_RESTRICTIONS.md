# Negotiation Restrictions: Single Active Sale per Chemical

To ensure market integrity and prevent over-leveraging of inventory, the following restriction is proposed for the CNDQ trading system.

## The Restriction
A player is restricted to **one active "Sell To" negotiation per chemical** at any given time.

| Aspect | Detail |
| :--- | :--- |
| **Scope** | Applies to human-to-human and human-to-NPC negotiations where the user is the **Seller**. |
| **Logic** | If a user has a pending negotiation for Chemical C (status: `pending`, type: `sell`), all other "Sell To" buttons/actions for Chemical C are disabled. |
| **Relinquishing** | A user can cancel (reject) their active negotiation at any time to unlock the ability to sell to other parties. |
| **Goal** | Prevents "double-selling" promises and encourages tactical commitment to specific buyers. |

## Why this is Sound
1. **Inventory Safety**: Players cannot promise the same 100 gallons to five different people simultaneously.
2. **Reduced Marketplace Noise**: Prevents spamming low-quality offers to multiple targets.
3. **Decisive Gameplay**: Forces players to evaluate the best offer before committing their "negotiation slot" for that chemical.

## User Experience (UX)
- **UI State**: The "Sell To" button in the Marketplace for a specific chemical will be disabled if a sale is already in progress.
- **Feedback**: A tooltip or toast will inform the user: *"You already have a pending sale for Chemical [X]. Cancel it to negotiate with this team."*
- **Action**: Users can navigate to their "Active Negotiations" panel to relinquish (cancel) the slow deal.
