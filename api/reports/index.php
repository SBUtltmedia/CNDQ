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

        // Format for Answer Report
        $answerReport = [
            'objective' => [
                'name' => 'Profit Total',
                'finalValue' => $result['maxProfit']
            ],
            'variables' => [
                [
                    'name' => 'Gallons Deicer',
                    'finalValue' => $result['deicer'],
                    'objectiveCoef' => 2.0 // From LPSolver
                ],
                [
                    'name' => 'Gallons Solvent',
                    'finalValue' => $result['solvent'],
                    'objectiveCoef' => 3.0 // From LPSolver
                ]
            ],
            'constraints' => []
        ];

        // Format Constraints for Answer Report
        foreach ($result['constraints'] as $chem => $data) {
            $slack = $data['slack'] ?? 0;
            $answerReport['constraints'][] = [
                'name' => "Liquid $chem Used",
                'status' => $data['status'] ?? 'Unknown',
                'slack' => $slack,
                // Calculate used amount: Available - Slack
                'available' => $inventory[$chem] ?? 0,
                'used' => ($inventory[$chem] ?? 0) - $slack
            ];
        }

        // Format for Sensitivity Report
        $sensitivityReport = [
            'shadowPrices' => []
        ];

        foreach ($result['shadowPrices'] as $chem => $price) {
            $allowableIncrease = $result['ranges'][$chem]['allowableIncrease'] ?? 'INF';
            $allowableDecrease = $result['ranges'][$chem]['allowableDecrease'] ?? 0;

            // JSON does not support INF constant, convert to string
            if (is_float($allowableIncrease) && is_infinite($allowableIncrease)) {
                $allowableIncrease = 'INF';
            }
            if (is_float($allowableDecrease) && is_infinite($allowableDecrease)) {
                $allowableDecrease = 'INF';
            }

            $sensitivityReport['shadowPrices'][] = [
                'chemical' => $chem,
                'shadowPrice' => $price,
                'allowableIncrease' => $allowableIncrease,
                'allowableDecrease' => $allowableDecrease,
                'currentInventory' => $inventory[$chem] ?? 0
            ];
        }

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
