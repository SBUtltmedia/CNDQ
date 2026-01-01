<?php
/**
 * GlobalAggregator - Aggregates state across all teams
 */
namespace NoM;

require_once __DIR__ . '/Aggregator.php';

class GlobalAggregator {
    private $teamsDir;

    public function __construct() {
        $this->teamsDir = __DIR__ . '/../../data/teams';
    }

    /**
     * Get the global state by aggregating all team states
     */
    public function aggregateAll(): array {
        $globalState = [
            'teams' => [],
            'allOffers' => [],
            'allBuyOrders' => [],
            'allTransactions' => [],
            'lastUpdate' => 0,
            'totalEvents' => 0
        ];

        $dirs = array_filter(glob($this->teamsDir . '/*'), 'is_dir');

        foreach ($dirs as $dir) {
            $state = Aggregator::aggregate($dir);
            $email = $state['profile']['email'];
            
            if (!$email) continue;

            $globalState['teams'][$email] = [
                'profile' => $state['profile'],
                'inventory' => $state['inventory']
            ];

            // Aggregated Offers
            foreach ($state['offers'] as $offer) {
                if (($offer['status'] ?? 'active') === 'active') {
                    $offer['sellerName'] = $state['profile']['teamName'];
                    $globalState['allOffers'][] = $offer;
                }
            }

            // Aggregated Buy Orders
            foreach ($state['buyOrders'] as $order) {
                if (($order['status'] ?? 'active') === 'active') {
                    $order['buyerName'] = $state['profile']['teamName'];
                    $globalState['allBuyOrders'][] = $order;
                }
            }

            $globalState['lastUpdate'] = max($globalState['lastUpdate'], $state['lastUpdate']);
            $globalState['totalEvents'] += $state['eventsProcessed'];
        }

        return $globalState;
    }
}
