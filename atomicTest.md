# Atomic No-M Verification Technique

## Overview
In a standard "Black Box" test, we verify that an action occurred by looking at the UI (e.g., "Does the balance on screen update?"). In the **No-M (No-Model)** architecture, this is often unreliable due to polling delays, browser caching, or asynchronous reflections.

**Atomic Verification** is a "White Box" testing technique where the test script directly inspects the filesystem (the source of truth) immediately after a UI action is performed.

## Why use Atomic Verification?
1. **Instant Feedback**: You don't have to wait for a 3-second UI poll to see if a trade worked. You can check for the `.json` file in milliseconds.
2. **Definitive Diagnosis**: If the file exists but the UI is wrong, you know the bug is in the **Frontend/Aggregator**. If the file is missing, you know the bug is in the **API/Manager**.
3. **Bypasses UI Noise**: Modals, overlays, and animations can sometimes block Puppeteer from "seeing" a change. The filesystem has no such barriers.

## Implementation Pattern

### 1. The Helper Function
We use a helper that maps an email address to a physical directory and scans for a filename pattern.

```javascript
function verifyOnDisk(email, eventType) {
    const safeEmail = email.replace(/[^a-zA-Z0-9_\-@.]/g, '_');
    const teamDir = path.join('/data/teams', safeEmail);
    
    // Scan directory for the event type suffix
    const files = fs.readdirSync(teamDir);
    return files.some(f => f.includes(`_${eventType}.json`));
}
```

### 2. Insertion Points
The technique should be applied after every "State Mutating" action:

| UI Action | Expected Filesystem Event |
|-----------|---------------------------|
| User First Login | `event_..._init.json` |
| Post Buy Request | `event_..._add_buy_order.json` |
| Respond to Ad | `event_..._initiate_negotiation.json` |
| Accept Offer | `event_..._close_negotiation.json` |
| Sync Reflections | `event_..._add_transaction.json` |

## Example in CNDQ
In `comprehensive-loop.js`, we insert these checks immediately after page actions:

```javascript
await team.postBuyRequest(page, 'D', 15.00);
verifyOnDisk('alpha@stonybrook.edu', 'add_buy_order'); // <--- Atomic Check
```

## Troubleshooting with Atomic Tests
If a test fails a filesystem check:
1. **Check file permissions**: Is the web server allowed to write to that folder?
2. **Check for race conditions**: On Windows, use `usleep()` or small delays to ensure the OS has finalized the write before the test reads.
3. **Audit the Payload**: Open the found `.json` file and verify the data matches the inputs.
