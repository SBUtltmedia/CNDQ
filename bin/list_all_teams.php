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

    printf("%-30s %-35s Start: $%10.2f Current: $%10.2f\n",
        $name,
        $email,
        $starting,
        $current
    );
}
