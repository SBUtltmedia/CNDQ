<?php
require_once __DIR__ . '/vendor/autoload.php';
require_once 'spreadsheet.php'; 

$spreadsheetId = '1Pvy5BcYYVFoJNcaclT9pRYlA2VP77AvuIrWheFpa-lE';
$spreadsheet = new Spreadsheet($spreadsheetId);

echo "here";
// $spreadsheet->addNewColumnToEnd($spreadsheetId, 'Form Processed');


$columnIndex = 10; // Follows 0-based indexing at which position do you want the new column, 10 means K
$spreadsheet->insertColumnAtIndex($spreadsheetId, 'Approval 1', $columnIndex);


echo "added";