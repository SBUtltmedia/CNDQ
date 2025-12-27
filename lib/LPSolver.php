<?php
/**
 * Linear Programming Solver for CNDQ Shadow Price Calculation
 *
 * Implements the Simplex method using vertex enumeration for the 2-product problem:
 * - Deicer (d): requires C=0.5, N=0.3, D=0.2 per gallon, profit=$100/50gal drum = $2/gal
 * - Solvent (s): requires N=0.25, D=0.35, Q=0.4 per gallon, profit=$60/20gal drum = $3/gal
 *
 * Constraints:
 * - d >= 0, s >= 0 (non-negativity)
 * - 0.5*d <= C (Chemical C availability)
 * - 0.3*d + 0.25*s <= N (Chemical N availability)
 * - 0.2*d + 0.35*s <= D (Chemical D availability)
 * - 0.4*s <= Q (Chemical Q availability)
 *
 * Objective: Maximize profit = 2*d + 3*s
 */

class LPSolver {
    // Product recipes (per gallon of product)
    const DEICER_C = 0.5;
    const DEICER_N = 0.3;
    const DEICER_D = 0.2;
    const DEICER_Q = 0.0;
    const DEICER_PROFIT_PER_GALLON = 2.0; // $100 per 50-gallon drum

    const SOLVENT_C = 0.0;
    const SOLVENT_N = 0.25;
    const SOLVENT_D = 0.35;
    const SOLVENT_Q = 0.4;
    const SOLVENT_PROFIT_PER_GALLON = 3.0; // $60 per 20-gallon drum

    const EPSILON = 1e-9; // Floating point tolerance

    /**
     * Solve LP problem to find optimal production mix
     *
     * @param array $inventory ['C' => float, 'N' => float, 'D' => float, 'Q' => float]
     * @return array ['maxProfit' => float, 'deicer' => float, 'solvent' => float]
     */
    public function solve($inventory) {
        $C = $inventory['C'];
        $N = $inventory['N'];
        $D = $inventory['D'];
        $Q = $inventory['Q'];

        // Define constraint lines as ax + by = c (where x=deicer, y=solvent)
        $lines = [
            ['a' => 1.0, 'b' => 0.0, 'c' => 0.0],              // d = 0 (lower bound)
            ['a' => 0.0, 'b' => 1.0, 'c' => 0.0],              // s = 0 (lower bound)
            ['a' => self::DEICER_C, 'b' => 0.0, 'c' => $C],    // C constraint
            ['a' => self::DEICER_N, 'b' => self::SOLVENT_N, 'c' => $N], // N constraint
            ['a' => self::DEICER_D, 'b' => self::SOLVENT_D, 'c' => $D], // D constraint
            ['a' => 0.0, 'b' => self::SOLVENT_Q, 'c' => $Q]    // Q constraint
        ];

        // Find all intersection points (vertices of feasible region)
        $points = [];

        for ($i = 0; $i < count($lines); $i++) {
            for ($j = $i + 1; $j < count($lines); $j++) {
                $l1 = $lines[$i];
                $l2 = $lines[$j];

                // Solve system using Cramer's rule
                $det = $l1['a'] * $l2['b'] - $l2['a'] * $l1['b'];

                // Skip parallel lines
                if (abs($det) < self::EPSILON) {
                    continue;
                }

                $d = ($l1['c'] * $l2['b'] - $l2['c'] * $l1['b']) / $det;
                $s = ($l1['a'] * $l2['c'] - $l2['a'] * $l1['c']) / $det;

                $points[] = ['d' => $d, 's' => $s];
            }
        }

        // Filter to valid points (satisfy all constraints)
        $validPoints = array_filter($points, function($p) use ($C, $N, $D, $Q) {
            // Check non-negativity
            if ($p['d'] < -self::EPSILON || $p['s'] < -self::EPSILON) {
                return false;
            }

            // Check all constraints with small tolerance
            $checkC = (self::DEICER_C * $p['d']) <= ($C + self::EPSILON);
            $checkN = (self::DEICER_N * $p['d'] + self::SOLVENT_N * $p['s']) <= ($N + self::EPSILON);
            $checkD = (self::DEICER_D * $p['d'] + self::SOLVENT_D * $p['s']) <= ($D + self::EPSILON);
            $checkQ = (self::SOLVENT_Q * $p['s']) <= ($Q + self::EPSILON);

            return $checkC && $checkN && $checkD && $checkQ;
        });

        // Find point with maximum profit
        $maxProfit = -1;
        $bestMix = ['d' => 0, 's' => 0];

        foreach ($validPoints as $p) {
            $profit = ($p['d'] * self::DEICER_PROFIT_PER_GALLON) +
                      ($p['s'] * self::SOLVENT_PROFIT_PER_GALLON);

            if ($profit > $maxProfit) {
                $maxProfit = $profit;
                $bestMix = $p;
            }
        }

        return [
            'maxProfit' => round($maxProfit, 2),
            'deicer' => round($bestMix['d'], 2),
            'solvent' => round($bestMix['s'], 2)
        ];
    }

    /**
     * Calculate shadow prices using finite differences
     *
     * Shadow price = (change in profit) / (change in resource)
     *
     * @param array $inventory ['C' => float, 'N' => float, 'D' => float, 'Q' => float]
     * @return array ['C' => float, 'N' => float, 'D' => float, 'Q' => float]
     */
    public function getShadowPrices($inventory) {
        $baseline = $this->solve($inventory);
        $delta = 1.0; // Small increment (1 gallon)

        $prices = [];

        foreach (['C', 'N', 'D', 'Q'] as $chemical) {
            // Create new inventory with 1 more gallon of this chemical
            $newInventory = $inventory;
            $newInventory[$chemical] += $delta;

            // Solve LP with new inventory
            $newResult = $this->solve($newInventory);

            // Shadow price = marginal value per gallon
            $prices[$chemical] = round(
                ($newResult['maxProfit'] - $baseline['maxProfit']) / $delta,
                2
            );
        }

        return [
            'shadowPrices' => $prices,
            'optimalMix' => [
                'deicer' => $baseline['deicer'],
                'solvent' => $baseline['solvent']
            ],
            'maxProfit' => $baseline['maxProfit']
        ];
    }
}
