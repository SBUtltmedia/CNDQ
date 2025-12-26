<?php
header('Content-Type: application/json');

$file = __DIR__ . '/data/session_state.json';

if (!file_exists($file)) {
    // Default initial state
    $state = [
        "currentSession" => 1,
        "state" => "SETUP",
        "stateStartTime" => time(),
        "tradingPhaseEndTime" => 0,
        "history" => []
    ];
} else {
    // Read state (shared lock)
    $fp = fopen($file, 'r');
    if (flock($fp, LOCK_SH)) {
        $content = fread($fp, filesize($file));
        $state = json_decode($content, true);
        flock($fp, LOCK_UN);
    } else {
        $state = ["error" => "Could not read session state"];
    }
    fclose($fp);
}

echo json_encode($state);
