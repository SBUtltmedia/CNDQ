<?php
/**
 * NPC Manager - Central orchestrator for NPC operations
 *
 * Manages NPC configuration, trading cycles, and prevents NPC-to-NPC trading
 */

require_once __DIR__ . '/TeamStorage.php';
require_once __DIR__ . '/TeamNameGenerator.php';
require_once __DIR__ . '/MarketplaceAggregator.php';
require_once __DIR__ . '/SessionManager.php';
require_once __DIR__ . '/NegotiationManager.php';

class NPCManager
{
    private $db;
    private $negotiationManager;

    public function __construct()
    {
        require_once __DIR__ . '/Database.php';
        $this->db = Database::getInstance();
        $this->negotiationManager = null;
    }

    /**
     * Get NegotiationManager instance (lazy loading)
     */
    public function getNegotiationManager()
    {
        if ($this->negotiationManager === null) {
            $this->negotiationManager = new NegotiationManager();
        }
        return $this->negotiationManager;
    }

    /**
     * Check if NPC system is enabled globally
     */
    public function isEnabled()
    {
        $config = $this->loadConfig();
        return $config['enabled'] ?? false;
    }

    /**
     * Check if an email belongs to an NPC
     */
    public function isNPC($email)
    {
        return strpos($email, 'npc_') === 0;
    }

    /**
     * Check if two parties can trade
     */
    public function canTradeWith($email1, $email2)
    {
        // Enabled for simulation: allow everyone to trade with everyone
        return true;
    }

    /**
     * Load NPC configuration from JSON file
     */
    public function loadConfig()
    {
        $row = $this->db->queryOne(
            'SELECT value FROM config WHERE key = ?',
            ['npc_config']
        );

        if (!$row) {
            $default = $this->getDefaultConfig();
            $this->saveConfig($default);
            return $default;
        }

        $config = json_decode($row['value'], true);

        if ($config === null) {
            error_log("Failed to parse NPC config JSON from database");
            return $this->getDefaultConfig();
        }

        return $config;
    }

    /**
     * Save NPC configuration to database
     */
    public function saveConfig($config)
    {
        $json = json_encode($config);

        $this->db->execute(
            'INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, ?)',
            ['npc_config', $json, time()]
        );

        return true;
    }

    /**
     * Get default configuration structure
     */
    private function getDefaultConfig()
    {
        return [
            'enabled' => false,
            'npcs' => []
        ];
    }

    /**
     * Create new NPC(s)
     *
     * @param string $skillLevel beginner, novice, or expert
     * @param int $count Number of NPCs to create
     * @return array Created NPC IDs
     */
    public function createNPCs($skillLevel, $count = 1)
    {
        if (!in_array($skillLevel, ['beginner', 'novice', 'expert'])) {
            throw new Exception("Invalid skill level: $skillLevel");
        }

        if ($count < 1 || $count > 10) {
            throw new Exception("Count must be between 1 and 10");
        }

        $config = $this->loadConfig();
        $createdIds = [];

        for ($i = 0; $i < $count; $i++) {
            // Generate unique NPC ID
            $npcId = 'npc_' . uniqid();
            $email = $npcId . '@system';

            // Generate humorous name based on skill level
            $teamName = TeamNameGenerator::generateNPCName($skillLevel);

            // Ensure name is unique among all NPCs
            $existingNames = array_column($config['npcs'], 'teamName');
            $teamName = TeamNameGenerator::generateUnique($email, $existingNames, $skillLevel);

            // Create team directory and initialize via TeamStorage (which is No-M event-sourced)
            $storage = new TeamStorage($email);

            // Update profile with generated name via event
            $storage->setTeamName($teamName);

            // Calculate shadow prices so NPC can trade immediately
            // NPCs need shadow prices to make intelligent trading decisions
            require_once __DIR__ . '/LPSolver.php';
            $inventory = $storage->getInventory();
            $solver = new LPSolver();
            $result = $solver->getShadowPrices($inventory);
            if (isset($result['shadowPrices'])) {
                $storage->updateShadowPrices($result['shadowPrices']);
            }

            // Add to NPC config (Central Registry)
            $npc = [
                'id' => $npcId,
                'email' => $email,
                'teamName' => $teamName,
                'skillLevel' => $skillLevel,
                'active' => true,
                'createdAt' => time(),
                'tradeThresholds' => [
                    'lowInventory' => 300,
                    'excessInventory' => 1800
                ],
                'stats' => [
                    'totalTrades' => 0,
                    'totalProfit' => 0,
                    'lastTradeAt' => 0
                ]
            ];

            $config['npcs'][] = $npc;
            $createdIds[] = $npcId;
        }

        $this->saveConfig($config);

        return $createdIds;
    }

    /**
     * Delete an NPC
     *
     * @param string $npcId NPC ID to delete
     * @param bool $deleteTeamData Whether to delete team directory (default: false)
     */
    public function deleteNPC($npcId, $deleteTeamData = false)
    {
        $config = $this->loadConfig();

        // Find NPC
        $npcIndex = null;
        $npcEmail = null;
        foreach ($config['npcs'] as $index => $npc) {
            if ($npc['id'] === $npcId) {
                $npcIndex = $index;
                $npcEmail = $npc['email'];
                break;
            }
        }

        if ($npcIndex === null) {
            throw new Exception("NPC not found: $npcId");
        }

        // Remove from config
        array_splice($config['npcs'], $npcIndex, 1);
        $this->saveConfig($config);

        // Optionally delete team directory
        if ($deleteTeamData && $npcEmail) {
            $teamDir = __DIR__ . '/../data/teams/' . TeamStorage::sanitizeEmail($npcEmail);
            if (is_dir($teamDir)) {
                $this->deleteDirectory($teamDir);
            }
        }

        return true;
    }

    /**
     * Toggle NPC active state
     */
    public function toggleNPC($npcId, $active)
    {
        $config = $this->loadConfig();

        foreach ($config['npcs'] as &$npc) {
            if ($npc['id'] === $npcId) {
                $npc['active'] = (bool)$active;
                $this->saveConfig($config);
                return true;
            }
        }

        throw new Exception("NPC not found: $npcId");
    }

    /**
     * Toggle global NPC system
     */
    public function toggleSystem($enabled)
    {
        $config = $this->loadConfig();
        $config['enabled'] = (bool)$enabled;
        $this->saveConfig($config);
        return true;
    }

    /**
     * Get all NPCs with their stats
     */
    public function listNPCs()
    {
        $config = $this->loadConfig();

        // Enrich with current team data using No-M getState()
        foreach ($config['npcs'] as &$npc) {
            try {
                $storage = new TeamStorage($npc['email']);
                $state = $storage->getState();

                $npc['currentFunds'] = $state['profile']['currentFunds'] ?? 0;
                $npc['inventory'] = $state['inventory'];
            } catch (Exception $e) {
                error_log("Failed to load NPC data for {$npc['email']}: " . $e->getMessage());
            }
        }

        return [
            'enabled' => $config['enabled'],
            'npcs' => $config['npcs']
        ];
    }

    /**
     * Update NPC stats after a trade
     */
    public function updateNPCStats($npcId, $profit)
    {
        $config = $this->loadConfig();

        foreach ($config['npcs'] as &$npc) {
            if ($npc['id'] === $npcId) {
                $npc['stats']['totalTrades']++;
                $npc['stats']['totalProfit'] += $profit;
                $npc['stats']['lastTradeAt'] = time();
                $this->saveConfig($config);
                return true;
            }
        }

        return false;
    }

    /**
     * Run trading cycle for all active NPCs
     * Called by SessionManager during trading phase
     *
     * NOTE: This method assumes it's only called during trading phase.
     * SessionManager handles the phase check before calling this.
     */
    public function runTradingCycle($currentSession = null)
    {
        if (!$this->isEnabled()) {
            return;
        }

        if ($currentSession === null) {
            $sessionManager = new SessionManager();
            $state = $sessionManager->getState();
            $currentSession = $state['currentSession'] ?? 1;
        }

        $config = $this->loadConfig();

        foreach ($config['npcs'] as $npc) {
            if (!$npc['active']) {
                continue;
            }

            try {
                $this->runNPCTrade($npc, $currentSession);
            } catch (Exception $e) {
                error_log("NPC trading error for {$npc['email']}: " . $e->getMessage());
            }
        }
    }

    /**
     * Run trading logic for a single NPC
     */
    private function runNPCTrade($npc, $currentSession = null)
    {
        error_log("DEBUG: Running trade for {$npc['teamName']} ({$npc['email']})");
        
        // Load appropriate strategy based on skill level
        $strategyClass = $this->getStrategyClass($npc['skillLevel']);

        if (!class_exists($strategyClass)) {
            $strategyFile = $this->getStrategyFile($npc['skillLevel']);
            if (file_exists($strategyFile)) {
                require_once $strategyFile;
            } else {
                error_log("ERROR: Strategy file not found: $strategyFile");
                return;
            }
        }

        if (!class_exists($strategyClass)) {
            error_log("ERROR: Strategy class not found: $strategyClass");
            return;
        }

        $storage = new TeamStorage($npc['email']);
        $strategy = new $strategyClass($storage, $npc, $this);

        // SAFETY: If NPC has pending reflections, wait for them to be processed.
        // This prevents "behind the scenes" instant relaying of inventory.
        // The aggregator will finish the trade, and the NPC will act in the next cycle.
        require_once __DIR__ . '/GlobalAggregator.php';
        $aggregator = new GlobalAggregator();
        // Try to process reflections for this team specifically if possible, 
        // or just wait for the global poller.
        // For now, we just check if it's pending.
        $state = $storage->getState();
        foreach ($state['transactions'] ?? [] as $txn) {
            if (!empty($txn['isPendingReflection'])) {
                error_log("NPC {$npc['teamName']} has pending reflections. Skipping cycle to ensure data integrity.");
                return;
            }
        }

        // First, check for and respond to pending negotiations
        try {
            $negotiationAction = $strategy->respondToNegotiations();

            if ($negotiationAction) {
                error_log("NPC {$npc['teamName']} ({$npc['skillLevel']}) NEGOTIATION ACTION: {$negotiationAction['type']}");
                $this->executeNPCAction($npc, $negotiationAction, $currentSession);
                return; // Prioritize negotiation responses over new trades
            }
        } catch (Exception $e) {
            error_log("ERROR: respondToNegotiations failed for {$npc['email']}: " . $e->getMessage());
        }

        // If no negotiations to respond to, decide on regular trade action
        try {
            $action = $strategy->decideTrade();

            if ($action) {
                error_log("NPC {$npc['teamName']} ({$npc['skillLevel']}) DECIDE ACTION: {$action['type']}");
                $this->executeNPCAction($npc, $action, $currentSession);
            } else {
                error_log("NPC {$npc['teamName']} ({$npc['skillLevel']}) DECIDED: NO ACTION");
            }
        } catch (Exception $e) {
            error_log("ERROR: decideTrade failed for {$npc['email']}: " . $e->getMessage());
        }
    }

    /**
     * Get strategy class name for skill level
     */
    private function getStrategyClass($skillLevel)
    {
        $classMap = [
            'beginner' => 'BeginnerStrategy',
            'novice' => 'NoviceStrategy',
            'expert' => 'ExpertStrategy'
        ];

        return $classMap[$skillLevel] ?? 'BeginnerStrategy';
    }

    /**
     * Get strategy file path for skill level
     */
    private function getStrategyFile($skillLevel)
    {
        $classMap = [
            'beginner' => __DIR__ . '/strategies/BeginnerStrategy.php',
            'novice' => __DIR__ . '/strategies/NoviceStrategy.php',
            'expert' => __DIR__ . '/strategies/ExpertStrategy.php'
        ];

        return $classMap[$skillLevel] ?? __DIR__ . '/strategies/BeginnerStrategy.php';
    }

    /**
     * Run a specific action for an NPC within a cycle
     * Useful for multi-step actions (e.g. reacting then countering)
     */
    public function runTradingCycleAction($npc, $action)
    {
        $this->executeNPCAction($npc, $action);
    }

    /**
     * Execute NPC trade action
     */
    private function executeNPCAction($npc, $action, $currentSession = 1)
    {
        if (!$action || !isset($action['type'])) {
            return;
        }

        require_once __DIR__ . '/TradeExecutor.php';
        require_once __DIR__ . '/MarketplaceAggregator.php';

        try {
            $storage = new TeamStorage($npc['email']);

            switch ($action['type']) {
                case 'create_buy_order':
                    // NPC is posting a buy order
                    $this->executeCreateBuyOrder($npc, $action, $storage, $currentSession);
                    break;

                case 'accept_buy_order':
                    // NPC is seller, accepting a buy order
                    $this->executeAcceptBuyOrder($npc, $action, $storage);
                    break;

                case 'accept_negotiation':
                    // NPC is accepting a negotiation
                    $this->executeAcceptNegotiation($npc, $action, $storage);
                    break;

                case 'counter_negotiation':
                    // NPC is countering a negotiation
                    $this->executeCounterNegotiation($npc, $action, $storage);
                    break;

                case 'reject_negotiation':
                    // NPC is rejecting a negotiation
                    $this->executeRejectNegotiation($npc, $action, $storage);
                    break;

                case 'initiate_negotiation':
                    // NPC is initiating a negotiation (as a seller responding to an ad)
                    $this->executeInitiateNegotiation($npc, $action, $storage, $currentSession);
                    break;

                case 'add_reaction':
                    // NPC is expressing a reaction (annoyance/pleasure)
                    $this->executeAddReaction($npc, $action, $storage);
                    break;

                default:
                    error_log("Unknown NPC action type: {$action['type']}");
            }

        } catch (Exception $e) {
            error_log("Failed to execute NPC action for {$npc['email']}: " . $e->getMessage());
        }
    }

    /**
     * Execute add_reaction action (NPC reacting to a haggle)
     */
    private function executeAddReaction($npc, $action, $storage)
    {
        $storage->emitEvent('add_reaction', [
            'negotiationId' => $action['negotiationId'],
            'level' => $action['level']
        ]);
        error_log("NPC {$npc['teamName']} reacted to negotiation {$action['negotiationId']} with level {$action['level']}");
    }

    private function executeInitiateNegotiation($npc, $action, $storage, $currentSession = 1)
    {
        $negotiationManager = $this->getNegotiationManager();
        
        // NPC is the initiator, but since it's responding to a BUY ad, 
        // the NPC's perspective is 'sell'.
        $negotiationManager->createNegotiation(
            $npc['email'],
            $npc['teamName'],
            $action['responderId'],
            $action['responderName'],
            $action['chemical'],
            [
                'quantity' => $action['quantity'],
                'price' => $action['price']
            ],
            $currentSession,
            'sell', // NPC is initiating a SELL negotiation
            $action['adId'] ?? null
        );

        error_log("NPC {$npc['teamName']} initiated sell negotiation with {$action['responderName']} for {$action['quantity']} gal of {$action['chemical']} at \${$action['price']}/gal");
    }

    /**
     * Execute create_buy_order action (NPC posting buy order)
     */
    private function executeCreateBuyOrder($npc, $action, $storage, $currentSession = 1)
    {
        $buyOrderData = [
            'chemical' => $action['chemical'],
            'quantity' => $action['quantity'],
            'maxPrice' => $action['maxPrice'],
            'sessionNumber' => $currentSession
        ];

        $storage->addBuyOrder($buyOrderData);

        // ALSO post advertisement so it shows up in marketplace
        require_once __DIR__ . '/AdvertisementManager.php';
        $adManager = new AdvertisementManager($npc['email'], $npc['teamName']);
        $adManager->postAdvertisement($action['chemical'], 'buy');

        error_log("NPC {$npc['teamName']} posted buy order: {$action['quantity']} gal of {$action['chemical']} at \${$action['maxPrice']}/gal max");
    }

    /**
     * Execute accept_buy_order action (NPC selling)
     */
    private function executeAcceptBuyOrder($npc, $action, $storage)
    {
        // Verify buyer is not an NPC
        if (!$this->canTradeWith($npc['email'], $action['buyerId'])) {
            error_log("Blocked NPC-to-NPC trade attempt: {$npc['email']} -> {$action['buyerId']}");
            return;
        }

        $executor = new TradeExecutor();
        $result = $executor->executeTrade(
            $npc['email'],          // seller (NPC)
            $action['buyerId'],     // buyer
            $action['chemical'],
            $action['quantity'],
            $action['price'],
            $action['buyOrderId'] ?? null,
            $npc['email']           // Acting team is the NPC
        );

        if ($result['success']) {
            // Calculate profit (positive for selling)
            $revenue = $action['quantity'] * $action['price'];
            $this->updateNPCStats($npc['id'], $revenue);

            error_log("NPC {$npc['teamName']} sold {$action['quantity']} gal of {$action['chemical']} at \${$action['price']}/gal");
        }
    }

    /**
     * Execute create_sell_offer action (NPC posting sell offer)
     * REMOVED: In the simplified model, NPCs don't post sell offers.
     * They only respond to player buy requests.
     */
    private function executeCreateSellOffer($npc, $action, $storage)
    {
        // No longer used
        return;
    }

    /**
     * Execute accept_negotiation action (NPC accepting negotiation)
     */
    private function executeAcceptNegotiation($npc, $action, $storage)
    {
        $negotiationManager = $this->getNegotiationManager();
        $negotiation = $negotiationManager->getNegotiation($action['negotiationId']);

        if (!$negotiation) {
            error_log("NPC {$npc['teamName']} tried to accept non-existent negotiation: {$action['negotiationId']}");
            return;
        }

        // Accept the negotiation
        $negotiationManager->acceptNegotiation($action['negotiationId'], $npc['email']);

        // Execute the trade
        $latestOffer = end($negotiation['offers']);
        $executor = new TradeExecutor();

        // Determine buyer and seller based on negotiation type
        $type = $negotiation['type'] ?? 'buy';

        if ($type === 'buy') {
            // Initiator is buying, NPC is selling
            $sellerId = $npc['email'];
            $buyerId = $negotiation['initiatorId'];
        } else {
            // Initiator is selling, NPC is buying
            $sellerId = $negotiation['initiatorId'];
            $buyerId = $npc['email'];
        }

        $result = $executor->executeTrade(
            $sellerId,
            $buyerId,
            $negotiation['chemical'],
            $latestOffer['quantity'],
            $latestOffer['price'],
            null, // No offerId for negotiations
            $npc['email'] // Acting team is the NPC
        );

        if ($result['success']) {
            $revenue = $latestOffer['quantity'] * $latestOffer['price'];
            // If NPC was buyer, profit is negative
            $profit = ($buyerId === $npc['email']) ? -$revenue : $revenue;
            $this->updateNPCStats($npc['id'], $profit);

            $actionWord = ($buyerId === $npc['email']) ? "bought" : "sold";
            $otherParty = ($buyerId === $npc['email']) ? "from" : "to";

            error_log("NPC {$npc['teamName']} accepted negotiation: {$actionWord} {$latestOffer['quantity']} gal of {$negotiation['chemical']} at \${$latestOffer['price']}/gal {$otherParty} {$negotiation['initiatorName']}");
        } else {
            error_log("NPC {$npc['teamName']} failed to execute negotiation trade: " . ($result['error'] ?? 'Unknown error'));
        }
    }

    /**
     * Execute counter_negotiation action (NPC countering negotiation)
     */
    private function executeCounterNegotiation($npc, $action, $storage)
    {
        $negotiationManager = $this->getNegotiationManager();
        $negotiation = $negotiationManager->getNegotiation($action['negotiationId']);

        if (!$negotiation) {
            error_log("NPC {$npc['teamName']} tried to counter non-existent negotiation: {$action['negotiationId']}");
            return;
        }

        // Get NPC profile for team name
        $profile = $storage->getProfile();

        // Add counter offer
        $negotiationManager->addCounterOffer(
            $action['negotiationId'],
            $npc['email'],
            $profile['teamName'] ?? $npc['teamName'],
            $action['quantity'],
            $action['price']
        );

        error_log("NPC {$npc['teamName']} countered negotiation: {$action['quantity']} gal of {$negotiation['chemical']} at \${$action['price']}/gal");
    }

    /**
     * Execute reject_negotiation action (NPC rejecting negotiation)
     */
    private function executeRejectNegotiation($npc, $action, $storage)
    {
        $negotiationManager = $this->getNegotiationManager();
        $negotiation = $negotiationManager->getNegotiation($action['negotiationId']);

        if (!$negotiation) {
            error_log("NPC {$npc['teamName']} tried to reject non-existent negotiation: {$action['negotiationId']}");
            return;
        }

        // Reject the negotiation
        $negotiationManager->rejectNegotiation($action['negotiationId'], $npc['email']);

        error_log("NPC {$npc['teamName']} rejected negotiation for {$negotiation['chemical']} from {$negotiation['initiatorName']}");
    }

    /**
     * Recursively delete directory
     */
    private function deleteDirectory($dir)
    {
        if (!is_dir($dir)) {
            return false;
        }

        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            is_dir($path) ? $this->deleteDirectory($path) : unlink($path);
        }

        return rmdir($dir);
    }
}
