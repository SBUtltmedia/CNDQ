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

    public function __construct() {
        $this->teamsDir = __DIR__ . '/../data/teams';

        if (!is_dir($this->teamsDir)) {
            mkdir($this->teamsDir, 0755, true);
        }
    }

    /**
     * Get list of all team emails
     * @return array List of team email addresses
     */
    public function getAllTeams() {
        $teams = [];

        if (!is_dir($this->teamsDir)) {
            return $teams;
        }

        $dirs = scandir($this->teamsDir);
        foreach ($dirs as $dir) {
            if ($dir === '.' || $dir === '..') {
                continue;
            }

            $teamPath = $this->teamsDir . '/' . $dir;
            if (is_dir($teamPath)) {
                try {
                    // Use TeamStorage to get profile (leverages cache)
                    // We need to extract the email from the directory name if we don't have it,
                    // but the directory name IS the safe email. 
                    // To be safe, we can try to find a way to get the real email.
                    // Actually, let's just look for cached_state.json first as an optimization.
                    $cacheFile = $teamPath . '/cached_state.json';
                    $profile = null;
                    
                    if (file_exists($cacheFile)) {
                        $cached = json_decode(file_get_contents($cacheFile), true);
                        $profile = $cached['profile'] ?? null;
                    }
                    
                    // Fallback to legacy profile.json if no cache or cache is incomplete
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
                } catch (Exception $e) {
                    continue;
                }
            }
        }

        // Sort by last active (most recent first)
        usort($teams, function($a, $b) {
            return $b['lastActive'] - $a['lastActive'];
        });

        return $teams;
    }

    /**
     * Get all active offers from all teams
     * @param string|null $chemical Filter by specific chemical (C, N, D, Q)
     * @return array Aggregated offers
     */
    public function getActiveOffers($chemical = null) {
        $allOffers = [];
        $teams = $this->getAllTeams();

        foreach ($teams as $teamInfo) {
            try {
                $storage = new TeamStorage($teamInfo['email']);
                $offerData = $storage->getOffersMade();

                // Check if offers key exists and is an array
                if (!isset($offerData['offers']) || !is_array($offerData['offers'])) {
                    continue;
                }

                foreach ($offerData['offers'] as $offer) {
                    // Only include active offers
                    if ($offer['status'] !== 'active') {
                        continue;
                    }

                    // Filter by chemical if specified
                    if ($chemical && $offer['chemical'] !== $chemical) {
                        continue;
                    }

                    // Add team info
                    $offer['sellerName'] = $teamInfo['teamName'];

                    $allOffers[] = $offer;
                }
            } catch (Exception $e) {
                // Skip teams with errors
                error_log("Error reading offers from team {$teamInfo['email']}: " . $e->getMessage());
                continue;
            }
        }

        return $allOffers;
    }

    /**
     * Get all active buy orders from all teams
     * @param string|null $chemical Filter by specific chemical (C, N, D, Q)
     * @return array Aggregated buy orders
     */
    public function getActiveBuyOrders($chemical = null) {
        $allBuyOrders = [];
        $teams = $this->getAllTeams();

        foreach ($teams as $teamInfo) {
            try {
                $storage = new TeamStorage($teamInfo['email']);
                $buyOrderData = $storage->getBuyOrders();

                // Check if interests key exists and is an array
                if (!isset($buyOrderData['interests']) || !is_array($buyOrderData['interests'])) {
                    continue;
                }

                foreach ($buyOrderData['interests'] as $buyOrder) {
                    // Only include active buy orders
                    if (($buyOrder['status'] ?? 'active') !== 'active') {
                        continue;
                    }

                    // Filter by chemical if specified
                    if ($chemical && $buyOrder['chemical'] !== $chemical) {
                        continue;
                    }

                    // Add team info
                    $buyOrder['buyerName'] = $teamInfo['teamName'];

                    $allBuyOrders[] = $buyOrder;
                }
            } catch (Exception $e) {
                // Skip teams with errors
                error_log("Error reading buy orders from team {$teamInfo['email']}: " . $e->getMessage());
                continue;
            }
        }

        return $allBuyOrders;
    }

    /**
     * Get offers grouped by chemical
     * @return array Offers grouped by C, N, D, Q
     */
    public function getOffersByChemical() {
        $grouped = [
            'C' => [],
            'N' => [],
            'D' => [],
            'Q' => []
        ];

        $allOffers = $this->getActiveOffers();

        foreach ($allOffers as $offer) {
            $chemical = $offer['chemical'] ?? null;
            if ($chemical && isset($grouped[$chemical])) {
                $grouped[$chemical][] = $offer;
            }
        }

        // Sort each group by price (lowest first - best deals for buyers)
        foreach ($grouped as $chem => &$offers) {
            usort($offers, function($a, $b) {
                $priceA = $a['minPrice'] ?? $a['price'] ?? PHP_INT_MAX;
                $priceB = $b['minPrice'] ?? $b['price'] ?? PHP_INT_MAX;
                return $priceA <=> $priceB;
            });
        }

        return $grouped;
    }

    /**
     * Get buy orders grouped by chemical
     * @return array Buy orders grouped by C, N, D, Q
     */
    public function getBuyOrdersByChemical() {
        $grouped = [
            'C' => [],
            'N' => [],
            'D' => [],
            'Q' => []
        ];

        $allBuyOrders = $this->getActiveBuyOrders();

        foreach ($allBuyOrders as $buyOrder) {
            $chemical = $buyOrder['chemical'] ?? null;
            if ($chemical && isset($grouped[$chemical])) {
                $grouped[$chemical][] = $buyOrder;
            }
        }

        // Sort each group by price (highest first - best deals for sellers)
        foreach ($grouped as $chem => &$buyOrders) {
            usort($buyOrders, function($a, $b) {
                $priceA = $a['maxPrice'] ?? $a['price'] ?? 0;
                $priceB = $b['maxPrice'] ?? $b['price'] ?? 0;
                return $priceB <=> $priceA; // Descending order
            });
        }

        return $grouped;
    }

    /**
     * Get a specific offer by ID
     * @param string $offerId The offer ID
     * @return array|null The offer data or null if not found
     */
    public function getOfferById($offerId) {
        $allOffers = $this->getActiveOffers();

        foreach ($allOffers as $offer) {
            if ($offer['id'] === $offerId) {
                return $offer;
            }
        }

        return null;
    }

    /**
     * Get a specific buy order by ID
     * @param string $buyOrderId The buy order ID
     * @return array|null The buy order data or null if not found
     */
    public function getBuyOrderById($buyOrderId) {
        $allBuyOrders = $this->getActiveBuyOrders();

        foreach ($allBuyOrders as $buyOrder) {
            if ($buyOrder['id'] === $buyOrderId) {
                return $buyOrder;
            }
        }

        return null;
    }

    /**
     * Get team statistics for leaderboard/scoreboard
     * @return array Team rankings
     */
    public function getTeamStatistics() {
        $stats = [];
        $teams = $this->getAllTeams();

        foreach ($teams as $teamInfo) {
            try {
                $storage = new TeamStorage($teamInfo['email']);
                $profile = $storage->getProfile();
                $inventory = $storage->getInventory();
                $transactions = $storage->getTransactions();

                $stats[] = [
                    'email' => $teamInfo['email'],
                    'teamName' => $teamInfo['teamName'],
                    'startingFunds' => $profile['startingFunds'] ?? 10000,
                    'currentFunds' => $profile['currentFunds'] ?? 10000,
                    'percentChange' => $this->calculatePercentChange(
                        $profile['startingFunds'] ?? 10000,
                        $profile['currentFunds'] ?? 10000
                    ),
                    'totalTrades' => count($transactions['transactions'] ?? []),
                    'inventory' => [
                        'C' => $inventory['C'] ?? 0,
                        'N' => $inventory['N'] ?? 0,
                        'D' => $inventory['D'] ?? 0,
                        'Q' => $inventory['Q'] ?? 0
                    ]
                ];
            } catch (Exception $e) {
                error_log("Error reading stats from team {$teamInfo['email']}: " . $e->getMessage());
                continue;
            }
        }

        // Sort by percent change (best performance first)
        usort($stats, function($a, $b) {
            return $b['percentChange'] <=> $a['percentChange'];
        });

        return $stats;
    }

    /**
     * Calculate percentage change
     */
    private function calculatePercentChange($starting, $current) {
        if ($starting == 0) {
            return 0;
        }
        return (($current - $starting) / $starting) * 100;
    }

    /**
     * Get recent trades across all teams (for activity feed)
     * @param int $limit Number of trades to return
     * @return array Recent trades
     */
    public function getRecentTrades($limit = 20) {
        $allTrades = [];
        $teams = $this->getAllTeams();

        foreach ($teams as $teamInfo) {
            try {
                $storage = new TeamStorage($teamInfo['email']);
                $transactions = $storage->getTransactions();

                foreach ($transactions['transactions'] as $txn) {
                    $txn['teamEmail'] = $teamInfo['email'];
                    $txn['teamName'] = $teamInfo['teamName'];
                    $allTrades[] = $txn;
                }
            } catch (Exception $e) {
                continue;
            }
        }

        // Sort by timestamp (most recent first)
        usort($allTrades, function($a, $b) {
            return ($b['timestamp'] ?? 0) - ($a['timestamp'] ?? 0);
        });

        return array_slice($allTrades, 0, $limit);
    }

    /**
     * Get marketplace summary statistics
     * @return array Summary data
     */
    public function getMarketplaceSummary() {
        $offers = $this->getActiveOffers();
        $teams = $this->getAllTeams();

        $summary = [
            'totalTeams' => count($teams),
            'activeOffers' => count($offers),
            'offersByChemical' => [
                'C' => 0,
                'N' => 0,
                'D' => 0,
                'Q' => 0
            ],
            'priceRanges' => [
                'C' => ['min' => null, 'max' => null],
                'N' => ['min' => null, 'max' => null],
                'D' => ['min' => null, 'max' => null],
                'Q' => ['min' => null, 'max' => null]
            ]
        ];

        foreach ($offers as $offer) {
            $chem = $offer['chemical'] ?? null;
            if (!$chem || !isset($summary['offersByChemical'][$chem])) {
                continue;
            }

            $summary['offersByChemical'][$chem]++;

            $price = $offer['minPrice'] ?? $offer['price'] ?? null;
            if ($price !== null) {
                $range = &$summary['priceRanges'][$chem];
                if ($range['min'] === null || $price < $range['min']) {
                    $range['min'] = $price;
                }
                if ($range['max'] === null || $price > $range['max']) {
                    $range['max'] = $price;
                }
            }
        }

        return $summary;
    }

    /**
     * Cache marketplace data to aggregated file (optional optimization)
     * This can be called periodically to reduce directory scanning
     */
    public function cacheMarketplaceData() {
        $cacheDir = __DIR__ . '/../data/marketplace';
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }

        $cacheFile = $cacheDir . '/active_offers.json';

        $data = [
            'offers' => $this->getActiveOffers(),
            'offersByChemical' => $this->getOffersByChemical(),
            'buyOrders' => $this->getActiveBuyOrders(),
            'buyOrdersByChemical' => $this->getBuyOrdersByChemical(),
            'summary' => $this->getMarketplaceSummary(),
            'cachedAt' => time()
        ];

        file_put_contents($cacheFile, json_encode($data, JSON_PRETTY_PRINT));

        return $data;
    }

    /**
     * Get cached marketplace data if recent enough
     * @param int $maxAge Maximum age in seconds (default 5 seconds)
     * @return array|null Cached data or null if stale
     */
    public function getCachedMarketplaceData($maxAge = 5) {
        $cacheFile = __DIR__ . '/../data/marketplace/active_offers.json';

        if (!file_exists($cacheFile)) {
            return null;
        }

        $cacheAge = time() - filemtime($cacheFile);
        if ($cacheAge > $maxAge) {
            return null;
        }

        $data = json_decode(file_get_contents($cacheFile), true);
        return $data;
    }
}
