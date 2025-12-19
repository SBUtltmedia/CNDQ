<?php

function getCurrentUserEmail() {
    // Check for cookie override (for local testing of multiple players)
    if (isset($_COOKIE['mock_mail'])) {
        return $_COOKIE['mock_mail'];
    }
    
    // Fallback to server environment variable (Shibboleth or .htaccess)
    return $_SERVER['mail'] ?? $_SERVER['email'] ?? 'dev_user';
}

function getUserDataFilePath() {
    $email = getCurrentUserEmail();
    
    // Sanitize email for filename to prevent directory traversal or invalid chars
    $safeEmail = preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $email);
    
    $dataDir = __DIR__ . '/data';
    
    if (!file_exists($dataDir)) {
        if (!mkdir($dataDir, 0755, true)) {
            error_log("Failed to create data directory: $dataDir");
        }
    }
    
    return $dataDir . '/user_' . $safeEmail . '.json';
}