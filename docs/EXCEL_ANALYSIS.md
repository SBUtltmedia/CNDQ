# Excel Template Analysis: Deicer and Solvent Model

**Date:** 2026-01-08
**Source:** `unused/archive/Deicer and Solvent Model Blank Template 19Dect2025.xlsm`
**Analysis Tools:** Python (openpyxl), olevba

---

## Executive Summary

The original Excel-based game used a sophisticated VBA-powered interface with a centralized trading dialog and automatic solver integration. This analysis reveals several features and workflows that should inform the digital implementation.

---

## 1. Sheet Structure

### Master Sheets
- **Model** - Template/reference sheet showing the LP structure
- **Answer Report 1** - Excel Solver output showing optimization results
- **Sensitivity Report 1** - Excel Solver sensitivity analysis (shadow prices)
- **Random CNDQ** - Randomized initial resource values for all 20 teams

### Team Sheets (1-20)
Each team has their own sheet (31 rows × 34 columns) containing:
- Production optimization model
- Sales transaction log (25 rows)
- Purchase transaction log (25 rows)
- Financial summary panel

### Scoreboard
Centralized leaderboard showing all teams' performance

---

## 2. VBA Macros: Trading Interface

### UserForm1 - Central Trading Dialog

The Excel version uses a **popup dialog box** (UserForm1) that opens when the workbook loads. This dialog facilitates ALL trades in the game.

#### Dialog Fields:
1. **ComboBox1** - "Selling Team" (dropdown, Team 1-20)
2. **ComboBox2** - "Purchasing Team" (dropdown, Team 1-20)
3. **ComboBox3** - "Liquid" (dropdown, C/N/D/Q)
4. **TextBox1** - "Gallons" (numeric input)
5. **TextBox2** - "Price per Gallon" (currency input)
6. **CommandButton1** - "Submit" (executes trade)
7. **CommandButton2** - "Cancel" (clears form)

#### Trade Workflow (VBA Logic):

```vba
Private Sub CommandButton1_Click()
    ' 1. VALIDATE SELLER INVENTORY
    Select Case ComboBox3.Value (C/N/D/Q)
        If Range("F5-F8").Value < Gallons Then
            MsgBox("Team does not have enough inventory")
            Abort
        End If

    ' 2. RECORD SALE ON SELLER'S SHEET
    ' Find first empty row in Sales section (rows 5-30)
    ' Write: Gallons, To Firm, Unit Price to columns J-S

    ' 3. RUN SOLVER ON SELLER'S SHEET
    S = SolverSolve(False)  ' Recalculate optimal production

    ' 4. RECORD PURCHASE ON BUYER'S SHEET
    ' Find first empty row in Purchases section (rows 5-30)
    ' Write: Gallons, From Firm, Unit Price to columns V-AE

    ' 5. RUN SOLVER ON BUYER'S SHEET
    S = SolverSolve(False)  ' Recalculate optimal production

    ' 6. UPDATE SCOREBOARD
    Worksheets("Scoreboard").Select
    ' Scoreboard automatically refreshes via formulas

    ' 7. RESET FORM
    Call CommandButton2_Click
End Sub
```

**Key Insight:** The Excel version has an **instructor-mediated trading interface**. The dialog is likely operated by the instructor or a TA who enters agreed-upon trades after students negotiate verbally or on a blackboard.

---

## 3. Team Sheet Structure

### A. Objective Section (Rows 1-2)

```
A1: Objective    B1: Deicer       C1: Solvent     D1: Total
A2: Profit       B2: [profit/gal] C2: [profit/gal] D2: =SUMPRODUCT(B2:C2, $B$11:$C$11)
```

**Cell D2** = Total Profit (displayed prominently)

### B. Constraints Section (Rows 4-8)

```
A4: Constraints  B4: Deicer  C4: Solvent  D4: Used  F4: Available  G4: Initial

A5: Liquid C     B5: 1       C5: 0        D5: [formula] F5: [formula] G5: [initial]
A6: Liquid N     B6: 2       C6: 1        D6: [formula] F6: [formula] G6: [initial]
A7: Liquid D     B7: 1       C7: 2        D7: [formula] F7: [formula] G7: [initial]
A8: Liquid Q     B8: 0       C8: 3        D8: [formula] F8: [formula] G8: [initial]
```

**Column D (Used)** = Amount consumed by production
**Column F (Available)** = Initial + Purchases - Sales - Used
**Column G (Initial)** = Starting inventory

### C. Variables Section (Rows 11-13)

```
A11: Gallons     B11: [Deicer gallons]  C11: [Solvent gallons]
A12: Gallons/Drum B12: 50               C12: 20
A13: Drums       B13: =B11/50           C13: =C11/20
```

**B11 and C11** are the decision variables for Excel Solver.

### D. Sales Section (Columns I-S, Rows 4-31)

```
I4: Sales    J4: Gallons    N4: To Firm    O4: Unit Price    S4: Total
             C  N  D  Q                    C  N  D  Q

Row 5:       [transaction 1]
Row 6:       [transaction 2]
...
Row 30:      [transaction 25]
Row 31:      [TOTALS]
```

**25 transaction slots** for recording sales.

### E. Purchases Section (Columns U-AE, Rows 4-31)

```
U4: Purchases  V4: Gallons    Z4: From Firm  AA4: Unit Price   AE4: Total
               C  N  D  Q                     C  N  D  Q

Row 5:         [transaction 1]
Row 6:         [transaction 2]
...
Row 30:        [transaction 25]
Row 31:        [TOTALS]
```

**25 transaction slots** for recording purchases.

### F. Financial Summary (Column AG-AH, Rows 4-7)

```
AG4: Production    AH4: =D2            (Profit from manufacturing)
AG5: Sales         AH5: =SUM(S5:S31)  (Revenue from selling chemicals)
AG6: Purchases     AH6: =SUM(AE5:AE31) (Cost of buying chemicals)
AG7: Total         AH7: =AH4+AH5-AH6   (Net profit)
```

**Cell AH7** = Final total profit (used by Scoreboard)

---

## 4. Scoreboard Sheet Structure

```
A1: Team    B1: Initial Profit    C1: Current Profit    D1: % Increase

A2: 1       B2: 16285.71          C2: ='Team 1'!AH7     D2: =(C2-B2)/B2
A3: 2       B3: 11090.91          C3: ='Team 2'!AH7     D3: =(C3-B3)/B3
...
A21: 20     B21: [value]          C21: ='Team 20'!AH7   D21: =(C21-B21)/B21
```

**Initial Profit (Column B)** is hardcoded (calculated from Random CNDQ initial resources).
**Current Profit (Column C)** pulls from each team's AH7 cell (live updates).
**% Increase (Column D)** = (Current - Initial) / Initial

---

## 5. Answer Report Template

Excel Solver generates this after optimization:

```
Target Cell (Max)
  Cell: $D$2  Name: Profit Total  Original Value: [X]  Final Value: [Y]

Adjustable Cells
  Cell: $B$11  Name: Gallons Deicer   Original Value: [X]  Final Value: [Y]
  Cell: $C$11  Name: Gallons Solvent  Original Value: [X]  Final Value: [Y]

Constraints
  Cell: $D$5  Name: Liquid C Used  Value: [X]  Formula: $D$5<=$F$5  Status: Not Binding  Slack: [X]
  Cell: $D$6  Name: Liquid N Used  Value: [X]  Formula: $D$6<=$F$6  Status: Binding      Slack: 0
  Cell: $D$7  Name: Liquid D Used  Value: [X]  Formula: $D$7<=$F$7  Status: Binding      Slack: 0
  Cell: $D$8  Name: Liquid Q Used  Value: [X]  Formula: $D$8<=$F$8  Status: Not Binding  Slack: [X]
```

**Key Pedagogical Value:**
- Shows which resources are fully utilized (**Binding**)
- Shows which resources have excess (**Not Binding** with positive Slack)
- Helps students understand which chemicals to prioritize for trading

---

## 6. Sensitivity Report Template

Excel Solver generates this after optimization:

```
Adjustable Cells
  Cell    Name              Final Value  Reduced Cost  Objective Coefficient  Allowable Inc/Dec
  $B$11   Gallons Deicer    1818.18      0             2                      0.29 / 1.60
  $C$11   Gallons Solvent   1818.18      0             3                      1.33 / 0.50

Constraints
  Cell    Name           Final Value  Shadow Price  Constraint RHS  Allowable Inc/Dec
  $D$5    Liquid C Used  909.09       0             1000            1e+30 / 90.91
  $D$6    Liquid N Used  1000         1.82          1000            28.57 / 187.5
  $D$7    Liquid D Used  1000         7.27          1000            125.0 / 40.0
  $D$8    Liquid Q Used  727.27       0             1000            1e+30 / 272.73
```

**Shadow Prices (THE CORE LEARNING TOOL):**
- **Liquid C:** $0 (excess, not binding)
- **Liquid N:** $1.82 per gallon (binding, high value)
- **Liquid D:** $7.27 per gallon (binding, very high value)
- **Liquid Q:** $0 (excess, not binding)

**Trading Strategy:**
- **Buy:** N and D (high shadow prices, fully utilized)
- **Sell:** C and Q (zero shadow prices, have excess)

**Allowable Ranges:** Show how much the shadow price remains valid if inventory changes.

---

## 7. Key Differences from Digital Implementation

### Excel Version (Instructor-Mediated)
1. **Centralized Trading Dialog** operated by instructor/TA
2. Students negotiate verbally or on blackboard
3. Instructor enters agreed trades into UserForm1
4. **Automatic Solver re-optimization** after each trade
5. **Immediate scoreboard update** via formulas
6. **25 transaction history rows** visible on each team sheet
7. **Financial breakdown** (Production + Sales - Purchases = Total) always visible

### Digital Implementation (Self-Service)
1. **Decentralized buy requests** posted by students
2. **Negotiation system** handles back-and-forth
3. Trades execute automatically when accepted
4. LP solver runs on schedule (not after every trade)
5. Leaderboard updates via API polling
6. Transaction history may not be fully visible
7. Financial breakdown may be hidden or separate view

---

## 8. Missing Features in Digital Implementation

Based on this analysis, consider adding:

### 8.1 Financial Summary Panel (HIGH PRIORITY)
Display prominently on each team's dashboard:
```
Production Revenue:  $X,XXX.XX
+ Sales Revenue:     $X,XXX.XX
- Purchase Costs:    $X,XXX.XX
= Total Profit:      $X,XXX.XX
```

### 8.2 Transaction History View (MEDIUM PRIORITY)
Show a table of all completed trades:
```
Transaction #  Type      Chemical  Quantity  Price/Gal  Counterparty  Total      Date/Time
1              Sale      N         100       $5.00      Team 7        $500.00    Session 2
2              Purchase  D         150       $6.50      Team 3        $975.00    Session 2
```

### 8.3 Answer Report (END-OF-GAME)
Generate a post-game report showing:
- Final production quantities
- Which constraints were binding vs. non-binding
- Slack values for each resource
- Optimization status

### 8.4 Sensitivity Report (END-OF-GAME)
**MOST IMPORTANT FOR PEDAGOGY**

Show the final sensitivity analysis:
```
Resource Analysis
─────────────────────────────────────────────
Chemical C: Shadow Price $0.00    Status: Excess (90.91 gallons unused)
Chemical N: Shadow Price $1.82    Status: Binding (fully utilized)
Chemical D: Shadow Price $7.27    Status: Binding (fully utilized)
Chemical Q: Shadow Price $0.00    Status: Excess (272.73 gallons unused)

Interpretation:
✓ You should have BOUGHT more N and D (high shadow prices)
✓ You should have SOLD excess C and Q (zero shadow prices)
```

### 8.5 Enhanced Scoreboard
Ensure the leaderboard shows:
- Team name/number
- **Initial Profit** (baseline)
- **Current Profit** (live)
- **% Increase** (performance metric)
- Rank (sorted by % increase)

---

## 9. Recommendations for Digital Implementation

### Short-Term (Quick Wins)
1. ✅ Add **Financial Summary Panel** to main dashboard
2. ✅ Show **Initial Profit** and **% Increase** on leaderboard
3. ✅ Display **transaction history** in a modal or separate page

### Medium-Term (Enhanced Reporting)
4. ✅ Generate **post-session reports** showing:
   - Shadow prices for the session
   - Which resources were binding
   - Suggested trading strategy for next session
5. ✅ Add **"Why am I losing money?"** debug view showing:
   - Trades where team paid more than shadow price (bad buy)
   - Trades where team sold below shadow price (bad sell)

### Long-Term (Advanced Features)
6. ⚠️ **End-of-game analysis report** (like Excel's Answer + Sensitivity Reports)
7. ⚠️ **Trade recommendation engine** highlighting:
   - "You have excess C (shadow price $0) - consider selling"
   - "You need more D (shadow price $7.27) - consider buying"
8. ⚠️ **Instructor dashboard** showing:
   - Which teams are making good vs. bad trades
   - Which teams understand shadow prices
   - Aggregate market statistics

---

## 10. Python Extraction Scripts

Two scripts are available for continued analysis:

### 10.1 `bin/extract_excel_info.py`
Extracts structure, formulas, and sheet layouts. Run with:
```bash
python3 bin/extract_excel_info.py
```
Output: `bin/excel_extraction.json`

### 10.2 VBA Macro Extraction
Extract VBA code with:
```bash
olevba "unused/archive/Deicer and Solvent Model Blank Template 19Dect2025.xlsm" > bin/vba_macros_extracted.txt
```

---

## 11. Conclusion

The Excel template reveals a **highly structured, instructor-mediated trading system** with automatic solver integration and comprehensive reporting. The digital implementation should:

1. **Preserve** the shadow price pedagogy (already done ✓)
2. **Add** financial summary breakdown visibility
3. **Create** end-of-game sensitivity analysis reports
4. **Display** initial profit and % increase on leaderboard
5. **Show** transaction history to teams
6. **Consider** post-session "trade review" reports

The VBA macros show that the original game had **immediate solver recalculation after each trade**, which is pedagogically powerful but computationally expensive. The digital version's scheduled LP solver runs are a reasonable compromise.

---

**Generated:** 2026-01-08
**Analysis By:** Claude Code + Python (openpyxl, olevba)
