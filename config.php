<?php
// Dynamically calculate the application's base path based on the current request
// This ensures the basePath matches the casing used in the URL (e.g., /cndq vs /CNDQ)
$requestUri = $_SERVER['REQUEST_URI'];
$scriptName = $_SERVER['SCRIPT_NAME'];

// Find the position of the project folder in the script name
$projectFolder = '/CNDQ';
$pos = stripos($scriptName, $projectFolder);

if ($pos !== false) {
    // Extract the actual casing used in the URI
    $actualCasing = substr($requestUri, $pos, strlen($projectFolder));
    $basePath = $actualCasing;
} else {
    // Fallback to detection from directory structure
    $docRoot = str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT']);
    $appDir = str_replace('\\', '/', __DIR__);
    $basePath = str_replace($docRoot, '', $appDir);
    if ($basePath === '/') $basePath = '';
}

$sheetId     = "1YvSAxbFty76hR1_mnKVzuEnEYc33xuaHvfW6Tsr2rso"; 
$sheetName   = "Groups";   
$credentials = __DIR__ . "/credentials.json";
// $headerRange= $spreadsheet->getRange("$sheetName!A1:1");
// $header        = preg_split("/,/",trim ($headerRange));
?>
