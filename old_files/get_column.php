<?php
require 'vendor/autoload.php';
require 'spreadsheet.php';

$spreadsheetId = "1jA4Irh9G5XM4ePbWZAosnroMu0rY5vGvuc671TtykeA";
$spreadsheet = new Spreadsheet($spreadsheetId);

$column = "P";
$highestRow = 2;

// $column = strtoupper($_GET["column"] ?? "");
// $highestRow = (int) ($_GET["highestRow"] ?? 0);
              
// Validate that the column input A-XFD
// if (!preg_match('/^[A-Z]{1,3}$/', $column)) {
//     exit;
// }

$dataJson = $spreadsheet->getRangeColumn($column, 2, $highestRow);
echo $dataJson;
?>