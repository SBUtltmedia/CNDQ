<?php
/**
 * File-based JSON storage helpers with proper locking for concurrent access
 * NOW DECENTRALIZED: One folder per user
 */

require_once 'userData.php';
require_once 'productionLib.php';

// --- Generic Helper for Locking & Updating JSON ---

function updateJsonFile($filePath, $callback, $default = []) {
    $dir = dirname($filePath);
    if (!file_exists($dir)) mkdir($dir, 0755, true);

    if (!file_exists($filePath)) {
        file_put_contents($filePath, json_encode($default, JSON_PRETTY_PRINT));
    }

    $fp = fopen($filePath, 'c+');
    if (!$fp) return false;

    $result = false;
    if (flock($fp, LOCK_EX)) {
        $size = filesize($filePath);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = json_decode($content, true) ?: $default;

        $newData = $callback($data);

        // If callback returns null/false, we might assume abort? 
        // But for now let's assume it returns the data to write.
        if ($newData !== null) {
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($newData, JSON_PRETTY_PRINT));
            fflush($fp);
            $result = $newData;
        }
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    return $result;
}

function readJsonFile($filePath, $default = []) {
    if (!file_exists($filePath)) return $default;
    
    $fp = fopen($filePath, 'r');
    if (!$fp) return $default;

    $data = $default;
    if (flock($fp, LOCK_SH)) {
        $size = filesize($filePath);
        $content = $size > 0 ? fread($fp, $size) : '';
        $data = json_decode($content, true) ?: $default;
        flock($fp, LOCK_UN);
    }
    fclose($fp);
    return $data;
}

// --- Specific Data Accessors ---

function getUserData($email) {
    return readJsonFile(getUserDataFilePath($email), []);
}

function updateUserData($email, $callback) {
    return updateJsonFile(getUserDataFilePath($email), $callback, []);
}

function getUserOffers($email) {
    return readJsonFile(getUserOffersFilePath($email), []);
}

function updateUserOffers($email, $callback) {
    return updateJsonFile(getUserOffersFilePath($email), $callback, []);
}

function logUserTrade($email, $tradeData) {
    return updateJsonFile(getUserTradesFilePath($email), function($trades) use ($tradeData) {
        $trades[] = $tradeData;
        return $trades;
    }, []);
}

function sendNotification($recipientEmail, $notification) {
    return updateUserData($recipientEmail, function($data) use ($notification) {
        if (!isset($data['notifications'])) $data['notifications'] = [];
        
        $notification['id'] = 'notif_' . time() . '_' . bin2hex(random_bytes(4));
        $notification['read'] = false;
        $notification['timestamp'] = time();
        
        $data['notifications'][] = $notification;
        return $data;
    });
}

/**
 * Execute a trade between two users.
 * Locks both users' data files to ensure atomicity.
 * Updates inventory/funds and logs the trade to BOTH users' trade files.
 */
function executeTrade($sellerId, $buyerId, $chemical, $quantity, $pricePerGallon) {
    $files = [
        'seller' => getUserDataFilePath($sellerId),
        'buyer' => getUserDataFilePath($buyerId)
    ];
    
    // Sort keys to prevent deadlock if we were locking based on keys, 
    // but here we lock based on file paths.
    // Let's sort the paths.
    $paths = array_values($files);
    sort($paths);
    
    $fps = [];
    $data = [];

    try {
        // Lock both data files
        foreach ($paths as $path) {
            $fp = fopen($path, 'c+');
            if (!$fp || !flock($fp, LOCK_EX)) {
                throw new Exception("Failed to lock file: $path");
            }
            $fps[$path] = $fp;
        }

        // Read Data
        $sellerData = json_decode(file_get_contents($files['seller']), true) ?: [];
        $buyerData = json_decode(file_get_contents($files['buyer']), true) ?: [];
        
        $totalCost = $quantity * $pricePerGallon;

        // Validation
        if (!isset($sellerData['inventory'][$chemical]) || $sellerData['inventory'][$chemical] < $quantity) {
            throw new Exception("Seller insufficient inventory");
        }
        if (($buyerData['startingFund'] ?? 0) < $totalCost) {
            throw new Exception("Buyer insufficient funds");
        }

        // Execute
        $sellerData['inventory'][$chemical] -= $quantity;
        $sellerData['startingFund'] += $totalCost;
        
        $buyerData['inventory'][$chemical] += $quantity;
        $buyerData['startingFund'] -= $totalCost;

        // Run Automatic Production for BOTH parties
        // If they acquired useful materials (buyer) or freed up capacity? (seller mostly just loses stock)
        // But running it ensures consistency.
        calculateProduction($sellerData);
        calculateProduction($buyerData);

        // Write Back Data
        file_put_contents($files['seller'], json_encode($sellerData, JSON_PRETTY_PRINT));
        file_put_contents($files['buyer'], json_encode($buyerData, JSON_PRETTY_PRINT));
        
        // Log Trade to both users (No need to lock strictly for append, but since we are here...)
        // Actually logUserTrade opens its own lock. That's fine.
        $tradeRecord = [
            'timestamp' => time(),
            'role' => 'seller',
            'counterparty' => $buyerId,
            'chemical' => $chemical,
            'quantity' => $quantity,
            'price' => $pricePerGallon,
            'total' => $totalCost
        ];
        logUserTrade($sellerId, $tradeRecord);
        
        $tradeRecord['role'] = 'buyer';
        $tradeRecord['counterparty'] = $sellerId;
        $tradeRecord['total'] = -$totalCost;
        logUserTrade($buyerId, $tradeRecord);

        return ['success' => true];

    } catch (Exception $e) {
        return ['success' => false, 'message' => $e->getMessage()];
    } finally {
        foreach ($fps as $fp) {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }
}