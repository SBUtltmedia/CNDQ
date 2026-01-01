<?php
/**
 * Test Team Name Generator
 */

require_once __DIR__ . '/lib/TeamNameGenerator.php';

echo "=== Team Name Generator Test ===\n\n";

// Test with different user IDs
$testUsers = [
    'test_mail1@stonybrook.edu',
    'test_mail2@stonybrook.edu',
    'persistent-id-abc123xyz',
    'persistent-id-def456uvw',
    'student1@example.edu',
    'student2@example.edu',
    'eppn123@university.edu',
    'eppn456@university.edu'
];

echo "Testing deterministic generation (same ID = same name):\n";
echo str_repeat('-', 60) . "\n";

foreach ($testUsers as $userId) {
    $name1 = TeamNameGenerator::generate($userId);
    $name2 = TeamNameGenerator::generate($userId); // Should be identical
    $match = ($name1 === $name2) ? '✓' : '✗';

    echo sprintf("%-35s → %-20s %s\n", $userId, $name1, $match);
}

echo "\n";
echo "Total possible combinations: " . TeamNameGenerator::getTotalCombinations() . "\n";
echo "(48 adjectives × 48 animals = 2,304 unique names)\n";

echo "\n=== Uniqueness Test ===\n";
echo "Checking if different IDs get different names...\n";

$generatedNames = [];
foreach ($testUsers as $userId) {
    $name = TeamNameGenerator::generate($userId);
    $generatedNames[$userId] = $name;
}

$uniqueNames = array_unique($generatedNames);
echo "Generated " . count($generatedNames) . " names, " . count($uniqueNames) . " are unique\n";

if (count($uniqueNames) === count($generatedNames)) {
    echo "✓ All names are unique (no collisions)\n";
} else {
    echo "Note: Some collisions occurred (expected with limited word lists)\n";
    $duplicates = array_filter(array_count_values($generatedNames), function($count) {
        return $count > 1;
    });
    foreach ($duplicates as $name => $count) {
        echo "  '$name' appeared $count times\n";
    }
}

echo "\n=== Sample Team Names ===\n";
for ($i = 0; $i < 15; $i++) {
    $randomId = 'user' . $i . '@example.com';
    $name = TeamNameGenerator::generate($randomId);
    echo "  • $name\n";
}
