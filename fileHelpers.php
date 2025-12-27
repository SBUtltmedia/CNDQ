<?php
/**
 * File-based JSON storage helpers with proper locking for concurrent access
 */

/**
 * Update offers.json with atomic read-modify-write
 * @param callable $callback Function that receives and modifies the offers data
 * @return array The updated offers data
 */
function updateOffers($callback) {
    $file = __DIR__ . '/data/offers.json';

    // Ensure data directory exists
    $dataDir = __DIR__ . '/data';
    if (!file_exists($dataDir)) {
        mkdir($dataDir, 0755, true);
    }

    // Create file if it doesn't exist
    if (!file_exists($file)) {
        file_put_contents($file, json_encode(['offers' => [], 'last_modified' => time()]));
    }

    $fp = fopen($file, 'c+');
    if (!$fp) {
        error_log("Failed to open offers.json");
        return ['offers' => []];
    }

    if (flock($fp, LOCK_EX)) {
        $size = filesize($file);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = json_decode($content, true) ?: ['offers' => []];

        // Execute callback to modify data
        $data = $callback($data);
        $data['last_modified'] = time();

        // Write back
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
    } else {
        error_log("Failed to lock offers.json");
        $data = ['offers' => []];
    }

    fclose($fp);
    return $data;
}

/**
 * Read offers.json
 * @return array The offers data
 */
function getOffers() {
    $file = __DIR__ . '/data/offers.json';
    if (!file_exists($file)) {
        return ['offers' => [], 'last_modified' => 0];
    }

    $fp = fopen($file, 'r');
    if (!$fp) {
        return ['offers' => []];
    }

    if (flock($fp, LOCK_SH)) {
        $size = filesize($file);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = json_decode($content, true) ?: ['offers' => []];
        flock($fp, LOCK_UN);
    } else {
        $data = ['offers' => []];
    }

    fclose($fp);
    return $data;
}

/**
 * Append a trade to the trades log
 * @param array $tradeData The trade information to log
 */
function logTrade($tradeData) {
    $file = __DIR__ . '/data/trades_log.json';

    // Ensure data directory exists
    $dataDir = __DIR__ . '/data';
    if (!file_exists($dataDir)) {
        mkdir($dataDir, 0755, true);
    }

    // Create file if it doesn't exist
    if (!file_exists($file)) {
        file_put_contents($file, json_encode(['trades' => []]));
    }

    $fp = fopen($file, 'c+');
    if (!$fp) {
        error_log("Failed to open trades_log.json");
        return;
    }

    if (flock($fp, LOCK_EX)) {
        $size = filesize($file);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = json_decode($content, true) ?: ['trades' => []];

        $data['trades'][] = $tradeData;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
    }

    fclose($fp);
}

/**
 * Send a notification to a user by appending to their notifications array
 * @param string $recipientEmail The recipient's email
 * @param array $notification The notification data
 */
function sendNotification($recipientEmail, $notification) {
    $safeEmail = preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $recipientEmail);
    $file = __DIR__ . "/data/user_{$safeEmail}.json";

    if (!file_exists($file)) {
        error_log("User file not found: $file");
        return false;
    }

    $fp = fopen($file, 'c+');
    if (!$fp) {
        error_log("Failed to open user file: $file");
        return false;
    }

    if (flock($fp, LOCK_EX)) {
        $size = filesize($file);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = json_decode($content, true) ?: [];

        if (!isset($data['notifications'])) {
            $data['notifications'] = [];
        }

        $notification['id'] = 'notif_' . time() . '_' . bin2hex(random_bytes(4));
        $notification['read'] = false;
        $notification['timestamp'] = time();

        $data['notifications'][] = $notification;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
    }

    fclose($fp);
    return true;
}

/**
 * Execute a trade between two users atomically
 * @param string $sellerId Seller's email
 * @param string $buyerId Buyer's email
 * @param string $chemical Chemical being traded (C, N, D, or Q)
 * @param float $quantity Quantity in gallons
 * @param float $pricePerGallon Price per gallon
 * @return array Success status and message
 */
function executeTrade($sellerId, $buyerId, $chemical, $quantity, $pricePerGallon) {
    // Sanitize emails
    $safeS = preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $sellerId);
    $safeB = preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $buyerId);

    // Lock files in alphabetical order to prevent deadlock
    $files = [$safeS => $sellerId, $safeB => $buyerId];
    ksort($files);

    $fps = [];
    $data = [];

    try {
        // Open and lock both files
        foreach ($files as $safe => $email) {
            $filePath = __DIR__ . "/data/user_{$safe}.json";
            if (!file_exists($filePath)) {
                throw new Exception("User file not found: $email");
            }

            $fp = fopen($filePath, 'c+');
            if (!$fp) {
                throw new Exception("Failed to open file for: $email");
            }

            if (!flock($fp, LOCK_EX)) {
                throw new Exception("Failed to lock file for: $email");
            }

            $fps[$safe] = $fp;

            $size = filesize($filePath);
            $content = $size > 0 ? fread($fp, $size) : '';
            $data[$email] = json_decode($content, true) ?: [];
        }

        $sellerData = &$data[$sellerId];
        $buyerData = &$data[$buyerId];

        $totalCost = $quantity * $pricePerGallon;

        // Validate
        if (!isset($sellerData['inventory'][$chemical])) {
            throw new Exception("Invalid chemical: $chemical");
        }

        if ($sellerData['inventory'][$chemical] < $quantity) {
            throw new Exception("Seller has insufficient inventory");
        }

        if ($buyerData['startingFund'] < $totalCost) {
            throw new Exception("Buyer has insufficient funds");
        }

        // Execute trade
        $sellerData['inventory'][$chemical] -= $quantity;
        $sellerData['startingFund'] += $totalCost;

        $buyerData['inventory'][$chemical] += $quantity;
        $buyerData['startingFund'] -= $totalCost;

        // Write back
        foreach ($files as $safe => $email) {
            $fp = $fps[$safe];
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data[$email], JSON_PRETTY_PRINT));
            fflush($fp);
        }

        // Success
        $result = ['success' => true, 'message' => 'Trade executed successfully'];

    } catch (Exception $e) {
        $result = ['success' => false, 'message' => $e->getMessage()];
    } finally {
        // Always unlock and close files
        foreach ($fps as $fp) {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }

    return $result;
}

/**
 * Get user data by email
 * @param string $email User's email
 * @return array|null User data or null if not found
 */
function getUserData($email) {
    $safeEmail = preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $email);
    $file = __DIR__ . "/data/user_{$safeEmail}.json";

    if (!file_exists($file)) {
        return null;
    }

    $fp = fopen($file, 'r');
    if (!$fp) {
        return null;
    }

    if (flock($fp, LOCK_SH)) {
        $size = filesize($file);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = json_decode($content, true);
        flock($fp, LOCK_UN);
    } else {
        $data = null;
    }

    fclose($fp);
    return $data;
}

/**
 * Update user data
 * @param string $email User's email
 * @param callable $callback Function that receives and modifies user data
 * @return bool Success
 */
function updateUserData($email, $callback) {
    $safeEmail = preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $email);
    $file = __DIR__ . "/data/user_{$safeEmail}.json";

    if (!file_exists($file)) {
        return false;
    }

    $fp = fopen($file, 'c+');
    if (!$fp) {
        return false;
    }

    $success = false;
    if (flock($fp, LOCK_EX)) {
        $size = filesize($file);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = json_decode($content, true) ?: [];

        $data = $callback($data);

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        $success = true;
    }

    fclose($fp);
    return $success;
}
