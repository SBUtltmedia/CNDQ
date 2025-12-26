<?php
require("spreadsheet.php");

// print_r($_GET);
// exit;   

// $sheetId = "1A6RsAaSj6YEbwER22qyJXuQHWU43USiNj-qSSrgKdcU";
$sheetId = $_GET["sheetId"];

$spreadsheet = new Spreadsheet($sheetId);


// $rowId = "3";
// $approval_status = "Yes";
// $approvalId = "1";
$rowId = $_GET["rowId"];
$approval_status = $_GET["approval_status"];
$approvalId = $_GET["approvalId"];



$headers = $spreadsheet->headers;
$approvalColumn= "Approval {$approvalId}";
$approvalColumnIndex = $spreadsheet->findHeaderIndex($headers, $approvalColumn);
$approvalColumnLetter = $spreadsheet->util->numberToColumnName($approvalColumnIndex + 1);




$spreadsheet->updateRowColumn($rowId, $approvalColumnLetter, $approval_status);
?>