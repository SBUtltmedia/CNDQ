#!/usr/bin/env php
<?php
require_once __DIR__ . '/../lib/TeamStorage.php';
require_once __DIR__ . '/../lib/Database.php';

$db = Database::getInstance();
$teams = $db->query('SELECT DISTINCT team_email FROM team_events');

echo "All Teams Starting Funds:\n";
echo str_repeat('-', 80) . "\n";
printf("%-30s %15s %15s %10s\n", 'Team', 'Starting', 'Current', 'ROI %');
echo str_repeat('-', 80) . "\n";

foreach ($teams as $row) {
    $email = $row['team_email'];
    if ($email === 'system') continue;

    $storage = new TeamStorage($email);
    $profile = $storage->getProfile();

    $starting = $profile['startingFunds'] ?? 0;
    $current = $profile['currentFunds'] ?? 0;
    $roi = $starting > 0 ? (($current - $starting) / $starting * 100) : 0;

    $teamName = $profile['teamName'] ?? 'Unknown';
    $type = strpos($email, 'npc_') === 0 ? ' [NPC]' : '';

    $startStr = ($starting < 0 ? '-$' : '$') . number_format(abs($starting), 2);
    $currStr = ($current < 0 ? '-$' : '$') . number_format(abs($current), 2);
    printf("%-30s %15s %15s %+9.2f%%\n",
        substr($teamName . $type, 0, 30),
        $startStr,
        $currStr,
        $roi
    );
}
