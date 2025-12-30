#!/usr/bin/env php
<?php
/**
 * Fix Negotiation Names Migration Script
 *
 * This script updates all existing negotiations to use team names instead of email addresses.
 * It replaces email addresses in:
 * - initiatorName
 * - responderName
 * - fromTeamName in all offers
 */

require_once __DIR__ . '/lib/TeamStorage.php';

echo "=== Fix Negotiation Names Migration ===\n\n";

$negotiationsDir = __DIR__ . '/data/negotiations';
$fixed = 0;
$errors = 0;
$skipped = 0;

// Cache for team profiles to avoid repeated file reads
$profileCache = [];

function getTeamName($email) {
    global $profileCache;

    if (isset($profileCache[$email])) {
        return $profileCache[$email];
    }

    try {
        $storage = new TeamStorage($email);
        $profile = $storage->getProfile();
        $teamName = $profile['teamName'] ?? $email;
        $profileCache[$email] = $teamName;
        return $teamName;
    } catch (Exception $e) {
        echo "  WARNING: Could not load profile for $email: " . $e->getMessage() . "\n";
        return $email; // Fallback to email if profile not found
    }
}

if (!is_dir($negotiationsDir)) {
    echo "ERROR: Negotiations directory not found: $negotiationsDir\n";
    exit(1);
}

$files = glob($negotiationsDir . '/negotiation_*.json');

if (empty($files)) {
    echo "No negotiation files found.\n";
    exit(0);
}

echo "Found " . count($files) . " negotiation files to process.\n\n";

foreach ($files as $file) {
    $filename = basename($file);
    echo "Processing: $filename ... ";

    try {
        $data = json_decode(file_get_contents($file), true);

        if (!$data || !isset($data['initiatorId']) || !isset($data['responderId'])) {
            echo "SKIP (invalid format)\n";
            $skipped++;
            continue;
        }

        $changed = false;

        // Fix initiator name
        $correctInitiatorName = getTeamName($data['initiatorId']);
        if (!isset($data['initiatorName']) || $data['initiatorName'] !== $correctInitiatorName) {
            $oldName = $data['initiatorName'] ?? 'not set';
            $data['initiatorName'] = $correctInitiatorName;
            echo "\n  - Updated initiatorName: '$oldName' → '$correctInitiatorName'";
            $changed = true;
        }

        // Fix responder name
        $correctResponderName = getTeamName($data['responderId']);
        if (!isset($data['responderName']) || $data['responderName'] !== $correctResponderName) {
            $oldName = $data['responderName'] ?? 'not set';
            $data['responderName'] = $correctResponderName;
            echo "\n  - Updated responderName: '$oldName' → '$correctResponderName'";
            $changed = true;
        }

        // Fix offer names
        if (isset($data['offers']) && is_array($data['offers'])) {
            foreach ($data['offers'] as $idx => &$offer) {
                if (isset($offer['fromTeamId'])) {
                    $correctFromTeamName = getTeamName($offer['fromTeamId']);
                    if (!isset($offer['fromTeamName']) || $offer['fromTeamName'] !== $correctFromTeamName) {
                        $oldOfferName = $offer['fromTeamName'] ?? 'not set';
                        $offer['fromTeamName'] = $correctFromTeamName;
                        echo "\n  - Updated offer[$idx].fromTeamName: '$oldOfferName' → '$correctFromTeamName'";
                        $changed = true;
                    }
                }
            }
            unset($offer); // Break reference
        }

        if ($changed) {
            // Write back to file
            file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
            echo "\n  ✓ FIXED\n";
            $fixed++;
        } else {
            echo "OK (no changes needed)\n";
        }

    } catch (Exception $e) {
        echo "ERROR: " . $e->getMessage() . "\n";
        $errors++;
    }
}

echo "\n=== Migration Complete ===\n";
echo "Fixed: $fixed\n";
echo "Skipped: $skipped\n";
echo "Errors: $errors\n";
echo "Total: " . count($files) . "\n";

if ($fixed > 0) {
    echo "\n✓ Successfully updated $fixed negotiation file(s) with team names.\n";
}
