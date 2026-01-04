<?php
/**
 * User-Pair Negotiation Manager
 *
 * Implements the NoM-compliant negotiation system using isolated user-pair namespaces.
 * See: GeminiArtifacts/UserPairNegotiation.md
 *
 * Philosophy:
 * - Each negotiation exists in a namespace owned by the initiator
 * - Responder gets a symlink to the namespace
 * - Each user writes ONLY their own state file (atomic isolation)
 * - Polling detects agreement when both agreement_keys match
 * - Transactions created atomically, negotiation becomes ephemeral
 */

require_once __DIR__ . '/fileHelpers.php';

class UserPairNegotiationManager {
    private $dataRoot;

    public function __construct($dataRoot = null) {
        $this->dataRoot = $dataRoot ?? __DIR__ . '/../data/teams';
    }

    /**
     * Create a new negotiation namespace
     *
     * @param string $initiator Email of user who initiated (posted order)
     * @param string $responder Email of user who responded
     * @param string $chemical Chemical type (C, N, D, Q)
     * @param array $initialOffer Initial offer terms
     * @return string Negotiation ID
     */
    public function createNegotiation($initiator, $responder, $chemical, $initialOffer) {
        $timestamp = time();
        $negotiationId = $this->buildNegotiationId($initiator, $responder, $chemical, $timestamp);

        // Create namespace in initiator's directory
        $initiatorNegPath = $this->getNegotiationPath($initiator, $negotiationId);

        if (!file_exists($initiatorNegPath)) {
            mkdir($initiatorNegPath, 0755, true);
        }

        // Create initiator's state file
        $this->updateUserState($initiator, $negotiationId, [
            'role' => $initialOffer['role'] ?? 'buyer',
            'chemical' => $chemical,
            'offer' => $initialOffer,
            'status' => 'pending'
        ]);

        // Create symlink in responder's directory
        $responderNegBase = $this->getUserDir($responder) . '/negotiations';
        if (!file_exists($responderNegBase)) {
            mkdir($responderNegBase, 0755, true);
        }

        $responderSymlink = $responderNegBase . '/' . $negotiationId;
        $targetPath = realpath($initiatorNegPath);

        // Create relative symlink on Unix, or copy on Windows
        if (DIRECTORY_SEPARATOR === '/') {
            // Unix: use relative symlink
            $relativePath = $this->getRelativePath($responderSymlink, $targetPath);
            symlink($relativePath, $responderSymlink);
        } else {
            // Windows: create junction or just use absolute path symlink
            // Note: Windows symlinks require admin rights, so we document this
            symlink($targetPath, $responderSymlink);
        }

        return $negotiationId;
    }

    /**
     * Update a user's state in a negotiation
     *
     * @param string $user Email of user
     * @param string $negotiationId Negotiation identifier
     * @param array $stateData State information (offer, status, etc.)
     */
    public function updateUserState($user, $negotiationId, $stateData) {
        $userPrefix = $this->emailPrefix($user);
        $negotiationPath = $this->findNegotiationPath($negotiationId);

        if (!$negotiationPath) {
            throw new Exception("Negotiation $negotiationId not found");
        }

        $stateFile = $negotiationPath . "/{$userPrefix}_state.json";

        $state = [
            'user' => $user,
            'role' => $stateData['role'] ?? 'unknown',
            'chemical' => $stateData['chemical'] ?? '',
            'offer' => $stateData['offer'] ?? [],
            'status' => $stateData['status'] ?? 'pending',
            'last_updated' => time()
        ];

        // Generate agreement key if status is 'agreed'
        if ($state['status'] === 'agreed') {
            $state['agreement_key'] = $this->generateAgreementKey($state['offer']);
        }

        atomicWriteJSON($stateFile, $state);
    }

    /**
     * Get current state of a negotiation
     *
     * @param string $negotiationId Negotiation identifier
     * @return array Both users' states
     */
    public function getNegotiationState($negotiationId) {
        $negotiationPath = $this->findNegotiationPath($negotiationId);

        if (!$negotiationPath) {
            return null;
        }

        $stateFiles = glob($negotiationPath . '/*_state.json');
        $states = [];

        foreach ($stateFiles as $file) {
            $state = json_decode(file_get_contents($file), true);
            if ($state) {
                $states[$state['user']] = $state;
            }
        }

        return $states;
    }

    /**
     * Poll all negotiations for agreements
     * Called by cron or periodic task
     *
     * @return array List of negotiations that reached agreement
     */
    public function pollForAgreements() {
        $agreements = [];
        $allUsers = glob($this->dataRoot . '/*@*', GLOB_ONLYDIR);

        foreach ($allUsers as $userDir) {
            $negotiations = glob($userDir . '/negotiations/*', GLOB_ONLYDIR);

            foreach ($negotiations as $negPath) {
                // Skip symlinks - only process from initiator's perspective
                if (is_link($negPath)) {
                    continue;
                }

                $stateFiles = glob($negPath . '/*_state.json');

                if (count($stateFiles) === 2) {
                    $states = [];
                    foreach ($stateFiles as $file) {
                        $state = json_decode(file_get_contents($file), true);
                        if ($state) {
                            $states[] = $state;
                        }
                    }

                    // Check for matching agreement keys
                    if (count($states) === 2 &&
                        isset($states[0]['agreement_key']) &&
                        isset($states[1]['agreement_key']) &&
                        $states[0]['agreement_key'] === $states[1]['agreement_key']) {

                        $negotiationId = basename($negPath);
                        $agreements[] = $negotiationId;

                        // Create transactions
                        $this->createTransactionsFromAgreement($negotiationId, $states);

                        // Cleanup ephemeral negotiation
                        $this->cleanupNegotiation($negotiationId);
                    }
                }
            }
        }

        return $agreements;
    }

    /**
     * Create transaction files from agreed negotiation
     *
     * @param string $negotiationId Negotiation identifier
     * @param array $states Both users' states
     */
    private function createTransactionsFromAgreement($negotiationId, $states) {
        $buyer = $this->findByRole($states, 'buyer');
        $seller = $this->findByRole($states, 'seller');

        if (!$buyer || !$seller) {
            error_log("Cannot create transactions: missing buyer or seller in $negotiationId");
            return;
        }

        $terms = $buyer['offer'];
        $timestamp = time();

        // Create buyer transaction
        $buyerTxn = [
            'type' => 'buy',
            'chemical' => $terms['chemical'] ?? $buyer['chemical'],
            'price' => $terms['price'],
            'quantity' => $terms['quantity'],
            'counterparty' => $seller['user'],
            'negotiation_id' => $negotiationId,
            'timestamp' => $timestamp,
            'settled' => false
        ];

        $buyerTxnPath = $this->getUserDir($buyer['user']) . '/transactions/' .
                        $timestamp . "_buy_{$buyerTxn['chemical']}_from_" .
                        $this->emailPrefix($seller['user']) . '.json';

        $this->ensureDir(dirname($buyerTxnPath));
        atomicWriteJSON($buyerTxnPath, $buyerTxn);

        // Create seller transaction
        $sellerTxn = [
            'type' => 'sell',
            'chemical' => $terms['chemical'] ?? $seller['chemical'],
            'price' => $terms['price'],
            'quantity' => $terms['quantity'],
            'counterparty' => $buyer['user'],
            'negotiation_id' => $negotiationId,
            'timestamp' => $timestamp,
            'settled' => false
        ];

        $sellerTxnPath = $this->getUserDir($seller['user']) . '/transactions/' .
                         $timestamp . "_sell_{$sellerTxn['chemical']}_to_" .
                         $this->emailPrefix($buyer['user']) . '.json';

        $this->ensureDir(dirname($sellerTxnPath));
        atomicWriteJSON($sellerTxnPath, $sellerTxn);

        error_log("Created transactions for negotiation $negotiationId");
    }

    /**
     * Cleanup negotiation after agreement
     *
     * @param string $negotiationId Negotiation identifier
     */
    private function cleanupNegotiation($negotiationId) {
        $negotiationPath = $this->findNegotiationPath($negotiationId);

        if (!$negotiationPath) {
            return;
        }

        // Optional: Archive instead of delete
        // $archivePath = str_replace('/negotiations/', '/negotiations_archive/', $negotiationPath);
        // rename($negotiationPath, $archivePath);

        // Delete negotiation files
        $files = glob($negotiationPath . '/*');
        foreach ($files as $file) {
            unlink($file);
        }
        rmdir($negotiationPath);

        // Remove symlinks
        $allUsers = glob($this->dataRoot . '/*@*', GLOB_ONLYDIR);
        foreach ($allUsers as $userDir) {
            $symlink = $userDir . '/negotiations/' . $negotiationId;
            if (is_link($symlink)) {
                unlink($symlink);
            }
        }

        error_log("Cleaned up negotiation $negotiationId");
    }

    /**
     * Cleanup stale negotiations (no activity for 24h)
     */
    public function cleanupStaleNegotiations() {
        $cutoff = time() - 86400; // 24 hours
        $cleaned = 0;

        $allUsers = glob($this->dataRoot . '/*@*', GLOB_ONLYDIR);

        foreach ($allUsers as $userDir) {
            $negotiations = glob($userDir . '/negotiations/*', GLOB_ONLYDIR);

            foreach ($negotiations as $negPath) {
                if (is_link($negPath)) {
                    continue;
                }

                $stateFiles = glob($negPath . '/*_state.json');
                if (empty($stateFiles)) {
                    continue;
                }

                $lastUpdate = max(array_map('filemtime', $stateFiles));

                if ($lastUpdate < $cutoff) {
                    $negotiationId = basename($negPath);
                    $this->cleanupNegotiation($negotiationId);
                    $cleaned++;
                }
            }
        }

        error_log("Cleaned up $cleaned stale negotiations");
        return $cleaned;
    }

    // ========== Helper Methods ==========

    private function buildNegotiationId($initiator, $responder, $chemical, $timestamp) {
        $init = $this->emailPrefix($initiator);
        $resp = $this->emailPrefix($responder);
        return "{$init}_{$resp}_{$chemical}_{$timestamp}";
    }

    private function getNegotiationPath($user, $negotiationId) {
        return $this->getUserDir($user) . '/negotiations/' . $negotiationId;
    }

    private function findNegotiationPath($negotiationId) {
        $allUsers = glob($this->dataRoot . '/*@*', GLOB_ONLYDIR);

        foreach ($allUsers as $userDir) {
            $negPath = $userDir . '/negotiations/' . $negotiationId;
            if (file_exists($negPath) && !is_link($negPath)) {
                return $negPath;
            }
        }

        return null;
    }

    private function getUserDir($email) {
        $safeName = preg_replace('/[^a-zA-Z0-9_\\-@.]/', '_', $email);
        return $this->dataRoot . '/' . $safeName;
    }

    private function emailPrefix($email) {
        return explode('@', $email)[0];
    }

    private function generateAgreementKey($offer) {
        // Hash the offer terms to create a unique agreement key
        $canonical = json_encode([
            'chemical' => $offer['chemical'] ?? '',
            'price' => $offer['price'] ?? 0,
            'quantity' => $offer['quantity'] ?? 0
        ]);
        return hash('sha256', $canonical);
    }

    private function findByRole($states, $role) {
        foreach ($states as $state) {
            if (($state['role'] ?? '') === $role) {
                return $state;
            }
        }
        return null;
    }

    private function getRelativePath($from, $to) {
        $from = explode('/', dirname($from));
        $to = explode('/', $to);

        $common = 0;
        for ($i = 0; $i < min(count($from), count($to)); $i++) {
            if ($from[$i] === $to[$i]) {
                $common++;
            } else {
                break;
            }
        }

        $upLevels = count($from) - $common;
        $relativeParts = array_merge(
            array_fill(0, $upLevels, '..'),
            array_slice($to, $common)
        );

        return implode('/', $relativeParts);
    }

    private function ensureDir($dir) {
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }
    }
}
