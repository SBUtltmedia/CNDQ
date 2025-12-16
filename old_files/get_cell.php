<?php
require 'vendor/autoload.php';
require 'spreadsheet.php';

// print_r($_GET);
// exit;

$sheetId = $_GET["sheetId"];
$rowId = $_GET["rowId"];
$approvalId = $_GET["approvalId"];

// $sheetId = "1A6RsAaSj6YEbwER22qyJXuQHWU43USiNj-qSSrgKdcU";
// $rowId = 2;
// $approvalId = 1;


$spreadsheet = new Spreadsheet($sheetId);
$columnName = "Approval $approvalId";
// print($columnName);

$dataJson = json_decode($spreadsheet->getRange("A$rowId:Z$rowId", true), true); 
// print_r($dataJson);

$approval_status = $dataJson[0][$columnName] ?? ""; 
echo json_encode(["approval_status" => $approval_status]);

?>
