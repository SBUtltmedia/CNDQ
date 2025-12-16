<?php

require __DIR__ . '/vendor/autoload.php';
require 'spreadsheet.php';

// Replace 'YOUR_SPREADSHEET_ID' with your actual Google Sheet ID
// $sheetId = '1qCXZyon6chwQreXi8eBbaZ6Qmu5jWwJ2bFcvvVUmqXk';

try {
    $spreadsheet = new Spreadsheet($sheetId);

    // Test case 1: A range in the middle of the sheet
    $range = 'C2:E5';
    echo "Testing range: $range\n";
    $data = $spreadsheet->getRange($range);
    echo $data;
    echo "\n\n";

    // Test case 2: A range starting from A
    $rangeA = 'A2:B4';
    echo "Testing range: $rangeA\n";
    $dataA = $spreadsheet->getRange($rangeA);
    echo $dataA;
    echo "\n\n";
    
    // Test case 3: A single cell range
    $rangeSingle = 'D10:D10';
    echo "Testing range: $rangeSingle\n";
    $dataSingle = $spreadsheet->getRange($rangeSingle);
    echo $dataSingle;
    echo "\n";


} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage();
}


