<?php
/**
 * Reports API
 * Generates data for Excel-style reporting:
 * - Financial Summary (Production, Sales, Purchases, Profit)
 * - Transaction History (Log of all trades)
 * - Optimization Reports (Answer & Sensitivity Reports via LP Solver)
 */

require_once __DIR__ . '/../../lib/TeamStorage.php';
require_once __DIR__ . '/../../lib/LPSolver.php';
require_once __DIR__ . '/../../userData.php';

header('Content-Type: application/json');

$currentUserEmail = getCurrentUserEmail();

if (!$currentUserEmail || trim($currentUserEmail) === '') {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

try {
    $storage = new TeamStorage($currentUserEmail);
    $type = $_GET['type'] ?? 'all'; // financials, transactions, optimization, or all

    $response = ['success' => true];

    // 1. Financial Summary
    if ($type === 'all' || $type === 'financials') {
        $productionHistory = $storage->getProductionHistory();
        $transactions = $storage->getTransactions()['transactions'];

        $productionRevenue = 0;
        foreach ($productionHistory as $run) {
            $productionRevenue += ($run['revenue'] ?? 0);
        }

        $salesRevenue = 0;
        $purchaseCosts = 0;

        foreach ($transactions as $txn) {
            $amount = $txn['totalPrice'] ?? $txn['totalAmount'] ?? (($txn['quantity'] ?? 0) * ($txn['pricePerGallon'] ?? 0));
            if (($txn['sellerId'] ?? '') === $currentUserEmail) {
                $salesRevenue += $amount;
            } elseif (($txn['buyerId'] ?? '') === $currentUserEmail) {
                $purchaseCosts += $amount;
            }
        }

        $totalProfit = $productionRevenue + $salesRevenue - $purchaseCosts;
        // Adjust for starting funds/baseline if necessary, but this pure cash flow view is usually best.

        $response['financials'] = [
            'productionRevenue' => round($productionRevenue, 2),
            'salesRevenue' => round($salesRevenue, 2),
            'purchaseCosts' => round($purchaseCosts, 2),
            'totalProfit' => round($totalProfit, 2)
        ];
    }

    // 2. Transaction History
    if ($type === 'all' || $type === 'transactions') {
        $rawTransactions = $storage->getTransactions()['transactions'];
        $formattedTransactions = [];

        // Sort by timestamp desc
        usort($rawTransactions, function($a, $b) {
            return ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0);
        });

        foreach ($rawTransactions as $txn) {
            $isSeller = ($txn['sellerId'] ?? '') === $currentUserEmail;
            
            // Determine counterparty name (might be just ID if name not stored in txn)
            // Ideally we'd look up the name, but for now ID is safer than nothing.
            // Some txns store team names.
            $counterparty = $isSeller ? ($txn['buyerId'] ?? 'Unknown') : ($txn['sellerId'] ?? 'Unknown');
            // Try to use helper if available or simple check
            
            $formattedTransactions[] = [
                'id' => $txn['transactionId'] ?? $txn['id'] ?? uniqid(),
                'type' => $isSeller ? 'Sale' : 'Purchase',
                'chemical' => $txn['chemical'] ?? '?',
                'quantity' => $txn['quantity'] ?? 0,
                'pricePerGallon' => $txn['pricePerGallon'] ?? 0,
                'totalPrice' => $txn['totalPrice'] ?? $txn['totalAmount'] ?? (($txn['quantity'] ?? 0) * ($txn['pricePerGallon'] ?? 0)),
                'counterparty' => $counterparty,
                'timestamp' => $txn['timestamp'] ?? time(),
                'date' => date('Y-m-d H:i:s', floor($txn['timestamp'] ?? time()))
            ];
        }

        $response['transactions'] = $formattedTransactions;
    }

    // 3. Optimization Reports (Answer & Sensitivity)
    if ($type === 'all' || $type === 'optimization') {
        $inventory = $storage->getInventory();
        $solver = new LPSolver();
        $result = $solver->solve($inventory);

        // --- ANSWER REPORT ---
        // Mimics Excel "Answer Report" but focuses on Current State (no "Original Value")
        
        // 1. Target Cell (Objective)
        $objective = [
            'name' => 'Total Profit (Projected)',
            'finalValue' => $result['maxProfit']
        ];

        // 2. Adjustable Cells (Decision Variables)
        $variables = [
            [
                'name' => 'Gallons Deicer',
                'finalValue' => $result['deicer'],
                'type' => 'Decision Variable'
            ],
            [
                'name' => 'Gallons Solvent',
                'finalValue' => $result['solvent'],
                'type' => 'Decision Variable'
            ]
        ];

        // 3. Constraints
        $constraints = [];
        foreach ($result['constraints'] as $chem => $data) {
            $slack = $data['slack'] ?? 0;
            $available = $inventory[$chem] ?? 0;
            $used = $available - $slack; // Value = RHS - Slack (for <= constraint)
            
            // Determine binding status explicitly if missing
            $status = $data['status'] ?? ($slack < 0.001 ? 'Binding' : 'Not Binding');

            $constraints[] = [
                'name' => "Liquid $chem Used",
                'cellValue' => round($used, 2), // The "Value" in Excel
                'formula' => "Used <= Available", // Descriptive formula
                'status' => $status,
                'slack' => round($slack, 2)
            ];
        }

        $answerReport = [
            'objective' => $objective,
            'variables' => $variables,
            'constraints' => $constraints
        ];

        // --- SENSITIVITY REPORT ---
        // Mimics Excel "Sensitivity Report"
        // We currently only calculate sensitivity for Constraints (Shadow Prices), not Variables (Reduced Cost)
        
        $sensitivityConstraints = [];

        foreach ($result['shadowPrices'] as $chem => $price) {
            $allowableIncrease = $result['ranges'][$chem]['allowableIncrease'] ?? 'INF';
            $allowableDecrease = $result['ranges'][$chem]['allowableDecrease'] ?? 0;
            $available = $inventory[$chem] ?? 0;
            $used = $available - ($result['constraints'][$chem]['slack'] ?? 0);

            // JSON does not support INF constant, convert to string
            // LPSolver returns 9999 for infinite increase
            if ((is_float($allowableIncrease) && is_infinite($allowableIncrease)) || $allowableIncrease >= 9999) {
                $allowableIncrease = '1E+30'; // Excel notation for infinity
            }
            if (is_float($allowableDecrease) && is_infinite($allowableDecrease)) {
                $allowableDecrease = '1E+30';
            }

            $sensitivityConstraints[] = [
                'name' => "Liquid $chem",
                'finalValue' => round($used, 2),
                'shadowPrice' => $price, // The core value
                'constraintRHS' => $available, // Right Hand Side = Available Inventory
                'allowableIncrease' => $allowableIncrease,
                'allowableDecrease' => $allowableDecrease
            ];
        }

        $sensitivityReport = [
            'constraints' => $sensitivityConstraints
            // 'adjustableCells' => [] // We omit this as we don't calc Reduced Costs yet
        ];

        $response['optimization'] = [
            'answerReport' => $answerReport,
            'sensitivityReport' => $sensitivityReport
        ];
    }

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
