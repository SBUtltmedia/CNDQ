<?php
/**
 * Admin Reset Game API
 *
 * POST: Reset all game data while keeping team registrations
 * This allows the same players to start fresh from scratch
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../../userData.php';
require_once __DIR__ . '/../../lib/SessionManager.php';
require_once __DIR__ . '/../../lib/TeamStorage.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ADMIN ONLY
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['error' => 'Admin privileges required']);
    exit;
}

try {
    $teamsDir = __DIR__ . '/../../data/teams';
    $deletedCount = 0;
    $errors = [];

    if (!is_dir($teamsDir)) {
        throw new Exception('Teams directory not found');
    }

    $teamDirs = glob($teamsDir . '/*', GLOB_ONLYDIR);

    // Delete all team directories completely
    foreach ($teamDirs as $teamDir) {
        $teamEmail = basename($teamDir);

        try {
            // Recursively delete team directory
            $files = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($teamDir, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::CHILD_FIRST
            );

            foreach ($files as $fileinfo) {
                $path = $fileinfo->getRealPath();
                if (!$path) continue;
                $deleteFunc = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
                if (file_exists($path)) {
                    @$deleteFunc($path);
                }
            }

            @rmdir($teamDir);
            $deletedCount++;

        } catch (Exception $e) {
            $errors[] = "$teamEmail: " . $e->getMessage();
        }
    }

    // Delete global marketplace files and events
    $marketplaceDir = __DIR__ . '/../../data/marketplace';
    if (is_dir($marketplaceDir)) {
        // Recursive delete for events subdirectory
        $sharedEventsDir = $marketplaceDir . '/events';
        if (is_dir($sharedEventsDir)) {
            $files = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($sharedEventsDir, RecursiveDirectoryIterator::SKIP_DOTS),
                RecursiveIteratorIterator::CHILD_FIRST
            );
            foreach ($files as $fileinfo) {
                $path = $fileinfo->getRealPath();
                if (!$path) continue;
                $deleteFunc = ($fileinfo->isDir() ? 'rmdir' : 'unlink');
                if (file_exists($path)) {
                    @$deleteFunc($path);
                }
            }
            @rmdir($sharedEventsDir);
        }

        $files = glob($marketplaceDir . '/*.json');
        foreach ($files as $file) {
            unlink($file);
        }
    }

    // Delete negotiations
    $negotiationsDir = __DIR__ . '/../../data/negotiations';
    if (is_dir($negotiationsDir)) {
        $files = glob($negotiationsDir . '/*.json');
        foreach ($files as $file) {
            unlink($file);
        }
    }

    // Reset NPC configuration
    $npcConfigFile = __DIR__ . '/../../data/npc_config.json';
    if (file_exists($npcConfigFile)) {
        $defaultNPCConfig = [
            'enabled' => true,
            'npcs' => []
        ];
        file_put_contents($npcConfigFile, json_encode($defaultNPCConfig, JSON_PRETTY_PRINT));
    }

    // Reset session to session 1, production phase
    $sessionManager = new SessionManager();
    $sessionManager->reset();

    echo json_encode([
        'success' => true,
        'message' => 'Game and team data completely reset! Players will get new team names when they refresh.',
        'teamsDeleted' => $deletedCount,
        'errors' => $errors
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
