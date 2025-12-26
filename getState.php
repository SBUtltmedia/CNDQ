<?php
require_once 'userData.php';

header('Content-Type: application/json');

$filePath = getUserDataFilePath();

if (file_exists($filePath)) {
    // Read and output the JSON content directly
    echo file_get_contents($filePath);
} else {
    // Return 404 so the frontend knows to initialize a new session
    http_response_code(404);
    echo json_encode(['error' => 'No session state found']);
}
