<?php
/**
 * NoM TeamStorage - Event-Sourced version of TeamStorage
 * Drop-in replacement that adheres to Filesystem-as-State philosophy.
 */
namespace NoM;

require_once __DIR__ . '/Aggregator.php';

class TeamStorage {
    private $teamEmail;
    private $teamDir;
    private $safeEmail;
    private $cacheFile;
    private $teamName;

    public function __construct($email) {
        $this->teamEmail = $email;
        $this->safeEmail = $this->sanitizeEmail($email);
        $this->teamDir = __DIR__ . '/../../data/teams/' . $this->safeEmail;
        $this->cacheFile = $this->teamDir . '/cached_state.json';
        $this->ensureDirectoryStructure();
    }

    public function getTeamName() {
        if ($this->teamName) return $this->teamName;
        $state = $this->getState();
        $this->teamName = $state['profile']['teamName'] ?? $this->teamEmail;
        return $this->teamName;
    }

    private function sanitizeEmail($email) {
        return preg_replace('/[^a-zA-Z0-9_\-@.]/', '_', $email);
    }

    private function ensureDirectoryStructure() {
        if (!is_dir($this->teamDir)) {
            if (!mkdir($this->teamDir, 0755, true)) {
                throw new \Exception("Failed to create team directory: {$this->teamDir}");
            }
            
            require_once __DIR__ . '/../TeamNameGenerator.php';
            $this->teamName = \TeamNameGenerator::generate($this->teamEmail);
            
            $timestamp = microtime(true);
            $filename = "event_" . sprintf('%0.6f', $timestamp) . "_init.json";

            $event = [
                'type' => 'init',
                'payload' => [
                    'profile' => [
                        'email' => $this->teamEmail,
                        'teamName' => $this->teamName,
                        'createdAt' => time(),
                        'currentFunds' => 10000,
                        'startingFunds' => 10000
                    ],
                    'inventory' => [
                        'C' => round(rand(500, 2000), 4),
                        'N' => round(rand(500, 2000), 4),
                        'D' => round(rand(500, 2000), 4),
                        'Q' => round(rand(500, 2000), 4)
                    ],
                    'shadowPrices' => [
                        'C' => 0, 'N' => 0, 'D' => 0, 'Q' => 0
                    ]
                ],
                'timestamp' => $timestamp,
                'teamId' => $this->teamEmail,
                'teamName' => $this->teamName
            ];

            file_put_contents($this->teamDir . '/' . $filename, json_encode($event, JSON_PRETTY_PRINT));

            $this->runAutomaticFirstProduction();
        }
    }

    private function runAutomaticFirstProduction() {
        require_once __DIR__ . '/../LPSolver.php';

        $inventory = $this->getInventory();
        $solver = new \LPSolver();
        $result = $solver->solve($inventory);

        $deicerGallons = $result['deicer'];
        $solventGallons = $result['solvent'];
        $revenue = $result['maxProfit'];

        $consumed = [
            'C' => $deicerGallons * \LPSolver::DEICER_C,
            'N' => ($deicerGallons * \LPSolver::DEICER_N) + ($solventGallons * \LPSolver::SOLVENT_N),
            'D' => ($deicerGallons * \LPSolver::DEICER_D) + ($solventGallons * \LPSolver::SOLVENT_D),
            'Q' => $solventGallons * \LPSolver::SOLVENT_Q
        ];

        // Emit events for production
        foreach ($consumed as $chem => $amount) {
            $this->adjustChemical($chem, -$amount);
        }

        // --- FIXED: Add revenue to existing funds (don't reset baseline) ---
        $this->updateFunds($revenue);

        $this->addProduction([
            'type' => 'automatic_initial',
            'deicer' => $deicerGallons,
            'solvent' => $solventGallons,
            'revenue' => $revenue,
            'chemicalsConsumed' => $consumed,
            'note' => 'Automatic first production run'
        ]);
    }

    public function emitEvent(string $type, array $payload) {
        $timestamp = microtime(true);
        $event = [
            'type' => $type,
            'payload' => $payload,
            'timestamp' => $timestamp,
            'teamId' => $this->teamEmail,
            'teamName' => $this->teamName ?? ($type === 'init' ? $payload['profile']['teamName'] : $this->getTeamName())
        ];

        $jsonData = json_encode($event, JSON_PRETTY_PRINT);
        $filename = "event_" . sprintf('%0.6f', $timestamp) . "_" . $type . ".json";
        
        $tmp = tempnam($this->teamDir, 'tmp_');
        if (file_put_contents($tmp, $jsonData) === false) {
            throw new \Exception("Failed to write temporary event file");
        }
        
        if (!rename($tmp, $this->teamDir . '/' . $filename)) {
            @unlink($tmp);
            throw new \Exception("Failed to rename event file");
        }

        // --- NEW: Shared Event Log for fast global querying ---
        $sharedTypes = ['add_offer', 'remove_offer', 'update_offer', 'add_buy_order', 'remove_buy_order', 'update_buy_order', 'add_ad', 'remove_ad'];
        if (in_array($type, $sharedTypes)) {
            $sharedDir = __DIR__ . '/../../data/marketplace/events';
            if (!is_dir($sharedDir)) {
                mkdir($sharedDir, 0755, true);
            }
            
            // Explicitly inject teamName into payload for the shared log
            $event['payload']['teamName'] = $this->getTeamName();
            $jsonData = json_encode($event, JSON_PRETTY_PRINT);
            file_put_contents($sharedDir . '/' . $filename, $jsonData);
        }

        // Invalidate cache
        if (file_exists($this->cacheFile)) {
            @unlink($this->cacheFile);
        }
    }

    public function getState(): array {
        $cacheMtime = file_exists($this->cacheFile) ? filemtime($this->cacheFile) : 0;
        
        $events = glob($this->teamDir . '/event_*.json');
        $newestEventMtime = 0;
        if (!empty($events)) {
            sort($events);
            $newestEventMtime = filemtime(end($events));
        }

        if ($cacheMtime > $newestEventMtime && $cacheMtime > 0) {
            $cached = json_decode(file_get_contents($this->cacheFile), true);
            if ($cached) return $cached;
        }

        $state = Aggregator::aggregate($this->teamDir);
        
        $tmp = tempnam($this->teamDir, 'tmp_cache_');
        file_put_contents($tmp, json_encode($state, JSON_PRETTY_PRINT));
        rename($tmp, $this->cacheFile);

        // Check if we should create a snapshot (e.g. every 50 events)
        $eventsSinceSnapshot = $state['eventsProcessed'] - ($state['snapshotEvents'] ?? 0);
        if ($eventsSinceSnapshot >= 50) {
            $this->createSnapshot($state);
        }

        return $state;
    }

    private function createSnapshot(array $state) {
        $state['snapshotEvents'] = $state['eventsProcessed'];
        $state['snapshotAt'] = time();
        
        $snapshotFile = $this->teamDir . '/snapshot.json';
        $tmp = tempnam($this->teamDir, 'tmp_snap_');
        file_put_contents($tmp, json_encode($state, JSON_PRETTY_PRINT));
        rename($tmp, $snapshotFile);
    }

    // ==================== Public API ====================

    public function getProfile() { return $this->getState()['profile']; }
    public function getInventory() { return $this->getState()['inventory']; }
    public function getProductionHistory() { return $this->getState()['productions']; }
    public function getOffersMade() { return ['offers' => $this->getState()['offers']]; }
    public function getBuyOrders() { return ['interests' => $this->getState()['buyOrders']]; }
    public function getTransactions() { return ['transactions' => $this->getState()['transactions']]; }
    public function getNotifications() { return ['notifications' => $this->getState()['notifications']]; }
    public function getShadowPrices() { return $this->getState()['shadowPrices']; }
    public function getSettings() { return $this->getState()['profile']['settings'] ?? []; }
    public function getTeamEmail() { return $this->teamEmail; }
    public function getTeamDirectory() { return $this->teamDir; }

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
        $this->emitEvent('adjust_funds', ['amount' => $amount]);
    }

    public function setFunds($amount, $isStarting = false) {
        $this->emitEvent('set_funds', ['amount' => $amount, 'is_starting' => $isStarting]);
    }

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

    public function updateShadowPrices($prices) {
        $this->emitEvent('update_shadow_prices', $prices);
    }

    public function addProduction($data) { $this->emitEvent('add_production', $data); }

    public function addOffer($data) {
        $data['id'] = 'offer_' . time() . '_' . bin2hex(random_bytes(4));
        $this->emitEvent('add_offer', $data);
        return $data;
    }

    public function updateOffer($id, $updates) {
        $this->emitEvent('update_offer', ['id' => $id, 'updates' => $updates]);
    }

    public function removeOffer($id) {
        $this->emitEvent('remove_offer', ['id' => $id]);
    }

    public function addBuyOrder($data) {
        $data['id'] = 'buy_' . time() . '_' . bin2hex(random_bytes(4));
        $this->emitEvent('add_buy_order', $data);
        return $data;
    }

    public function updateBuyOrder($id, $updates) {
        // Simple implementation: just emit add_buy_order with merged data if needed, 
        // but better to have dedicated update event
        $this->emitEvent('update_buy_order', ['id' => $id, 'updates' => $updates]);
    }

    public function removeBuyOrder($id) {
        $this->emitEvent('remove_buy_order', ['id' => $id]);
    }

    public function addTransaction($data) { $this->emitEvent('add_transaction', $data); }

    public function addNotification($data) {
        $data['id'] = 'notif_' . time() . '_' . bin2hex(random_bytes(4));
        $this->emitEvent('add_notification', $data);
        return $data;
    }

    public function markNotificationsRead($ids = null) {
        $this->emitEvent('mark_notifications_read', ['ids' => $ids]);
    }

    public function updateSettings($settings) {
        $this->updateProfile(function($p) use ($settings) {
            $p['settings'] = array_merge($p['settings'] ?? [], $settings);
            return $p;
        });
    }

    public function getFullState() {
        return $this->getState();
    }
}