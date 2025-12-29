<?php
/**
 * Negotiation Manager
 * Handles private negotiations between teams
 */

class NegotiationManager {
    private $dataDir;

    public function __construct() {
        $this->dataDir = __DIR__ . '/../data/negotiations';
        $this->ensureDataDirExists();
    }

    private function ensureDataDirExists() {
        if (!is_dir($this->dataDir)) {
            mkdir($this->dataDir, 0755, true);
        }
    }

    /**
     * Get all active negotiations for a team
     */
    public function getTeamNegotiations($teamEmail) {
        $negotiations = [];
        $files = glob($this->dataDir . '/negotiation_*.json');

        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);

            // Include if team is involved and negotiation is still active
            if (($data['initiatorId'] === $teamEmail || $data['responderId'] === $teamEmail)
                && $data['status'] === 'pending') {
                $negotiations[] = $data;
            }
        }

        return $negotiations;
    }

    /**
     * Create new negotiation
     */
    public function createNegotiation($initiatorId, $initiatorName, $responderId, $responderName, $chemical, $initialOffer, $sessionNumber = null) {
        $negotiationId = 'neg_' . time() . '_' . bin2hex(random_bytes(4));

        $negotiation = [
            'id' => $negotiationId,
            'chemical' => $chemical,
            'initiatorId' => $initiatorId,
            'initiatorName' => $initiatorName,
            'responderId' => $responderId,
            'responderName' => $responderName,
            'sessionNumber' => $sessionNumber,
            'offers' => [
                [
                    'fromTeamId' => $initiatorId,
                    'fromTeamName' => $initiatorName,
                    'quantity' => $initialOffer['quantity'],
                    'price' => $initialOffer['price'],
                    'createdAt' => time()
                ]
            ],
            'status' => 'pending',
            'lastOfferBy' => $initiatorId,
            'createdAt' => time(),
            'updatedAt' => time()
        ];

        $filePath = $this->dataDir . '/negotiation_' . $negotiationId . '.json';
        file_put_contents($filePath, json_encode($negotiation, JSON_PRETTY_PRINT));

        return $negotiation;
    }

    /**
     * Get negotiation by ID
     */
    public function getNegotiation($negotiationId) {
        $filePath = $this->dataDir . '/negotiation_' . $negotiationId . '.json';

        if (!file_exists($filePath)) {
            return null;
        }

        return json_decode(file_get_contents($filePath), true);
    }

    /**
     * Add counter-offer to negotiation
     */
    public function addCounterOffer($negotiationId, $fromTeamId, $fromTeamName, $quantity, $price) {
        $filePath = $this->dataDir . '/negotiation_' . $negotiationId . '.json';

        if (!file_exists($filePath)) {
            throw new Exception('Negotiation not found');
        }

        $negotiation = json_decode(file_get_contents($filePath), true);

        // Verify team is part of this negotiation
        if ($fromTeamId !== $negotiation['initiatorId'] && $fromTeamId !== $negotiation['responderId']) {
            throw new Exception('Unauthorized');
        }

        // Verify it's their turn (can't counter your own offer)
        if ($negotiation['lastOfferBy'] === $fromTeamId) {
            throw new Exception('Wait for other team to respond');
        }

        $negotiation['offers'][] = [
            'fromTeamId' => $fromTeamId,
            'fromTeamName' => $fromTeamName,
            'quantity' => $quantity,
            'price' => $price,
            'createdAt' => time()
        ];

        $negotiation['lastOfferBy'] = $fromTeamId;
        $negotiation['updatedAt'] = time();

        file_put_contents($filePath, json_encode($negotiation, JSON_PRETTY_PRINT));

        return $negotiation;
    }

    /**
     * Accept negotiation (execute trade)
     */
    public function acceptNegotiation($negotiationId, $acceptingTeamId) {
        $filePath = $this->dataDir . '/negotiation_' . $negotiationId . '.json';

        if (!file_exists($filePath)) {
            throw new Exception('Negotiation not found');
        }

        $negotiation = json_decode(file_get_contents($filePath), true);

        // Verify team is part of this negotiation
        if ($acceptingTeamId !== $negotiation['initiatorId'] && $acceptingTeamId !== $negotiation['responderId']) {
            throw new Exception('Unauthorized');
        }

        // Verify it's their turn (can only accept other team's offer)
        if ($negotiation['lastOfferBy'] === $acceptingTeamId) {
            throw new Exception('Cannot accept your own offer');
        }

        $negotiation['status'] = 'accepted';
        $negotiation['acceptedBy'] = $acceptingTeamId;
        $negotiation['acceptedAt'] = time();
        $negotiation['updatedAt'] = time();

        file_put_contents($filePath, json_encode($negotiation, JSON_PRETTY_PRINT));

        return $negotiation;
    }

    /**
     * Reject/Cancel negotiation
     */
    public function rejectNegotiation($negotiationId, $rejectingTeamId) {
        $filePath = $this->dataDir . '/negotiation_' . $negotiationId . '.json';

        if (!file_exists($filePath)) {
            throw new Exception('Negotiation not found');
        }

        $negotiation = json_decode(file_get_contents($filePath), true);

        // Verify team is part of this negotiation
        if ($rejectingTeamId !== $negotiation['initiatorId'] && $rejectingTeamId !== $negotiation['responderId']) {
            throw new Exception('Unauthorized');
        }

        $negotiation['status'] = 'rejected';
        $negotiation['rejectedBy'] = $rejectingTeamId;
        $negotiation['rejectedAt'] = time();
        $negotiation['updatedAt'] = time();

        file_put_contents($filePath, json_encode($negotiation, JSON_PRETTY_PRINT));

        return $negotiation;
    }

    /**
     * Clean up old negotiations (optional - for maintenance)
     */
    public function cleanupOldNegotiations($olderThanDays = 7) {
        $files = glob($this->dataDir . '/negotiation_*.json');
        $cutoffTime = time() - ($olderThanDays * 24 * 60 * 60);
        $deleted = 0;

        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);

            if ($data['updatedAt'] < $cutoffTime && in_array($data['status'], ['accepted', 'rejected'])) {
                unlink($file);
                $deleted++;
            }
        }

        return $deleted;
    }
}
