<?php

function getUserDataFilePath() {
    // In ddev or similar environments, use 'mail' key as defined in configuration
    $email = $_SERVER['mail'] ?? 'dev_user'; 
    
    // Sanitize email for filename to prevent directory traversal or invalid chars
    $safeEmail = preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $email);
    
    $dataDir = __DIR__ . '/data';
    
    if (!file_exists($dataDir)) {
        if (!mkdir($dataDir, 0755, true)) {
            error_log("Failed to create data directory: $dataDir");
            // If we can't create the dir, we might want to fail gracefully or let the caller handle it.
            // But for this simple app, ensuring it exists here is fine.
        }
    }
    
    return $dataDir . '/user_' . $safeEmail . '.json';
}
