#!/usr/bin/env php
<?php
/**
 * Admin Allowlist Management CLI
 *
 * Usage:
 *   php bin/manage_admins.php list
 *   php bin/manage_admins.php add <email>
 *   php bin/manage_admins.php remove <email>
 *   php bin/manage_admins.php check <email>
 */

// Ensure we're running from CLI
if (php_sapi_name() !== 'cli' && php_sapi_name() !== 'phpdbg') {
    die("Error: This script can only be run from the command line.\n");
}

require_once __DIR__ . '/../lib/AdminAuth.php';

// Parse command line arguments
$command = $argv[1] ?? null;
$email = $argv[2] ?? null;

if (!$command) {
    showUsage();
    exit(1);
}

$adminAuth = new AdminAuth();

try {
    switch ($command) {
        case 'list':
            echo "📋 Current Admin Allowlist:\n";
            echo str_repeat('─', 50) . "\n";
            $admins = $adminAuth->listAdminsCLI();
            if (empty($admins)) {
                echo "   (No admins configured)\n";
            } else {
                foreach ($admins as $admin) {
                    echo "   ✓ $admin\n";
                }
                echo "\n   Total: " . count($admins) . " admin(s)\n";
            }
            break;

        case 'add':
            if (!$email) {
                echo "Error: Email address required\n";
                showUsage();
                exit(1);
            }

            if ($adminAuth->isAdmin($email)) {
                echo "⚠️  $email is already an admin\n";
            } else {
                $adminAuth->addAdminCLI($email);
                echo "✅ Added admin: $email\n";
            }
            break;

        case 'remove':
            if (!$email) {
                echo "Error: Email address required\n";
                showUsage();
                exit(1);
            }

            if (!$adminAuth->isAdmin($email)) {
                echo "⚠️  $email is not in the admin allowlist\n";
            } else {
                $adminAuth->removeAdminCLI($email);
                echo "✅ Removed admin: $email\n";
            }
            break;

        case 'check':
            if (!$email) {
                echo "Error: Email address required\n";
                showUsage();
                exit(1);
            }

            if ($adminAuth->isAdmin($email)) {
                echo "✅ $email IS an admin\n";
            } else {
                echo "❌ $email is NOT an admin\n";
            }
            break;

        case 'help':
        case '--help':
        case '-h':
            showUsage();
            break;

        default:
            echo "Error: Unknown command '$command'\n\n";
            showUsage();
            exit(1);
    }
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}

function showUsage()
{
    echo <<<USAGE
Admin Allowlist Management

Usage:
  php bin/manage_admins.php <command> [email]

Commands:
  list              List all current admins
  add <email>       Add an email to the admin allowlist
  remove <email>    Remove an email from the admin allowlist
  check <email>     Check if an email is in the admin allowlist
  help              Show this help message

Examples:
  php bin/manage_admins.php list
  php bin/manage_admins.php add professor@university.edu
  php bin/manage_admins.php remove old_admin@university.edu
  php bin/manage_admins.php check admin@stonybrook.edu

Security Notes:
  - Admin allowlist can ONLY be modified via this CLI script
  - Web API endpoints cannot add/remove admins
  - Config file: data/admin_config.json

USAGE;
}
