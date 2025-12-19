<?php
header('Content-Type: application/json');

$dataDir = __DIR__ . '/data';
$files = glob($dataDir . '/user_*.json');

$teams = [];

// Helper to extract email from filename
function getEmailFromFilename($filename) {
    // filename format: user_email.json
    $basename = basename($filename, '.json');
    if (strpos($basename, 'user_') === 0) {
        return substr($basename, 5);
    }
    return $basename;
}

foreach ($files as $file) {
    $content = file_get_contents($file);
    if ($content) {
        $data = json_decode($content, true);
        if ($data) {
            $email = getEmailFromFilename($file);
            // Return only necessary public info
            $teams[] = [
                'id' => $email, // The filename safe string
                'display' => str_replace('_', '.', $email), // Rough formatting
                'inventory' => $data['inventory'] ?? [], // This is the reduced (current) inventory
                'baseInventory' => $data['baseInventory'] ?? ($data['inventory'] ?? []),
                // We might need to know if they are 'active' or valid
            ];
        }
    }
}

echo json_encode(['teams' => $teams, 'currentUser' => $_SERVER['mail'] ?? 'dev_user']);
