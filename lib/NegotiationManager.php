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

        $mappedNegotiations = [];
        foreach ($negotiations as $neg) {
            $neg['offers'] = $this->getNegotiationOffers($neg['id']);
            $mappedNegotiations[] = $this->mapNegotiation($neg);
        }

        return $mappedNegotiations;
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
    public function createNegotiation($initiatorId, $initiatorName, $responderId, $responderName, $chemical, $initialOffer, $sessionNumber = null, $type = 'buy', $adId = null) {
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
                  session_number, status, last_offer_by, ad_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                    $initiatorId,
                    $adId
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

                // Add notifications
                $iStorage->addNotification([
                    'type' => 'negotiation_started',
                    'message' => "Started a negotiation with $responderName for Chemical $chemical."
                ]);
                $rStorage->addNotification([
                    'type' => 'negotiation_started',
                    'message' => "$initiatorName started a negotiation with you for Chemical $chemical."
                ]);
            } catch (Exception $e) {
                error_log("NegotiationManager: Failed to emit events: " . $e->getMessage());
            }

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

        return $this->mapNegotiation($negotiation);
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
        if ($fromTeamId !== $negotiation['initiatorId'] && $fromTeamId !== $negotiation['responderId']) {
            throw new Exception('Unauthorized');
        }

        // Verify it's their turn (can't counter your own offer)
        if ($negotiation['lastOfferBy'] === $fromTeamId) {
            throw new Exception('Wait for other team to respond');
        }

        // Calculate heat info
        $heatIsHot = 0;
        $heatTotal = 0;

        try {
            require_once __DIR__ . '/TeamStorage.php';
            $iStorage = new TeamStorage($negotiation['initiatorId']);
            $rStorage = new TeamStorage($negotiation['responderId']);
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
                $otherTeamId = ($fromTeamId === $negotiation['initiatorId']) ? $negotiation['responderId'] : $negotiation['initiatorId'];
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

                // Add notifications
                $fromStorage->addNotification([
                    'type' => 'negotiation_counter',
                    'message' => "You sent a counter-offer to " . ($fromTeamId === $negotiation['initiatorId'] ? $negotiation['responderName'] : $negotiation['initiatorName']) . " for Chemical {$negotiation['chemical']}."
                ]);
                $otherStorage->addNotification([
                    'type' => 'negotiation_counter',
                    'message' => "$fromTeamName sent you a counter-offer for Chemical {$negotiation['chemical']}."
                ]);
            } catch (Exception $e) {
                error_log("NegotiationManager: Failed to emit counter-offer events: " . $e->getMessage());
            }

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
        if ($acceptingTeamId !== $negotiation['initiatorId'] && $acceptingTeamId !== $negotiation['responderId']) {
            throw new Exception('Unauthorized');
        }

        // Verify it's their turn (can only accept other team's offer)
        if ($negotiation['lastOfferBy'] === $acceptingTeamId) {
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
                $otherTeamId = ($acceptingTeamId === $negotiation['initiatorId']) ? $negotiation['responderId'] : $negotiation['initiatorId'];
                $otherTeamName = ($acceptingTeamId === $negotiation['initiatorId']) ? $negotiation['responderName'] : $negotiation['initiatorName'];
                $aStorage = new TeamStorage($acceptingTeamId);
                $oStorage = new TeamStorage($otherTeamId);

                $aStorage->emitEvent('close_negotiation', ['negotiationId' => $negotiationId, 'status' => 'accepted']);
                $oStorage->emitEvent('close_negotiation', ['negotiationId' => $negotiationId, 'status' => 'accepted']);

                // Add notifications for history
                $aStorage->addNotification([
                    'type' => 'trade_completed',
                    'message' => "Trade accepted! Negotiation with $otherTeamName for Chemical {$negotiation['chemical']} complete."
                ]);
                // Counterparty (oStorage) notification is handled by GlobalAggregator reflection
            } catch (Exception $e) {
                error_log("NegotiationManager: Failed to emit accept events: " . $e->getMessage());
            }

            // Remove associated advertisement and buy order if they exist
            if (!empty($negotiation['adId'])) {
                try {
                    require_once __DIR__ . '/AdvertisementManager.php';
                    // Determine who owned the ad
                    // If type was 'buy' from initiator, initiator posted it.
                    // If it was 'sell' from initiator, they were responding to a 'buy' ad from responder.
                    $adOwner = (($negotiation['type'] ?? 'buy') === 'buy') ? $negotiation['initiatorId'] : $negotiation['responderId'];

                    $adManager = new AdvertisementManager($adOwner);
                    
                    // 1. Remove the public advertisement event
                    $adManager->removeAdvertisement($negotiation['adId']);
                    error_log("NegotiationManager: Automatically removed advertisement {$negotiation['adId']} after acceptance.");

                    // 2. ALSO remove the corresponding buy order event for this chemical
                    try {
                        $ownerStorage = new TeamStorage($adOwner);
                        $buyOrdersData = $ownerStorage->getBuyOrders();
                        $buyOrders = $buyOrdersData['interests'] ?? [];

                        foreach ($buyOrders as $order) {
                            if ($order['chemical'] === $negotiation['chemical']) {
                                $ownerStorage->removeBuyOrder($order['id']);
                                error_log("NegotiationManager: Automatically removed buy order {$order['id']} for {$negotiation['chemical']} belonging to $adOwner.");
                                // We stop after removing one matching buy order
                                break; 
                            }
                        }
                    } catch (Exception $e) {
                        error_log("NegotiationManager: Failed to remove associated buy order: " . $e->getMessage());
                    }
                } catch (Exception $e) {
                    error_log("NegotiationManager: Failed to cleanup linked advertisement/buy-order: " . $e->getMessage());
                }
            }

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
        if ($rejectingTeamId !== $negotiation['initiatorId'] && $rejectingTeamId !== $negotiation['responderId']) {
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
                $otherTeamId = ($rejectingTeamId === $negotiation['initiatorId']) ? $negotiation['responderId'] : $negotiation['initiatorId'];
                $otherTeamName = ($rejectingTeamId === $negotiation['initiatorId']) ? $negotiation['responderName'] : $negotiation['initiatorName'];
                $rejectingTeamName = ($rejectingTeamId === $negotiation['initiatorId']) ? $negotiation['initiatorName'] : $negotiation['responderName'];
                
                $rStorage = new TeamStorage($rejectingTeamId);
                $oStorage = new TeamStorage($otherTeamId);

                $rStorage->emitEvent('close_negotiation', ['negotiationId' => $negotiationId, 'status' => 'rejected']);
                $oStorage->emitEvent('close_negotiation', ['negotiationId' => $negotiationId, 'status' => 'rejected']);

                // Add notifications for history
                $rStorage->addNotification([
                    'type' => 'negotiation_rejected',
                    'message' => "You cancelled the negotiation with $otherTeamName for Chemical {$negotiation['chemical']}."
                ]);
                $oStorage->addNotification([
                    'type' => 'negotiation_rejected',
                    'message' => "The negotiation for Chemical {$negotiation['chemical']} was cancelled by $rejectingTeamName."
                ]);
            } catch (Exception $e) {
                error_log("NegotiationManager: Failed to emit reject events: " . $e->getMessage());
            }

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

    /**
     * Map raw database row to frontend-friendly camelCase format
     */
    public function mapNegotiation($neg) {
        if (!$neg) return null;

        $mapped = [
            'id' => $neg['id'],
            'chemical' => $neg['chemical'],
            'type' => $neg['type'],
            'initiatorId' => $neg['initiator_id'] ?? null,
            'initiatorName' => $neg['initiator_name'] ?? null,
            'responderId' => $neg['responder_id'] ?? null,
            'responderName' => $neg['responder_name'] ?? null,
            'sessionNumber' => $neg['session_number'] ?? null,
            'status' => $neg['status'] ?? 'pending',
            'lastOfferBy' => $neg['last_offer_by'] ?? null,
            'adId' => $neg['ad_id'] ?? null,
            'createdAt' => $neg['created_at'] ?? null,
            'updatedAt' => $neg['updated_at'] ?? null,
            'offers' => []
        ];

        if (!empty($neg['offers'])) {
            foreach ($neg['offers'] as $offer) {
                $mapped['offers'][] = [
                    'fromTeamId' => $offer['from_team_id'] ?? null,
                    'fromTeamName' => $offer['from_team_name'] ?? null,
                    'quantity' => $offer['quantity'] ?? 0,
                    'price' => $offer['price'] ?? 0,
                    'createdAt' => $offer['created_at'] ?? null
                ];
            }
        }

        return $mapped;
    }
}
