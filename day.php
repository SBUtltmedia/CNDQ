<?php
header('Content-Type: text/plain');

$dataDir = __DIR__ . '/data';
$files = glob($dataDir . '/user_*.json');

$processed = 0;
$log = [];

foreach ($files as $file) {
    $content = file_get_contents($file);
    if ($content === false) {
        $log[] = "Error reading: " . basename($file);
        continue;
    }

    $data = json_decode($content, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $log[] = "Invalid JSON in: " . basename($file);
        continue;
    }

    // Profit calculation
    // Deicer: $100, Solvent: $60
    // Production cost is not deducted from fund during production phase,
    // so we add the realized profit.
    $deicerCount = $data['counts']['deicer'] ?? 0;
    $solventCount = $data['counts']['solvent'] ?? 0;

    $profit = ($deicerCount * 100) + ($solventCount * 60);

    // Update fund
    if (!isset($data['startingFund'])) {
        $data['startingFund'] = 0;
    }
    $previousFund = $data['startingFund'];
    $data['startingFund'] += $profit;

    // Inventory Management
    // The 'inventory' field in the JSON represents the current state (reduced by production).
    // For the new day, this becomes the 'baseInventory'.
    if (isset($data['inventory'])) {
        $data['baseInventory'] = $data['inventory'];
    } else {
        // Fallback for legacy files if inventory wasn't tracked/saved
        // (Should not happen with current frontend logic, but safe to default)
         // Assuming default if missing is risky if we want finite resources,
         // but consistent with legacy behavior.
         // Better to not touch it if missing? No, we need to set base for next load.
         // We'll assume the frontend saved it.
    }

    // Reset counts for the new day
    $data['counts']['deicer'] = 0;
    $data['counts']['solvent'] = 0;
    
    if (file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT))) {
        $processed++;
        $log[] = sprintf(
            "Processed %s: Sold %d Deicer, %d Solvent. Profit: $%d. New Fund: $%d.", 
            basename($file), 
            $deicerCount, 
            $solventCount, 
            $profit, 
            $data['startingFund']
        );
    } else {
        $log[] = "Error writing to: " . basename($file);
    }
}

echo "Processing complete. Updated $processed files.\n\n";
echo implode("\n", $log);