<?php
/**
 * MarketplaceAggregator - Scans all team directories and builds marketplace view
 *
 * This class aggregates data from multiple teams without creating bottlenecks.
 * It reads from team folders but never writes to them.
 */

require_once __DIR__ . '/TeamStorage.php';

class MarketplaceAggregator {
    private $teamsDir;
    private $sharedEventsDir;

    public function __construct() {
        $this->teamsDir = __DIR__ . '/../data/teams';
        $this->sharedEventsDir = __DIR__ . '/../data/marketplace/events';

        if (!is_dir($this->teamsDir)) {
            @mkdir($this->teamsDir, 0755, true);
        }
        
        if (!is_dir($this->sharedEventsDir)) {
            @mkdir($this->sharedEventsDir, 0755, true);
        }
    }

    /**
     * Get list of all team emails (Slow O(N) scan, used for stats)
     */
    public function getAllTeams() {
        $teams = [];
        if (!is_dir($this->teamsDir)) return $teams;

        $dirs = scandir($this->teamsDir);
        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..') continue;
            $teamPath = $this->teamsDir . '/' . $dir;
            if (is_dir($teamPath)) {
                try {
                    $cacheFile = $teamPath . '/cached_state.json';
                    $profile = null;
                    if (file_exists($cacheFile)) {
                        $cached = json_decode(file_get_contents($cacheFile), true);
                        $profile = $cached['profile'] ?? null;
                    }
                    if (!$profile) {
                        $profileFile = $teamPath . '/profile.json';
                        if (file_exists($profileFile)) {
                            $profile = json_decode(file_get_contents($profileFile), true);
                        }
                    }
                    if ($profile && isset($profile['email'])) {
                        $teams[] = [
                            'email' => $profile['email'],
                            'teamName' => $profile['teamName'] ?? $profile['email'],
                            'lastActive' => $profile['lastActive'] ?? 0
                        ];
                    }
                } catch (Exception $e) { continue; }
            }
        }
        usort($teams, fn($a, $b) => $b['lastActive'] - $a['lastActive']);
        return $teams;
    }

    /**
     * Get all active offers (Fast O(E) scan from shared log)
     */
    public function getActiveOffers($chemical = null) {
        $data = $this->getAggregatedFromSharedLog();
        $offers = $data['offers'];
        if ($chemical) {
            $offers = array_values(array_filter($offers, fn($o) => ($o['chemical'] ?? '') === $chemical));
        }
        return $offers;
    }

    /**
     * Get all active buy orders (Fast O(E) scan from shared log)
     */
    public function getActiveBuyOrders($chemical = null) {
        $data = $this->getAggregatedFromSharedLog();
        $buyOrders = $data['buyOrders'];
        if ($chemical) {
            $buyOrders = array_values(array_filter($buyOrders, fn($o) => ($o['chemical'] ?? '') === $chemical));
        }
        return $buyOrders;
    }

    public function getOffersByChemical() {
        $grouped = ['C' => [], 'N' => [], 'D' => [], 'Q' => []];
        foreach ($this->getActiveOffers() as $offer) {
            $chem = $offer['chemical'] ?? null;
            if ($chem && isset($grouped[$chem])) $grouped[$chem][] = $offer;
        }
        foreach ($grouped as &$offers) {
            usort($offers, function($a, $b) {
                return ($a['minPrice'] ?? $a['price'] ?? 0) <=> ($b['minPrice'] ?? $b['price'] ?? 0);
            });
        }
        return $grouped;
    }

    public function getBuyOrdersByChemical() {
        $grouped = ['C' => [], 'N' => [], 'D' => [], 'Q' => []];
        foreach ($this->getActiveBuyOrders() as $order) {
            $chem = $order['chemical'] ?? null;
            if ($chem && isset($grouped[$chem])) $grouped[$chem][] = $order;
        }
        foreach ($grouped as &$orders) {
            usort($orders, function($a, $b) {
                return ($b['maxPrice'] ?? $b['price'] ?? 0) <=> ($a['maxPrice'] ?? $a['price'] ?? 0);
            });
        }
        return $grouped;
    }

    public function getOfferById($offerId) {
        foreach ($this->getActiveOffers() as $offer) {
            if ($offer['id'] === $offerId) return $offer;
        }
        return null;
    }

    public function getBuyOrderById($buyOrderId) {
        foreach ($this->getActiveBuyOrders() as $order) {
            if ($order['id'] === $buyOrderId) return $order;
        }
        return null;
    }

    /**
     * Aggregates marketplace from shared log.
     */
    public function getAggregatedFromSharedLog() {
        if (!is_dir($this->sharedEventsDir)) {
            return ['offers' => [], 'buyOrders' => [], 'ads' => []];
        }

        $events = glob("$this->sharedEventsDir/event_*.json");
        if (!$events) {
            return ['offers' => [], 'buyOrders' => [], 'ads' => []];
        }
        sort($events);

        $offers = [];
        $buyOrders = [];
        $ads = [];

        foreach ($events as $file) {
            $event = json_decode(file_get_contents($file), true);
            if (!$event) continue;

            $type = $event['type'];
            $payload = $event['payload'];
            $teamId = $event['teamId'] ?? 'unknown';
            $teamName = $event['teamName'] ?? $teamId;

            switch ($type) {
                case 'add_offer':
                    $payload['teamId'] = $teamId;
                    $payload['sellerName'] = $teamName;
                    $offers[$payload['id']] = $payload;
                    break;
                case 'remove_offer':
                    unset($offers[$payload['id']]);
                    break;
                case 'update_offer':
                    if (isset($offers[$payload['id']])) {
                        $offers[$payload['id']] = array_merge($offers[$payload['id']], $payload['updates']);
                    }
                    break;
                case 'add_buy_order':
                    $payload['teamId'] = $teamId;
                    $payload['buyerName'] = $teamName;
                    $buyOrders[$payload['id']] = $payload;
                    break;
                case 'remove_buy_order':
                    unset($buyOrders[$payload['id']]);
                    break;
                case 'update_buy_order':
                    if (isset($buyOrders[$payload['id']])) {
                        $buyOrders[$payload['id']] = array_merge($buyOrders[$payload['id']], $payload['updates']);
                    }
                    break;
                case 'add_ad':
                    $payload['teamId'] = $teamId;
                    $payload['teamName'] = $teamName;
                    $ads[$payload['id']] = $payload;
                    break;
                case 'remove_ad':
                    unset($ads[$payload['id']]);
                    break;
            }
        }

        return ['offers' => array_values($offers), 'buyOrders' => array_values($buyOrders), 'ads' => array_values($ads)];
    }

    /**
     * Get team statistics (Still slow O(N) scan)
     */
    public function getTeamStatistics() {
        $stats = [];
        $teams = $this->getAllTeams();
        foreach ($teams as $teamInfo) {
            try {
                $storage = new TeamStorage($teamInfo['email']);
                $state = $storage->getState();
                $stats[] = [
                    'email' => $teamInfo['email'],
                    'teamName' => $state['profile']['teamName'] ?? $teamInfo['teamName'],
                    'startingFunds' => $state['profile']['startingFunds'] ?? 0,
                    'currentFunds' => $state['profile']['currentFunds'] ?? 0,
                    'percentChange' => $this->calculatePercentChange($state['profile']['startingFunds'] ?? 0, $state['profile']['currentFunds'] ?? 0),
                    'totalTrades' => count($state['transactions'] ?? []),
                    'inventory' => $state['inventory']
                ];
            } catch (Exception $e) { continue; }
        }
        usort($stats, fn($a, $b) => $b['percentChange'] <=> $a['percentChange']);
        return $stats;
    }

    private function calculatePercentChange($starting, $current) {
        return ($starting == 0) ? 0 : (($current - $starting) / $starting) * 100;
    }

    public function getRecentTrades($limit = 20) {
        // This is still slow, but we can optimize it later if needed by sharing transaction events.
        $allTrades = [];
        $teams = $this->getAllTeams();
        foreach ($teams as $teamInfo) {
            try {
                $storage = new TeamStorage($teamInfo['email']);
                $txns = $storage->getTransactions()['transactions'] ?? [];
                foreach ($txns as $txn) {
                    $txn['teamEmail'] = $teamInfo['email'];
                    $txn['teamName'] = $teamInfo['teamName'];
                    $allTrades[] = $txn;
                }
            } catch (Exception $e) { continue; }
        }
        usort($allTrades, fn($a, $b) => ($b['timestamp'] ?? 0) - ($a['timestamp'] ?? 0));
        return array_slice($allTrades, 0, $limit);
    }
}