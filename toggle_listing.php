<?php
require_once 'userData.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$chemical = $input['chemical'] ?? '';

$chemicals = ['C', 'N', 'D', 'Q'];
if (!in_array($chemical, $chemicals)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid chemical']);
    exit;
}

$filePath = getUserDataFilePath();

if (!file_exists($filePath)) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
}

$data = json_decode(file_get_contents($filePath), true);

if (!isset($data['market_listings'])) {
    $data['market_listings'] = [];
}

// Toggle logic: If it's true, make it false. If missing or false, make it true.
$currentStatus = $data['market_listings'][$chemical] ?? false;
$newStatus = !$currentStatus;

$data['market_listings'][$chemical] = $newStatus;

if (file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT))) {
    echo json_encode([
        'status' => 'success', 
        'chemical' => $chemical, 
        'listed' => $newStatus
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save listing']);
}
