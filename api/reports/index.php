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
        $transactions = $storage->getTransactions()['transactions'];

        // Production revenue = current optimal profit from LP solver (matches Excel's D2)
        // This updates dynamically as inventory changes from trades
        $inventory = $storage->getInventory();
        $solver = new LPSolver();
        $lpResult = $solver->solve($inventory);
        $productionRevenue = $lpResult['maxProfit'];

        $salesRevenue = 0;
        $purchaseCosts = 0;

        foreach ($transactions as $txn) {
            $amount = $txn['totalPrice'] ?? $txn['totalAmount'] ?? (($txn['quantity'] ?? 0) * ($txn['pricePerGallon'] ?? 0));
            // TradeExecutor stores 'role' (buyer/seller) not sellerId/buyerId
            $role = $txn['role'] ?? null;
            if ($role === 'seller') {
                $salesRevenue += $amount;
            } elseif ($role === 'buyer') {
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
            // TradeExecutor stores 'role' (buyer/seller) and 'counterparty'/'counterpartyName'
            $role = $txn['role'] ?? null;
            $isSeller = ($role === 'seller');

            // Use counterpartyName if available, fall back to counterparty ID
            $counterparty = $txn['counterpartyName'] ?? $txn['counterparty'] ?? 'Unknown';

            // Extract heat data if available
            $heat = $txn['heat'] ?? null;
            $heatInfo = null;
            if ($heat) {
                $heatInfo = [
                    'total' => $heat['total'] ?? 0,
                    'isHot' => $heat['isHot'] ?? false,
                    'yourGain' => $isSeller ? ($heat['sellerGain'] ?? 0) : ($heat['buyerGain'] ?? 0)
                ];
            }

            $formattedTransactions[] = [
                'id' => $txn['transactionId'] ?? $txn['id'] ?? uniqid(),
                'type' => $isSeller ? 'Sale' : 'Purchase',
                'chemical' => $txn['chemical'] ?? '?',
                'quantity' => $txn['quantity'] ?? 0,
                'pricePerGallon' => $txn['pricePerGallon'] ?? 0,
                'totalPrice' => $txn['totalPrice'] ?? $txn['totalAmount'] ?? (($txn['quantity'] ?? 0) * ($txn['pricePerGallon'] ?? 0)),
                'counterparty' => $counterparty,
                'timestamp' => $txn['timestamp'] ?? time(),
                'date' => date('Y-m-d H:i:s', floor($txn['timestamp'] ?? time())),
                // Expanded data for detailed view
                'inventoryBefore' => $txn['inventoryBefore'] ?? null,
                'inventoryAfter' => $txn['inventoryAfter'] ?? null,
                'heat' => $heatInfo
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
        // Deicer profit: $2/gal, Solvent profit: $3/gal (from LPSolver coefficients)
        $variables = [
            [
                'name' => 'Gallons Deicer',
                'finalValue' => round($result['deicer'], 2),
                'objectiveCoef' => 2, // $2 profit per gallon
                'type' => 'Decision Variable'
            ],
            [
                'name' => 'Gallons Solvent',
                'finalValue' => round($result['solvent'], 2),
                'objectiveCoef' => 3, // $3 profit per gallon
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
                'slack' => round($slack, 2),
                'used' => round($used, 2),
                'available' => round($available, 2)
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
        
        $shadowPrices = [];

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

            $shadowPrices[] = [
                'chemical' => $chem,  // UI expects 'chemical' not 'name'
                'name' => "Liquid $chem",
                'finalValue' => round($used, 2),
                'shadowPrice' => $price, // The core value
                'currentInventory' => round($available, 2), // UI expects 'currentInventory'
                'constraintRHS' => $available, // Keep for backward compat
                'allowableIncrease' => $allowableIncrease,
                'allowableDecrease' => $allowableDecrease
            ];
        }

        $sensitivityReport = [
            'shadowPrices' => $shadowPrices,  // UI expects 'shadowPrices' not 'constraints'
            'constraints' => $shadowPrices    // Keep for backward compat
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
