<?php
require("spreadsheet.php");

$spreadsheet = new Spreadsheet("1PYWpfz4qNRZxb7ni7ybDVa7Tcs33NcBiHpoxrNXdSxo");
$sheetName = "Sheet1";

// Define the store file
$storeFile = "store.txt";

// Initialize default values
$lastFillRowId = 0;
$currentFillRowId = 0;

// Step 1: Read store.txt to get lastFillRowID and currentFillRowID
if (file_exists($storeFile)) {
    $storeData = file($storeFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    foreach ($storeData as $line) {
        if (strpos($line, "lastFillRowID=") !== false) {
            $lastFillRowId = (int) str_replace("lastFillRowID=", "", $line);
        }
        if (strpos($line, "currentFillRowID=") !== false) {
            $currentFillRowId = (int) str_replace("currentFillRowID=", "", $line);
        }
    }
}

// Step 2: Move currentFillRowId to lastFillRowID
$lastFillRowId = $currentFillRowId;

// Step 3: Set currentFillRowId to 0 temporarily
$currentFillRowId = 0;

// Step 4: Call method to get the updated last filled row ID
$currentFillRowId = $spreadsheet->getLastFilledRowId($sheetName);

// Step 5: Compare and update store.txt
    $storeData = "lastFillRowID=$lastFillRowId\n" .
                 "currentFillRowID=$currentFillRowId";

    file_put_contents($storeFile, $storeData);

?>
