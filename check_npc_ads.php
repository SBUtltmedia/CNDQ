<?php
/**
 * Quick check script to verify NPCs are only posting buy requests
 * Run this while the game is running to see NPC advertisement behavior
 */

require_once __DIR__ . '/lib/Database.php';

$db = Database::getInstance();

echo "=== NPC Advertisement Check ===\n\n";

// Get all NPCs
$npcs = $db->query("SELECT email, teamName FROM teams WHERE email LIKE 'npc_%'");

if (empty($npcs)) {
    echo "No NPCs found in the database.\n";
    exit;
}

echo "Found " . count($npcs) . " NPCs:\n";
foreach ($npcs as $npc) {
    echo "  - {$npc['teamName']} ({$npc['email']})\n";
}
echo "\n";

// Check advertisements by type
$adStats = $db->query("SELECT type, COUNT(*) as count FROM advertisements GROUP BY type");

echo "=== Advertisements by Type ===\n";
if (empty($adStats)) {
    echo "No advertisements in database yet.\n";
} else {
    foreach ($adStats as $stat) {
        echo "  {$stat['type']}: {$stat['count']} ads\n";
    }
}
echo "\n";

// Check recent NPC advertisements
$npcAds = $db->query("
    SELECT a.*, t.teamName
    FROM advertisements a
    JOIN teams t ON a.teamEmail = t.email
    WHERE t.email LIKE 'npc_%'
    ORDER BY a.createdAt DESC
    LIMIT 10
");

echo "=== Recent NPC Advertisements (Last 10) ===\n";
if (empty($npcAds)) {
    echo "No NPC advertisements found.\n";
} else {
    foreach ($npcAds as $ad) {
        $time = date('H:i:s', $ad['createdAt']);
        echo "  [{$time}] {$ad['teamName']}: {$ad['type']} Chemical {$ad['chemical']}\n";
    }
}
echo "\n";

// Check for any 'sell' type ads from NPCs (SHOULD BE ZERO after fix!)
$npcSellAds = $db->query("
    SELECT COUNT(*) as count
    FROM advertisements a
    JOIN teams t ON a.teamEmail = t.email
    WHERE t.email LIKE 'npc_%' AND a.type = 'sell'
");

$sellCount = $npcSellAds[0]['count'] ?? 0;
echo "=== VERIFICATION ===\n";
if ($sellCount > 0) {
    echo "❌ PROBLEM: Found {$sellCount} SELL advertisements from NPCs!\n";
    echo "   NPCs should NOT post sell ads (bug still present)\n";
} else {
    echo "✅ GOOD: No sell advertisements from NPCs\n";
    echo "   NPCs are correctly only posting buy requests\n";
}
echo "\n";

// Check recent negotiations initiated by NPCs
$npcNegs = $db->query("
    SELECT n.*, t.teamName
    FROM negotiations n
    JOIN teams t ON n.initiatorId = t.email
    WHERE t.email LIKE 'npc_%'
    ORDER BY n.createdAt DESC
    LIMIT 5
");

echo "=== Recent NPC-Initiated Negotiations ===\n";
if (empty($npcNegs)) {
    echo "No NPC negotiations found.\n";
} else {
    foreach ($npcNegs as $neg) {
        $time = date('H:i:s', $neg['createdAt']);
        $type = $neg['type'] ?? 'buy';
        echo "  [{$time}] {$neg['teamName']}: {$type} negotiation for Chemical {$neg['chemical']} (status: {$neg['status']})\n";
    }
}

echo "\n=== Summary ===\n";
echo "NPCs should:\n";
echo "  ✓ Post BUY advertisements when they want to acquire chemicals\n";
echo "  ✓ Initiate negotiations to SELL (responding to others' buy requests)\n";
echo "  ✗ NEVER post SELL advertisements\n";
