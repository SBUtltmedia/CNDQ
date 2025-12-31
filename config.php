<?php
// Dynamically calculate the application's base path
$docRoot = $_SERVER['DOCUMENT_ROOT'];
$appDir = __DIR__;
$basePath = str_replace($docRoot, '', $appDir);
$basePath = str_replace('\\', '/', $basePath); // Normalize for Windows
if ($basePath === '/') {
    $basePath = ''; // Don't use a single slash for root deployments
}

$sheetId     = "1YvSAxbFty76hR1_mnKVzuEnEYc33xuaHvfW6Tsr2rso"; 
$sheetName   = "Groups";   
$credentials = __DIR__ . "/credentials.json";
// $headerRange= $spreadsheet->getRange("$sheetName!A1:1");
// $header        = preg_split("/,/",trim ($headerRange));
?>
