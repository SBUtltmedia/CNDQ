<?php

function getCurrentUserEmail() {
    // Check for cookie override (for local testing of multiple players)
    if (isset($_COOKIE['mock_mail'])) {
        return $_COOKIE['mock_mail'];
    }
    
    // Fallback to server environment variable (Shibboleth via $_SERVER or .htaccess via getenv)
    return $_SERVER['mail'] ?? $_SERVER['email'] ?? getenv('mail') ?? getenv('email') ?? 'dev_user';
}

function isAdmin() {
    // Admin allowlist - users with special privileges
    $adminEmails = [
        'admin@stonybrook.edu',
        'instructor@stonybrook.edu',
        'instructor1@stonybrook.edu',
        'instructor2@stonybrook.edu'
    ];

    $currentEmail = getCurrentUserEmail();
    return in_array($currentEmail, $adminEmails);
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