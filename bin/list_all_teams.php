#!/usr/bin/env php
<?php
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/TeamStorage.php';

$db = Database::getInstance();
$teams = $db->query('SELECT DISTINCT team_email FROM team_events');

echo "All teams in database:\n";
foreach ($teams as $row) {
    $email = $row['team_email'];
    $storage = new TeamStorage($email);
    $profile = $storage->getProfile();
    $name = $profile['teamName'] ?? 'Unknown';
    $starting = $profile['startingFunds'] ?? 0;
    $current = $profile['currentFunds'] ?? 0;

    $startStr = ($starting < 0 ? '-$' : '$') . number_format(abs($starting), 2);
    $currStr = ($current < 0 ? '-$' : '$') . number_format(abs($current), 2);
    printf("%-30s %-35s Start: %12s Current: %12s\n",
        $name,
        $email,
        $startStr,
        $currStr
    );
}
