<?php
require 'vendor/autoload.php';
require 'spreadsheet.php';

// $spreadsheetId = "1qCXZyon6chwQreXi8eBbaZ6Qmu5jWwJ2bFcvvVUmqXk";
$spreadsheet = new Spreadsheet($spreadsheetId);
$sheetName = "Sheet1";

$rowId = 2;

$processedData = strtolower(trim($spreadsheet->getCellFromRowByHeader("Processed", $rowId) ?? ""));
echo "Here $processedData";