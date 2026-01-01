<?php
/**
 * NoM Aggregator - Reduces a stream of events into a state object.
 * Simplified for development state: focuses on event stream.
 */
namespace NoM;

class Aggregator {
    /**
     * Aggregate events from a specific directory
     */
    public static function aggregate(string $dir): array {
        $state = self::getInitialState($dir);
        
        $events = glob("$dir/event_*.json");
        sort($events);

        foreach ($events as $file) {
            $event = json_decode(file_get_contents($file), true);
            if ($event) {
                $state = self::reduce($state, $event);
            }
        }

        return $state;
    }

    /**
     * Initial state for a team.
     */
    private static function getInitialState(string $dir): array {
        $state = [
            'profile' => ['email' => '', 'teamName' => '', 'currentFunds' => 0, 'startingFunds' => 0, 'settings' => []],
            'inventory' => ['C' => 0, 'N' => 0, 'D' => 0, 'Q' => 0, 'updatedAt' => 0, 'transactionsSinceLastShadowCalc' => 0],
            'productions' => [], 'offers' => [], 'buyOrders' => [], 'ads' => [], 'notifications' => [],
            'shadowPrices' => ['C' => 0, 'N' => 0, 'D' => 0, 'Q' => 0, 'calculatedAt' => 0],
            'lastUpdate' => 0, 'eventsProcessed' => 0
        ];

        // Minimal legacy fallback for dev state
        if (file_exists("$dir/profile.json")) {
            $profile = json_decode(file_get_contents("$dir/profile.json"), true);
            if ($profile) $state['profile'] = array_merge($state['profile'], $profile);
        }
        if (file_exists("$dir/inventory.json")) {
            $inventory = json_decode(file_get_contents("$dir/inventory.json"), true);
            if ($inventory) {
                foreach ($inventory as $k => $v) {
                    if (in_array($k, ['C', 'N', 'D', 'Q'])) $inventory[$k] = round($v, 4);
                }
                $state['inventory'] = array_merge($state['inventory'], $inventory);
            }
        }

        return $state;
    }

    /**
     * Reducer function
     */
    public static function reduce(array $state, array $event): array {
        $type = $event['type'] ?? 'unknown';
        $payload = $event['payload'] ?? [];
        $timestamp = $event['timestamp'] ?? time();

        $state['lastUpdate'] = max($state['lastUpdate'], $timestamp);
        $state['eventsProcessed']++;

        switch ($type) {
            case 'init':
                if (isset($payload['profile'])) $state['profile'] = array_merge($state['profile'], $payload['profile']);
                if (isset($payload['inventory'])) $state['inventory'] = array_merge($state['inventory'], $payload['inventory']);
                break;

            case 'update_profile':
                $state['profile'] = array_merge($state['profile'], $payload);
                break;

            case 'adjust_chemical':
                $chem = $payload['chemical'];
                if (isset($state['inventory'][$chem])) {
                    $state['inventory'][$chem] = max(0, round($state['inventory'][$chem] + $payload['amount'], 4));
                    $state['inventory']['updatedAt'] = $timestamp;
                }
                break;

            case 'set_funds':
                $state['profile']['currentFunds'] = $payload['amount'];
                if ($payload['is_starting'] ?? false) $state['profile']['startingFunds'] = $payload['amount'];
                break;

            case 'add_production': $state['productions'][] = $payload; break;
            case 'add_offer': $state['offers'][] = $payload; break;
            case 'remove_offer':
                $state['offers'] = array_values(array_filter($state['offers'], fn($o) => $o['id'] !== $payload['id']));
                break;
            case 'add_buy_order': $state['buyOrders'][] = $payload; break;
            case 'remove_buy_order':
                $state['buyOrders'] = array_values(array_filter($state['buyOrders'], fn($o) => $o['id'] !== $payload['id']));
                break;
            case 'add_ad': $state['ads'][] = $payload; break;
            case 'remove_ad':
                $state['ads'] = array_values(array_filter($state['ads'], fn($a) => $a['id'] !== $payload['id']));
                break;
            case 'add_notification':
                $state['notifications'][] = array_merge($payload, ['timestamp' => $timestamp, 'read' => false]);
                if (count($state['notifications']) > 50) array_shift($state['notifications']);
                break;
            case 'update_shadow_prices':
                $state['shadowPrices'] = array_merge($state['shadowPrices'], $payload, ['calculatedAt' => $timestamp]);
                break;
        }

        return $state;
    }
}