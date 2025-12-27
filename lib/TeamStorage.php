<?php
/**
 * TeamStorage - Manages all file operations for a single team
 *
 * Each team has their own directory with isolated JSON files:
 * - profile.json
 * - inventory.json
 * - production_history.json
 * - offers_made.json
 * - offers_received.json
 * - transactions.json
 * - notifications.json
 * - shadow_prices.json (PRIVATE - never shared)
 */

class TeamStorage {
    private $teamEmail;
    private $teamDir;
    private $safeEmail;

    /**
     * Initialize storage for a specific team
     * @param string $email Team's email address
     */
    public function __construct($email) {
        $this->teamEmail = $email;
        $this->safeEmail = $this->sanitizeEmail($email);
        $this->teamDir = __DIR__ . '/../data/teams/' . $this->safeEmail;
        $this->ensureDirectoryStructure();
    }

    /**
     * Sanitize email for safe filesystem usage
     */
    private function sanitizeEmail($email) {
        return preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $email);
    }

    /**
     * Create team directory and all required JSON files
     */
    private function ensureDirectoryStructure() {
        if (!is_dir($this->teamDir)) {
            if (!mkdir($this->teamDir, 0755, true)) {
                throw new Exception("Failed to create team directory: {$this->teamDir}");
            }
        }

        // Initialize files with default data if they don't exist
        $defaults = [
            'profile.json' => [
                'email' => $this->teamEmail,
                'teamName' => $this->teamEmail,
                'startingFunds' => 10000,
                'currentFunds' => 10000,
                'createdAt' => time(),
                'lastActive' => time(),
                'settings' => [
                    'showTradingHints' => false,
                    'hasSeenShadowPriceTip' => false
                ]
            ],
            'inventory.json' => [
                'C' => 1000,
                'N' => 1000,
                'D' => 1000,
                'Q' => 1000,
                'updatedAt' => time(),
                'transactionsSinceLastShadowCalc' => 0
            ],
            'production_history.json' => [
                'productions' => []
            ],
            'offers_made.json' => [
                'offers' => []
            ],
            'offers_received.json' => [
                'interests' => []
            ],
            'transactions.json' => [
                'transactions' => []
            ],
            'notifications.json' => [
                'notifications' => []
            ],
            'shadow_prices.json' => [
                'C' => 0,
                'N' => 0,
                'D' => 0,
                'Q' => 0,
                'calculatedAt' => 0,
                'transactionsAtCalculation' => 0
            ]
        ];

        foreach ($defaults as $filename => $defaultData) {
            $filepath = $this->teamDir . '/' . $filename;
            if (!file_exists($filepath)) {
                file_put_contents($filepath, json_encode($defaultData, JSON_PRETTY_PRINT));
                chmod($filepath, $filename === 'shadow_prices.json' ? 0600 : 0644);
            }
        }
    }

    /**
     * Atomic read-modify-write operation with file locking
     * @param string $filename The JSON file to update
     * @param callable $callback Function that receives and modifies the data
     * @return array The updated data
     */
    private function atomicUpdate($filename, $callback) {
        $filepath = $this->teamDir . '/' . $filename;

        if (!file_exists($filepath)) {
            throw new Exception("File not found: $filename");
        }

        $fp = fopen($filepath, 'c+');
        if (!$fp) {
            throw new Exception("Failed to open file: $filename");
        }

        try {
            if (!flock($fp, LOCK_EX)) {
                throw new Exception("Failed to lock file: $filename");
            }

            $size = filesize($filepath);
            $content = $size > 0 ? fread($fp, $size) : '';
            $data = json_decode($content, true);

            if ($data === null) {
                throw new Exception("Invalid JSON in file: $filename");
            }

            // Execute callback to modify data
            $data = $callback($data);
            $data['lastModified'] = time();

            // Write back
            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
            fflush($fp);

            flock($fp, LOCK_UN);
            fclose($fp);

            return $data;
        } catch (Exception $e) {
            flock($fp, LOCK_UN);
            fclose($fp);
            throw $e;
        }
    }

    /**
     * Read a file with shared lock
     * @param string $filename The JSON file to read
     * @return array The file contents
     */
    private function atomicRead($filename) {
        $filepath = $this->teamDir . '/' . $filename;

        if (!file_exists($filepath)) {
            throw new Exception("File not found: $filename");
        }

        $fp = fopen($filepath, 'r');
        if (!$fp) {
            throw new Exception("Failed to open file: $filename");
        }

        try {
            if (!flock($fp, LOCK_SH)) {
                throw new Exception("Failed to lock file: $filename");
            }

            $size = filesize($filepath);
            $content = $size > 0 ? fread($fp, $size) : '';
            $data = json_decode($content, true);

            flock($fp, LOCK_UN);
            fclose($fp);

            return $data ?: [];
        } catch (Exception $e) {
            flock($fp, LOCK_UN);
            fclose($fp);
            throw $e;
        }
    }

    // ==================== Profile Methods ====================

    public function getProfile() {
        return $this->atomicRead('profile.json');
    }

    public function updateProfile($callback) {
        return $this->atomicUpdate('profile.json', $callback);
    }

    public function setTeamName($name) {
        return $this->updateProfile(function($data) use ($name) {
            $data['teamName'] = $name;
            return $data;
        });
    }

    public function updateFunds($amount) {
        return $this->updateProfile(function($data) use ($amount) {
            $data['currentFunds'] += $amount;
            return $data;
        });
    }

    public function setFunds($amount) {
        return $this->updateProfile(function($data) use ($amount) {
            $data['currentFunds'] = $amount;
            return $data;
        });
    }

    // ==================== Inventory Methods ====================

    public function getInventory() {
        return $this->atomicRead('inventory.json');
    }

    public function updateInventory($callback) {
        return $this->atomicUpdate('inventory.json', $callback);
    }

    public function adjustChemical($chemical, $amount) {
        return $this->updateInventory(function($data) use ($chemical, $amount) {
            if (!isset($data[$chemical])) {
                throw new Exception("Invalid chemical: $chemical");
            }
            $data[$chemical] += $amount;
            $data['updatedAt'] = time();

            // Increment transaction counter
            if ($amount != 0) {
                $data['transactionsSinceLastShadowCalc'] =
                    ($data['transactionsSinceLastShadowCalc'] ?? 0) + 1;
            }

            return $data;
        });
    }

    public function resetShadowCalcCounter() {
        return $this->updateInventory(function($data) {
            $data['transactionsSinceLastShadowCalc'] = 0;
            return $data;
        });
    }

    // ==================== Shadow Prices Methods ====================

    public function getShadowPrices() {
        return $this->atomicRead('shadow_prices.json');
    }

    public function updateShadowPrices($prices) {
        return $this->atomicUpdate('shadow_prices.json', function($data) use ($prices) {
            $data['C'] = $prices['C'] ?? 0;
            $data['N'] = $prices['N'] ?? 0;
            $data['D'] = $prices['D'] ?? 0;
            $data['Q'] = $prices['Q'] ?? 0;
            $data['calculatedAt'] = time();

            $inventory = $this->getInventory();
            $data['transactionsAtCalculation'] = $inventory['transactionsSinceLastShadowCalc'] ?? 0;

            return $data;
        });
    }

    // ==================== Offers Methods ====================

    public function getOffersMade() {
        return $this->atomicRead('offers_made.json');
    }

    public function addOffer($offerData) {
        return $this->atomicUpdate('offers_made.json', function($data) use ($offerData) {
            $offerData['id'] = 'offer_' . time() . '_' . bin2hex(random_bytes(4));
            $offerData['sellerId'] = $this->teamEmail;
            $offerData['createdAt'] = time();
            $offerData['status'] = 'active';

            $data['offers'][] = $offerData;
            return $data;
        });
    }

    public function updateOffer($offerId, $updates) {
        return $this->atomicUpdate('offers_made.json', function($data) use ($offerId, $updates) {
            foreach ($data['offers'] as &$offer) {
                if ($offer['id'] === $offerId) {
                    foreach ($updates as $key => $value) {
                        $offer[$key] = $value;
                    }
                    $offer['updatedAt'] = time();
                    break;
                }
            }
            return $data;
        });
    }

    public function removeOffer($offerId) {
        return $this->atomicUpdate('offers_made.json', function($data) use ($offerId) {
            $data['offers'] = array_values(array_filter($data['offers'], function($offer) use ($offerId) {
                return $offer['id'] !== $offerId;
            }));
            return $data;
        });
    }

    // ==================== Buy Orders (Interests) Methods ====================

    public function getBuyOrders() {
        return $this->atomicRead('offers_received.json');
    }

    public function addBuyOrder($buyOrderData) {
        return $this->atomicUpdate('offers_received.json', function($data) use ($buyOrderData) {
            $buyOrderData['id'] = 'buy_' . time() . '_' . bin2hex(random_bytes(4));
            $buyOrderData['buyerId'] = $this->teamEmail;
            $buyOrderData['createdAt'] = time();
            $buyOrderData['status'] = 'active';
            $buyOrderData['type'] = 'buy';

            $data['interests'][] = $buyOrderData;
            return $data;
        });
    }

    public function updateBuyOrder($buyOrderId, $updates) {
        return $this->atomicUpdate('offers_received.json', function($data) use ($buyOrderId, $updates) {
            foreach ($data['interests'] as &$interest) {
                if ($interest['id'] === $buyOrderId) {
                    foreach ($updates as $key => $value) {
                        $interest[$key] = $value;
                    }
                    $interest['updatedAt'] = time();
                    break;
                }
            }
            return $data;
        });
    }

    public function removeBuyOrder($buyOrderId) {
        return $this->atomicUpdate('offers_received.json', function($data) use ($buyOrderId) {
            $data['interests'] = array_values(array_filter($data['interests'], function($interest) use ($buyOrderId) {
                return $interest['id'] !== $buyOrderId;
            }));
            return $data;
        });
    }

    // ==================== Transactions Methods ====================

    public function getTransactions() {
        return $this->atomicRead('transactions.json');
    }

    public function addTransaction($transactionData) {
        return $this->atomicUpdate('transactions.json', function($data) use ($transactionData) {
            $transactionData['id'] = 'txn_' . time() . '_' . bin2hex(random_bytes(4));
            $transactionData['timestamp'] = time();

            $data['transactions'][] = $transactionData;
            return $data;
        });
    }

    // ==================== Notifications Methods ====================

    public function getNotifications() {
        return $this->atomicRead('notifications.json');
    }

    public function addNotification($notificationData) {
        return $this->atomicUpdate('notifications.json', function($data) use ($notificationData) {
            $notificationData['id'] = 'notif_' . time() . '_' . bin2hex(random_bytes(4));
            $notificationData['timestamp'] = time();
            $notificationData['read'] = false;

            $data['notifications'][] = $notificationData;

            // Keep only last 50 notifications
            if (count($data['notifications']) > 50) {
                $data['notifications'] = array_slice($data['notifications'], -50);
            }

            return $data;
        });
    }

    public function markNotificationsRead($notificationIds = null) {
        return $this->atomicUpdate('notifications.json', function($data) use ($notificationIds) {
            foreach ($data['notifications'] as &$notif) {
                if ($notificationIds === null || in_array($notif['id'], $notificationIds)) {
                    $notif['read'] = true;
                }
            }
            return $data;
        });
    }

    // ==================== Production History Methods ====================

    public function addProduction($productionData) {
        return $this->atomicUpdate('production_history.json', function($data) use ($productionData) {
            $productionData['timestamp'] = time();
            $data['productions'][] = $productionData;
            return $data;
        });
    }

    public function getProductionHistory() {
        return $this->atomicRead('production_history.json');
    }

    // ==================== Settings Methods ====================

    public function getSettings() {
        $profile = $this->getProfile();
        return $profile['settings'] ?? [
            'showTradingHints' => false,
            'hasSeenShadowPriceTip' => false
        ];
    }

    public function updateSettings($newSettings) {
        return $this->updateProfile(function($data) use ($newSettings) {
            if (!isset($data['settings'])) {
                $data['settings'] = [];
            }
            $data['settings'] = array_merge($data['settings'], $newSettings);
            return $data;
        });
    }

    // ==================== Utility Methods ====================

    public function getTeamEmail() {
        return $this->teamEmail;
    }

    public function getTeamDirectory() {
        return $this->teamDir;
    }

    /**
     * Get complete team state (for debugging or admin dashboard)
     */
    public function getFullState() {
        return [
            'profile' => $this->getProfile(),
            'inventory' => $this->getInventory(),
            'offersMade' => $this->getOffersMade(),
            'transactions' => $this->getTransactions(),
            'notifications' => $this->getNotifications(),
            'settings' => $this->getSettings()
            // Note: shadow_prices intentionally excluded from full state export
        ];
    }
}
