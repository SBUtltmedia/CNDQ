<?php

// Load environment variables for local development (Herd/PHP-FPM doesn't support .htaccess SetEnv)
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0 || trim($line) === '') continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = strtolower(trim($key));
            $value = trim($value);
            $_SERVER[$key] = $value;
            putenv("$key=$value");
        }
    }
}

function getCurrentUserEmail() {
    // Check for cookie override (for local testing of multiple players)
    if (isset($_COOKIE['mock_mail']) && !empty($_COOKIE['mock_mail'])) {
        return $_COOKIE['mock_mail'];
    }

    // Prefer non-identifying Shibboleth attributes for privacy
    // persistent-id is a random opaque identifier that doesn't reveal identity
    $persistentId = $_SERVER['persistent-id'] ?? getenv('persistent-id') ?? null;
    if (!empty($persistentId)) return $persistentId;

    // eppn (eduPersonPrincipalName) is less identifying than email
    $eppn = $_SERVER['eppn'] ?? getenv('eppn') ?? null;
    if (!empty($eppn)) return $eppn;

    // Fallback to email for backwards compatibility
    $mail = $_SERVER['mail'] ?? getenv('mail') ?? null;
    if (!empty($mail)) return $mail;

    $email = $_SERVER['email'] ?? getenv('email') ?? null;
    if (!empty($email)) return $email;

    // Default for local development (Herd/non-Shibboleth)
    return 'dev_user@localhost';
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