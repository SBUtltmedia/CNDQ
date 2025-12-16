<?php
require 'vendor/autoload.php';
require 'spreadsheet.php';

// $client = new Google_Client();
// $client->setApplicationName('Google Sheets API PHP');
// $client->setScopes([Google_Service_Sheets::SPREADSHEETS_READONLY]);
// $client->setAuthConfig('credentials.json'); 
// $client->setAccessType('offline');
// $service = new Google_Service_Sheets($client);
// $spreadsheetId = "1jA4Irh9G5XM4ePbWZAosnroMu0rY5vGvuc671TtykeA";
// $spreadsheet = new Spreadsheet($spreadsheetId);
// $range = $sheetName . "!A:Z";
// print($range);
// $response = $service->spreadsheets_values->get($spreadsheetId, $range);
// $values = $response->getValues();
// $column = "P";
// $highestRow = count($values);
// print($highestRow);
// $dataJson = json_decode($spreadsheet->getRangeColumn($column, 2, $highestRow ), true);
// print_r($dataJson);




// 2nd code
$spreadsheetId = "1jA4Irh9G5XM4ePbWZAosnroMu0rY5vGvuc671TtykeA";
$spreadsheet = new Spreadsheet($spreadsheetId);
$highestRow = $spreadsheet->getHighestRow("Sheet1");
$dataJson = json_decode($spreadsheet->getRangeColumn("P", 2, $highestRow), true);
print_r($dataJson);
?>

