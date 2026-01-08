<?php
/**
 * WebSocket Helper - Sends signals from synchronous PHP to the async WS server
 */

class WS {
    /**
     * Push a message to the WebSocket server
     * 
     * @param string $type The message type (e.g., 'marketplace_updated')
     * @param array|null $recipients Optional array of user emails to target
     * @param array $payload Optional data to send
     */
    public static function push(string $type, ?array $recipients = null, array $payload = []) {
        $data = array_merge($payload, [
            'type' => $type,
            'recipients' => $recipients,
            'timestamp' => time()
        ]);

        $json = json_encode($data);
        
        // Use a simple non-blocking socket or curl to send to the local push API
        $ch = curl_init('http://127.0.0.1:8081');
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT_MS, 200); // Very short timeout - don't block the main process
        
        curl_exec($ch);
        curl_close($ch);
    }

    /**
     * Shortcut for marketplace refresh
     */
    public static function marketplaceUpdated() {
        self::push('marketplace_updated');
    }

    /**
     * Shortcut for inventory refresh (to specific users)
     */
    public static function refreshInventory(array $emails) {
        self::push('refresh_inventory', $emails);
    }

    /**
     * Shortcut for negotiation update
     */
    public static function refreshNegotiations(array $emails) {
        self::push('refresh_negotiations', $emails);
    }
}
