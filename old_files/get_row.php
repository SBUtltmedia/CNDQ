<?php
require 'vendor/autoload.php';
require 'spreadsheet.php';

// print_r($_GET);
// exit;


$spreadsheetId = $_GET["sheetId"];
$rowId = intval($_GET["rowId"]);
$approvalId = intval($_GET["approvalId"]);
// $spreadsheetId = "1jA4Irh9G5XM4ePbWZAosnroMu0rY5vGvuc671TtykeA";
$sheetName = "Sheet1";



$spreadsheet = new Spreadsheet($spreadsheetId);



//asJson true means op is json
$dataJson = json_decode($spreadsheet->getRange("A$rowId:ZZ$rowId"));
echo json_encode($dataJson[0]);
?>