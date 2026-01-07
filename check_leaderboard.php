<?php
require_once __DIR__ . '/lib/Database.php';
require_once __DIR__ . '/lib/MarketplaceAggregator.php';

$marketplace = new MarketplaceAggregator();
$stats = $marketplace->getTeamStatistics();

$standings = [];

foreach ($stats as $teamStat) {
    if ($teamStat['email'] === 'system') continue;

    $standings[] = [
        'rank' => 0,
        'teamName' => $teamStat['teamName'],
        'email' => $teamStat['email'],
        'startingFunds' => round($teamStat['startingFunds'], 2),
        'currentFunds' => round($teamStat['currentFunds'], 2),
        'profit' => round($teamStat['currentFunds'] - $teamStat['startingFunds'], 2),
        'roi' => $teamStat['percentChange'],
        'trades' => $teamStat['totalTrades']
    ];
}

usort($standings, function($a, $b) {
    if (abs($b['roi'] - $a['roi']) < 0.0001) {
        return $b['currentFunds'] <=> $a['currentFunds'];
    }
    return $b['roi'] <=> $a['roi'];
});

echo "LEADERBOARD (from DB)\n";
echo str_repeat("=", 80) . "\n";
printf("%-4s %-25s %-10s %-10s %-10s %-8s %-6s\n", "Rank", "Team Name", "Starting", "Current", "Profit", "ROI%", "Trades");
echo str_repeat("-", 80) . "\n";

foreach ($standings as $index => $team) {
    printf("%-4d %-25s $%10.2f $%10.2f $%10.2f %8.2f%% %-6d\n",
        $index + 1,
        $team['teamName'],
        $team['startingFunds'],
        $team['currentFunds'],
        $team['profit'],
        $team['roi'],
        $team['trades']
    );
}
