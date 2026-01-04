<?php
/**
 * Negotiation Manager - SQLite-based negotiation storage
 *
 * Handles private negotiations between teams using database storage.
 * Migrated from file-based to SQLite for production scalability.
 */

require_once __DIR__ . '/Database.php';

class NegotiationManager {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    /**
     * Get all active negotiations for a team
     */
    public function getTeamNegotiations($teamEmail) {
        $negotiations = $this->db->query(
            'SELECT n.*, COUNT(o.id) as offer_count
             FROM negotiations n
             LEFT JOIN negotiation_offers o ON n.id = o.negotiation_id
             WHERE (n.initiator_id = ? OR n.responder_id = ?)
               AND n.status = ?
             GROUP BY n.id
             ORDER BY n.updated_at DESC',
            [$teamEmail, $teamEmail, 'pending']
        );

        // Fetch offers for each negotiation
        foreach ($negotiations as &$neg) {
            $neg['offers'] = $this->getNegotiationOffers($neg['id']);
        }

        return $negotiations;
    }

    /**
     * Get offers for a negotiation
     */
    private function getNegotiationOffers($negotiationId) {
        return $this->db->query(
            'SELECT from_team_id, from_team_name, quantity, price, heat_is_hot, heat_total, created_at
             FROM negotiation_offers
             WHERE negotiation_id = ?
             ORDER BY created_at ASC',
            [$negotiationId]
        );
    }

    /**
     * Create new negotiation
     */
    public function createNegotiation($initiatorId, $initiatorName, $responderId, $responderName, $chemical, $initialOffer, $sessionNumber = null, $type = 'buy') {
        $negotiationId = 'neg_' . time() . '_' . bin2hex(random_bytes(4));

        $initiatorName = $initiatorName ?: $initiatorId;
        $responderName = $responderName ?: $responderId;

        // Calculate heat info
        $heatIsHot = 0;
        $heatTotal = 0;

        try {
            require_once __DIR__ . '/TeamStorage.php';
            $iStorage = new TeamStorage($initiatorId);
            $rStorage = new TeamStorage($responderId);
            $iShadow = $iStorage->getShadowPrices()[$chemical] ?? 0;
            $rShadow = $rStorage->getShadowPrices()[$chemical] ?? 0;

            // Determine who is buyer and who is seller
            $iIsBuyer = ($type === 'buy');
            $iGain = $iIsBuyer ? ($iShadow - $initialOffer['price']) : ($initialOffer['price'] - $iShadow);
            $rGain = $iIsBuyer ? ($initialOffer['price'] - $rShadow) : ($rShadow - $initialOffer['price']);

            $heatIsHot = ($iGain > 0 && $rGain > 0) ? 1 : 0;
            $heatTotal = ($iGain + $rGain) * $initialOffer['quantity'];
        } catch (Exception $e) {}

        // Start transaction
        $this->db->beginTransaction();
        try {
            // Insert negotiation
            $this->db->insert(
                'INSERT INTO negotiations
                 (id, chemical, type, initiator_id, initiator_name, responder_id, responder_name,
                  session_number, status, last_offer_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $negotiationId,
                    $chemical,
                    $type,
                    $initiatorId,
                    $initiatorName,
                    $responderId,
                    $responderName,
                    $sessionNumber,
                    'pending',
                    $initiatorId
                ]
            );

            // Insert first offer
            $this->db->insert(
                'INSERT INTO negotiation_offers
                 (negotiation_id, from_team_id, from_team_name, quantity, price, heat_is_hot, heat_total)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    $negotiationId,
                    $initiatorId,
                    $initiatorName,
                    $initialOffer['quantity'],
                    $initialOffer['price'],
                    $heatIsHot,
                    $heatTotal
                ]
            );

            // Emit events to both parties
            try {
                require_once __DIR__ . '/TeamStorage.php';
                $iStorage = new TeamStorage($initiatorId);
                $rStorage = new TeamStorage($responderId);

                $iStorage->emitEvent('initiate_negotiation', [
                    'negotiationId' => $negotiationId,
                    'chemical' => $chemical,
                    'counterparty' => $responderId,
                    'role' => 'initiator'
                ]);
                $rStorage->emitEvent('initiate_negotiation', [
                    'negotiationId' => $negotiationId,
                    'chemical' => $chemical,
                    'counterparty' => $initiatorId,
                    'role' => 'responder'
                ]);
            } catch (Exception $e) {}

            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }

        return $this->getNegotiation($negotiationId);
    }

    /**
     * Get negotiation by ID
     */
    public function getNegotiation($negotiationId) {
        $negotiation = $this->db->queryOne(
            'SELECT * FROM negotiations WHERE id = ?',
            [$negotiationId]
        );

        if (!$negotiation) {
            return null;
        }

        // Fetch offers
        $negotiation['offers'] = $this->getNegotiationOffers($negotiationId);

        return $negotiation;
    }

    /**
     * Add counter-offer to negotiation
     */
    public function addCounterOffer($negotiationId, $fromTeamId, $fromTeamName, $quantity, $price) {
        $negotiation = $this->getNegotiation($negotiationId);

        if (!$negotiation) {
            throw new Exception('Negotiation not found');
        }

        // Verify team is part of this negotiation
        if ($fromTeamId !== $negotiation['initiator_id'] && $fromTeamId !== $negotiation['responder_id']) {
            throw new Exception('Unauthorized');
        }

        // Verify it's their turn (can't counter your own offer)
        if ($negotiation['last_offer_by'] === $fromTeamId) {
            throw new Exception('Wait for other team to respond');
        }

        // Calculate heat info
        $heatIsHot = 0;
        $heatTotal = 0;

        try {
            require_once __DIR__ . '/TeamStorage.php';
            $iStorage = new TeamStorage($negotiation['initiator_id']);
            $rStorage = new TeamStorage($negotiation['responder_id']);
            $iShadow = $iStorage->getShadowPrices()[$negotiation['chemical']] ?? 0;
            $rShadow = $rStorage->getShadowPrices()[$negotiation['chemical']] ?? 0;

            $iIsBuyer = ($negotiation['type'] === 'buy');
            $iGain = $iIsBuyer ? ($iShadow - $price) : ($price - $iShadow);
            $rGain = $iIsBuyer ? ($price - $rShadow) : ($rShadow - $price);

            $heatIsHot = ($iGain > 0 && $rGain > 0) ? 1 : 0;
            $heatTotal = ($iGain + $rGain) * $quantity;
        } catch (Exception $e) {}

        // Start transaction
        $this->db->beginTransaction();
        try {
            // Insert offer
            $this->db->insert(
                'INSERT INTO negotiation_offers
                 (negotiation_id, from_team_id, from_team_name, quantity, price, heat_is_hot, heat_total)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    $negotiationId,
                    $fromTeamId,
                    $fromTeamName,
                    $quantity,
                    $price,
                    $heatIsHot,
                    $heatTotal
                ]
            );

            // Update negotiation
            $this->db->execute(
                'UPDATE negotiations
                 SET last_offer_by = ?, updated_at = ?
                 WHERE id = ?',
                [$fromTeamId, time(), $negotiationId]
            );

            // Emit events to both parties
            try {
                $otherTeamId = ($fromTeamId === $negotiation['initiator_id']) ? $negotiation['responder_id'] : $negotiation['initiator_id'];
                $fromStorage = new TeamStorage($fromTeamId);
                $otherStorage = new TeamStorage($otherTeamId);

                $offerData = [
                    'from_team_id' => $fromTeamId,
                    'from_team_name' => $fromTeamName,
                    'quantity' => $quantity,
                    'price' => $price,
                    'heat' => [
                        'isHot' => (bool)$heatIsHot,
                        'total' => $heatTotal
                    ]
                ];

                $fromStorage->emitEvent('add_counter_offer', [
                    'negotiationId' => $negotiationId,
                    'isFromMe' => true,
                    'offer' => $offerData
                ]);
                $otherStorage->emitEvent('add_counter_offer', [
                    'negotiationId' => $negotiationId,
                    'isFromMe' => false,
                    'offer' => $offerData
                ]);
            } catch (Exception $e) {}

            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }

        return $this->getNegotiation($negotiationId);
    }

    /**
     * Accept negotiation (execute trade)
     */
    public function acceptNegotiation($negotiationId, $acceptingTeamId) {
        $negotiation = $this->getNegotiation($negotiationId);

        if (!$negotiation) {
            throw new Exception('Negotiation not found');
        }

        // Verify team is part of this negotiation
        if ($acceptingTeamId !== $negotiation['initiator_id'] && $acceptingTeamId !== $negotiation['responder_id']) {
            throw new Exception('Unauthorized');
        }

        // Verify it's their turn (can only accept other team's offer)
        if ($negotiation['last_offer_by'] === $acceptingTeamId) {
            throw new Exception('Cannot accept your own offer');
        }

        // Start transaction
        $this->db->beginTransaction();
        try {
            // Update negotiation
            $this->db->execute(
                'UPDATE negotiations
                 SET status = ?, accepted_by = ?, accepted_at = ?, updated_at = ?
                 WHERE id = ?',
                ['accepted', $acceptingTeamId, time(), time(), $negotiationId]
            );

            // Emit events to both parties
            try {
                $otherTeamId = ($acceptingTeamId === $negotiation['initiator_id']) ? $negotiation['responder_id'] : $negotiation['initiator_id'];
                $aStorage = new TeamStorage($acceptingTeamId);
                $oStorage = new TeamStorage($otherTeamId);

                $aStorage->emitEvent('close_negotiation', ['negotiationId' => $negotiationId, 'status' => 'accepted']);
                $oStorage->emitEvent('close_negotiation', ['negotiationId' => $negotiationId, 'status' => 'accepted']);
            } catch (Exception $e) {}

            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }

        return $this->getNegotiation($negotiationId);
    }

    /**
     * Reject/Cancel negotiation
     */
    public function rejectNegotiation($negotiationId, $rejectingTeamId) {
        $negotiation = $this->getNegotiation($negotiationId);

        if (!$negotiation) {
            throw new Exception('Negotiation not found');
        }

        // Verify team is part of this negotiation
        if ($rejectingTeamId !== $negotiation['initiator_id'] && $rejectingTeamId !== $negotiation['responder_id']) {
            throw new Exception('Unauthorized');
        }

        // Start transaction
        $this->db->beginTransaction();
        try {
            // Update negotiation
            $this->db->execute(
                'UPDATE negotiations
                 SET status = ?, rejected_by = ?, rejected_at = ?, updated_at = ?
                 WHERE id = ?',
                ['rejected', $rejectingTeamId, time(), time(), $negotiationId]
            );

            // Emit events to both parties
            try {
                $otherTeamId = ($rejectingTeamId === $negotiation['initiator_id']) ? $negotiation['responder_id'] : $negotiation['initiator_id'];
                $rStorage = new TeamStorage($rejectingTeamId);
                $oStorage = new TeamStorage($otherTeamId);

                $rStorage->emitEvent('close_negotiation', ['negotiationId' => $negotiationId, 'status' => 'rejected']);
                $oStorage->emitEvent('close_negotiation', ['negotiationId' => $negotiationId, 'status' => 'rejected']);
            } catch (Exception $e) {}

            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollback();
            throw $e;
        }

        return $this->getNegotiation($negotiationId);
    }

    /**
     * Clean up old negotiations (optional - for maintenance)
     */
    public function cleanupOldNegotiations($olderThanDays = 7) {
        $cutoffTime = time() - ($olderThanDays * 24 * 60 * 60);

        $deleted = $this->db->execute(
            'DELETE FROM negotiations
             WHERE updated_at < ?
               AND status IN (?, ?)',
            [$cutoffTime, 'accepted', 'rejected']
        );

        return $deleted;
    }
}
