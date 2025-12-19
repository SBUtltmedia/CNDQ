<?php
require_once 'userData.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$action = $input['action'] ?? ''; // 'buy' or 'sell'
$targetId = $input['targetId'] ?? '';
$chemical = $input['chemical'] ?? '';

if (!$action || !$targetId || !$chemical) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid parameters']);
    exit;
}

// Identify Actor (Current User)
$currentUserEmail = getCurrentUserEmail();
$actorSafeEmail = preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $currentUserEmail);
$actorFile = __DIR__ . '/data/user_' . $actorSafeEmail . '.json';

// Identify Target
// targetId should already be the safe filename part (e.g. 'test_mail1@stonybrook.edu')
// But we should sanitize just in case or assume it matches the filename format used in getAllTeams
$targetFile = __DIR__ . '/data/user_' . basename($targetId) . '.json';

if (!file_exists($actorFile) || !file_exists($targetFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
}

// Lock files? For simplicity in this env, we assume low concurrency or race conditions are acceptable risks.
// A proper implementation would use flock.

$actorData = json_decode(file_get_contents($actorFile), true);
$targetData = json_decode(file_get_contents($targetFile), true);

// Normalize Inventory (ensure keys exist)
$chemicals = ['C', 'N', 'D', 'Q'];
if (!in_array($chemical, $chemicals)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid chemical']);
    exit;
}

// Ensure inventory exists (use baseInventory or inventory? Trade affects AVAILABLE inventory usually)
// The prompt says "buy or sell the complete gallons left".
// Inventory in JSON (the 'inventory' key) is the current reduced inventory.
// We should trade that.

if (!isset($actorData['inventory'][$chemical])) $actorData['inventory'][$chemical] = 0;
if (!isset($targetData['inventory'][$chemical])) $targetData['inventory'][$chemical] = 0;

$success = false;
$message = "";

if ($action === 'buy') {
    // Actor BUYS from Target (Takes ALL)
    
    // Check if Target has listed this item
    $isListed = $targetData['market_listings'][$chemical] ?? false;
    if (!$isListed) {
        echo json_encode(['error' => 'This item is not listed for sale']);
        exit;
    }

    $amount = $targetData['inventory'][$chemical];
    
    if ($amount <= 0) {
        echo json_encode(['error' => 'Target has no inventory to sell']);
        exit;
    }
    
    // Execute
    $actorData['inventory'][$chemical] += $amount;
    $targetData['inventory'][$chemical] = 0;
    
    $message = "Acquired $amount gallons of $chemical.";

} elseif ($action === 'sell') {
    // Actor SELLS to Target (Gives ALL)
    
    $amount = $actorData['inventory'][$chemical];
    
    if ($amount <= 0) {
        echo json_encode(['error' => 'You have no inventory to sell']);
        exit;
    }
    
    // Execute
    $targetData['inventory'][$chemical] += $amount;
    $actorData['inventory'][$chemical] = 0;
    
    $message = "Transferred $amount gallons of $chemical.";
}

// Save
if (file_put_contents($actorFile, json_encode($actorData, JSON_PRETTY_PRINT)) &&
    file_put_contents($targetFile, json_encode($targetData, JSON_PRETTY_PRINT))) {
    echo json_encode(['status' => 'success', 'message' => $message]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save transaction']);
}
