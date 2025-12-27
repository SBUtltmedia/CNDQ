<?php
/**
 * Session Manager
 *
 * Manages game sessions (rounds) and phases:
 * - Production Phase: Teams manufacture products (NOT YET IMPLEMENTED)
 * - Trading Phase: Market is open for trades
 * - Closed Phase: No activity allowed
 */

class SessionManager {
    private $sessionFile;

    public function __construct() {
        $this->sessionFile = __DIR__ . '/../data/session_state.json';
        $this->ensureSessionFileExists();
    }

    private function ensureSessionFileExists() {
        if (!file_exists($this->sessionFile)) {
            $initialState = [
                'currentSession' => 1,
                'phase' => 'production', // 'production', 'trading', 'closed'
                'autoAdvance' => true, // DEFAULT: Auto-advance enabled for autonomous play
                'productionDuration' => 5, // Brief pause (5s) while auto-production runs
                'tradingDuration' => 600, // 10 minutes in seconds
                'phaseStartedAt' => time(),
                'history' => []
            ];

            $dir = dirname($this->sessionFile);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            file_put_contents($this->sessionFile, json_encode($initialState, JSON_PRETTY_PRINT));
        }
    }

    /**
     * Get current session state
     */
    public function getState() {
        $data = json_decode(file_get_contents($this->sessionFile), true);

        // Ensure productionDuration exists (for backwards compatibility)
        if (!isset($data['productionDuration'])) {
            $data['productionDuration'] = 5;
        }

        // Calculate time remaining based on current phase
        if ($data['phase'] === 'production') {
            $elapsed = time() - $data['phaseStartedAt'];
            $data['timeRemaining'] = max(0, $data['productionDuration'] - $elapsed);

            // Auto-run production on first entry to production phase
            if ($data['autoAdvance'] && !isset($data['productionRun'])) {
                // Mark that we've run production for this phase
                $this->runAutoProduction();
            }

            // Auto-advance if time expired and auto-advance is enabled
            if ($data['autoAdvance'] && $data['timeRemaining'] === 0) {
                return $this->advancePhase();
            }
        }

        if ($data['phase'] === 'trading') {
            $elapsed = time() - $data['phaseStartedAt'];
            $data['timeRemaining'] = max(0, $data['tradingDuration'] - $elapsed);

            // Auto-advance if time expired and auto-advance is enabled
            if ($data['autoAdvance'] && $data['timeRemaining'] === 0) {
                return $this->advancePhase();
            }
        }

        // Auto-advance from 'closed' phase immediately (just a transition state)
        // This creates Production -> Trading -> Closed -> (new session) Production cycle
        if ($data['phase'] === 'closed' && $data['autoAdvance']) {
            $elapsed = time() - $data['phaseStartedAt'];
            // Give 5 seconds pause between sessions, then auto-advance
            if ($elapsed >= 5) {
                return $this->advancePhase();
            }
            $data['timeRemaining'] = max(0, 5 - $elapsed);
        }

        return $data;
    }

    /**
     * Check if trading is currently allowed
     */
    public function isTradingAllowed() {
        $state = $this->getState();
        return $state['phase'] === 'trading';
    }

    /**
     * Check if production is currently allowed
     */
    public function isProductionAllowed() {
        $state = $this->getState();
        return $state['phase'] === 'production';
    }

    /**
     * Advance to next phase
     * Production -> Trading -> Closed -> (new session) Production
     */
    public function advancePhase() {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock on session file');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);

        // Record history
        $data['history'][] = [
            'session' => $data['currentSession'],
            'phase' => $data['phase'],
            'endedAt' => time(),
            'duration' => time() - $data['phaseStartedAt']
        ];

        // Advance phase
        switch ($data['phase']) {
            case 'production':
                // Production -> Trading
                $data['phase'] = 'trading';
                // Clear production run flag
                unset($data['productionRun']);
                break;
            case 'trading':
                // Trading -> Closed (brief pause before next session)
                $data['phase'] = 'closed';
                break;
            case 'closed':
                // Closed -> Next Session with Production phase
                $data['currentSession']++;
                $data['phase'] = 'production';
                // Clear production run flag for new session
                unset($data['productionRun']);
                break;
        }

        $data['phaseStartedAt'] = time();

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Run automatic production for all teams
     * Called once when production phase starts with auto-advance enabled
     */
    private function runAutoProduction() {
        // Mark production as run for this phase
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return;
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['productionRun'] = time();

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        // TODO: Scan all teams and run LP production for each
        // This will be implemented when production logic is added
        error_log("Auto-production triggered for session " . $data['currentSession']);
    }

    /**
     * Set phase directly (admin override)
     */
    public function setPhase($phase) {
        if (!in_array($phase, ['production', 'trading', 'closed'])) {
            throw new Exception('Invalid phase');
        }

        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['phase'] = $phase;
        $data['phaseStartedAt'] = time();

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Toggle auto-advance
     */
    public function setAutoAdvance($enabled) {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['autoAdvance'] = (bool)$enabled;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Set production duration (in seconds)
     */
    public function setProductionDuration($seconds) {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['productionDuration'] = (int)$seconds;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Set trading duration (in seconds)
     */
    public function setTradingDuration($seconds) {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['tradingDuration'] = (int)$seconds;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Reset to session 1
     */
    public function reset() {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = [
            'currentSession' => 1,
            'phase' => 'production',
            'autoAdvance' => false,
            'productionDuration' => 5,
            'tradingDuration' => 600,
            'phaseStartedAt' => time(),
            'history' => []
        ];

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }
}
