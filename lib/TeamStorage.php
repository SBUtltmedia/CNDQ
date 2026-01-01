<?php
/**
 * TeamStorage - Manages all file operations for a single team.
 * Refactored to adhere to No-M (Filesystem-as-State) philosophy.
 */

require_once __DIR__ . '/NoM/Aggregator.php';
require_once __DIR__ . '/TeamNameGenerator.php';

class TeamStorage {
    private $teamEmail;
    private $teamDir;
    private $safeEmail;
    private $cacheFile;

    /**
     * Initialize storage for a specific team
     * @param string $email Team's email address
     */
    public function __construct($email) {
        $this->teamEmail = $email;
        $this->safeEmail = $this->sanitizeEmail($email);
        $this->teamDir = __DIR__ . '/../data/teams/' . $this->safeEmail;
        $this->cacheFile = $this->teamDir . '/cached_state.json';
        $this->ensureDirectoryStructure();
    }

    /**
     * Sanitize email for safe filesystem usage
     */
    public static function sanitizeEmail($email) {
        return preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $email);
    }

    /**
     * Create team directory and emit initial event if new
     */
    private function ensureDirectoryStructure() {
        if (!is_dir($this->teamDir)) {
            if (!mkdir($this->teamDir, 0755, true)) {
                throw new \Exception("Failed to create team directory: {$this->teamDir}");
            }
            
            $generatedName = TeamNameGenerator::generate($this->teamEmail);
            
            $this->emitEvent('init', [
                'profile' => [
                    'email' => $this->teamEmail,
                    'teamName' => $generatedName,
                    'createdAt' => time(),
                    'currentFunds' => 0,
                    'startingFunds' => 0
                ],
                'inventory' => [
                    'C' => round(rand(500, 2000), 4),
                    'N' => round(rand(500, 2000), 4),
                    'D' => round(rand(500, 2000), 4),
                    'Q' => round(rand(500, 2000), 4)
                ]
            ]);

            $this->runAutomaticFirstProduction();
        }
    }

    /**
     * Emit an event (Atomic Write)
     */
    public function emitEvent(string $type, array $payload) {
        $timestamp = microtime(true);
        $event = [
            'type' => $type,
            'payload' => $payload,
            'timestamp' => $timestamp
        ];

        $jsonData = json_encode($event, JSON_PRETTY_PRINT);
        // Use high-precision timestamp to ensure order and uniqueness
        $filename = "event_" . sprintf('%0.6f', $timestamp) . "_" . $type . ".json";
        
        $tmp = tempnam($this->teamDir, 'tmp_');
        if (file_put_contents($tmp, $jsonData) === false) {
            throw new Exception("Failed to write temporary event file");
        }
        
        if (!rename($tmp, $this->teamDir . '/' . $filename)) {
            @unlink($tmp);
            throw new Exception("Failed to rename event file");
        }

        // Invalidate cache by deleting it or updating its mtime to be old
        if (file_exists($this->cacheFile)) {
            @unlink($this->cacheFile);
        }
    }

    /**
     * Get the current state (Aggregated and Cached)
     */
    public function getState(): array {
        // State Caching: Compare mtime of root directory with mtime of cached_state.json
        $dirMtime = filemtime($this->teamDir);
        $cacheMtime = file_exists($this->cacheFile) ? filemtime($this->cacheFile) : 0;

        if ($cacheMtime >= $dirMtime) {
            $content = file_get_contents($this->cacheFile);
            $cached = json_decode($content, true);
            if (is_array($cached) && isset($cached['profile'])) return $cached;
        }

        // Aggregate state from legacy files and events
        $state = \NoM\Aggregator::aggregate($this->teamDir);
        
        // Save to cache
        $tmp = tempnam($this->teamDir, 'tmp_cache_');
        file_put_contents($tmp, json_encode($state, JSON_PRETTY_PRINT));
        rename($tmp, $this->cacheFile);

        return $state;
    }

    /**
     * Automatically run first production for new teams
     */
    private function runAutomaticFirstProduction() {
        require_once __DIR__ . '/LPSolver.php';

        $inventory = $this->getInventory();
        $solver = new LPSolver();
        $result = $solver->solve($inventory);

        $deicerGallons = $result['deicer'];
        $solventGallons = $result['solvent'];
        $revenue = $result['maxProfit'];

        $consumed = [
            'C' => $deicerGallons * LPSolver::DEICER_C,
            'N' => ($deicerGallons * LPSolver::DEICER_N) + ($solventGallons * LPSolver::SOLVENT_N),
            'D' => ($deicerGallons * LPSolver::DEICER_D) + ($solventGallons * LPSolver::SOLVENT_D),
            'Q' => $solventGallons * LPSolver::SOLVENT_Q
        ];

        foreach ($consumed as $chem => $amount) {
            $this->adjustChemical($chem, -$amount);
        }

        $this->setFunds($revenue, true);

        $this->addProduction([
            'type' => 'automatic_initial',
            'deicer' => $deicerGallons,
            'solvent' => $solventGallons,
            'revenue' => $revenue,
            'chemicalsConsumed' => $consumed,
            'note' => 'Automatic first production run'
        ]);
    }

    // ==================== Profile Methods ====================

    public function getProfile() { return $this->getState()['profile']; }

    public function updateProfile($callback) {
        $state = $this->getState();
        $newProfile = $callback($state['profile']);
        $this->emitEvent('update_profile', $newProfile);
        return $newProfile;
    }

    public function setTeamName($name) {
        $this->updateProfile(function($p) use ($name) {
            $p['teamName'] = $name;
            return $p;
        });
    }

    public function updateFunds($amount) {
        $state = $this->getState();
        $newFunds = $state['profile']['currentFunds'] + $amount;
        $this->emitEvent('set_funds', ['amount' => $newFunds]);
    }

    public function setFunds($amount, $isStarting = false) {
        $this->emitEvent('set_funds', ['amount' => $amount, 'is_starting' => $isStarting]);
    }

    // ==================== Inventory Methods ====================

    public function getInventory() { return $this->getState()['inventory']; }

    public function updateInventory($callback) {
        $state = $this->getState();
        $newInventory = $callback($state['inventory']);
        $this->emitEvent('init', ['inventory' => $newInventory]);
        return $newInventory;
    }

    public function adjustChemical($chemical, $amount) {
        $this->emitEvent('adjust_chemical', ['chemical' => $chemical, 'amount' => $amount]);
    }

    public function resetShadowCalcCounter() {
        $this->emitEvent('update_shadow_prices', $this->getShadowPrices());
    }

    // ==================== Shadow Prices Methods ====================

    public function getShadowPrices() { return $this->getState()['shadowPrices']; }

    public function updateShadowPrices($prices) {
        $this->emitEvent('update_shadow_prices', $prices);
    }

    // ==================== Offers Methods ====================

    public function getOffersMade() { return ['offers' => $this->getState()['offers']]; }

    public function addOffer($data) {
        $data['id'] = 'offer_' . time() . '_' . bin2hex(random_bytes(4));
        $data['sellerId'] = $this->teamEmail;
        $data['createdAt'] = time();
        $data['status'] = 'active';
        $this->emitEvent('add_offer', $data);
        return ['offers' => $this->getOffersMade()['offers']];
    }

    public function updateOffer($id, $updates) {
        $this->emitEvent('update_offer', ['id' => $id, 'updates' => $updates]);
    }

    public function removeOffer($id) {
        $this->emitEvent('remove_offer', ['id' => $id]);
    }

    // ==================== Buy Orders Methods ====================

    public function getBuyOrders() { return ['interests' => $this->getState()['buyOrders']]; }

    public function addBuyOrder($data) {
        $data['id'] = 'buy_' . time() . '_' . bin2hex(random_bytes(4));
        $data['buyerId'] = $this->teamEmail;
        $data['createdAt'] = time();
        $data['status'] = 'active';
        $this->emitEvent('add_buy_order', $data);
        return ['interests' => $this->getBuyOrders()['interests']];
    }

    public function updateBuyOrder($id, $updates) {
        $this->emitEvent('update_buy_order', ['id' => $id, 'updates' => $updates]);
    }

    public function removeBuyOrder($id) {
        $this->emitEvent('remove_buy_order', ['id' => $id]);
    }

    // ==================== Transactions Methods ====================

    public function getTransactions() { return ['transactions' => $this->getState()['transactions']]; }

    public function addTransaction($data) {
        $data['id'] = 'txn_' . time() . '_' . bin2hex(random_bytes(4));
        $this->emitEvent('add_transaction', $data);
    }

    // ==================== Notifications Methods ====================

    public function getNotifications() { return ['notifications' => $this->getState()['notifications']]; }

    public function addNotification($data) {
        $data['id'] = 'notif_' . time() . '_' . bin2hex(random_bytes(4));
        $this->emitEvent('add_notification', $data);
        return $data;
    }

    public function markNotificationsRead($ids = null) {
        $this->emitEvent('mark_notifications_read', ['ids' => $ids]);
    }

    // ==================== Advertisement Methods ====================

    public function getAds() { return $this->getState()['ads']; }

    public function addAd($chemical, $type) {
        $ad = [
            'id' => 'ad_' . time() . '_' . bin2hex(random_bytes(4)),
            'teamId' => $this->teamEmail,
            'chemical' => $chemical,
            'type' => $type,
            'status' => 'active',
            'createdAt' => time()
        ];
        $this->emitEvent('add_ad', $ad);
        return ['ads' => $this->getAds()];
    }

    public function removeAd($adId) {
        $this->emitEvent('remove_ad', ['id' => $adId]);
    }

    // ==================== Production Methods ====================

    public function addProduction($data) { $this->emitEvent('add_production', $data); }
    public function getProductionHistory() { return $this->getState()['productions']; }

    // ==================== Settings Methods ====================

    public function getSettings() { return $this->getState()['profile']['settings'] ?? []; }

    public function updateSettings($settings) {
        $this->updateProfile(function($p) use ($settings) {
            $p['settings'] = array_merge($p['settings'] ?? [], $settings);
            return $p;
        });
    }

    // ==================== Utility Methods ====================

    public function getTeamEmail() { return $this->teamEmail; }
    public function getTeamDirectory() { return $this->teamDir; }
    public function getFullState() { return $this->getState(); }
}