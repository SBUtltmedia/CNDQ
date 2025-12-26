<?php

require_once 'productionLib.php';

function getSafeEmail($email) {
    return preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $email);
}

function getUserDir($email) {
    $safeEmail = getSafeEmail($email);
    $dir = __DIR__ . '/data/users/' . $safeEmail;
    if (!file_exists($dir)) {
        mkdir($dir, 0755, true);
    }
    return $dir;
}

function getCurrentUserEmail() {
    if (isset($_COOKIE['mock_mail'])) {
        return $_COOKIE['mock_mail'];
    }
    return $_SERVER['mail'] ?? $_SERVER['email'] ?? 'dev_user';
}

function getUserDataFilePath($email = null) {
    if ($email === null) $email = getCurrentUserEmail();
    $path = getUserDir($email) . '/data.json';
    if (!file_exists($path)) {
        initializeUser($email);
    }
    return $path;
}

function initializeUser($email) {
    $dir = getUserDir($email);
    $path = $dir . '/data.json';
    
    // CNDQ: random(500, 1500) rounded to nearest 100
    // Profit based bank account: starts at 0
    $initialInventory = [];
    foreach(['C', 'N', 'D', 'Q'] as $chem) {
        $val = rand(500, 1500);
        $initialInventory[$chem] = round($val / 100) * 100;
    }

    $data = [
        "email" => $email,
        "displayName" => explode('@', $email)[0],
        "initialCapital" => 100000,
        "startingFund" => 100000,
        "inventory" => $initialInventory,
        "initialInventory" => $initialInventory,
        "notifications" => []
    ];

    // Run Initial Production immediately!
    calculateProduction($data);

    file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT));
    
    // Initialize other files
    if (!file_exists($dir . '/offers.json')) file_put_contents($dir . '/offers.json', json_encode([]));
    if (!file_exists($dir . '/trades.json')) file_put_contents($dir . '/trades.json', json_encode([]));
}

function getUserOffersFilePath($email) {
    return getUserDir($email) . '/offers.json';
}

function getUserTradesFilePath($email) {
    return getUserDir($email) . '/trades.json';
}