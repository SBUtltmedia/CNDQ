<?php
require "spreadsheet.php";
require "group.php";
require "util.php";

$sheetName     = "Game States";
$testData      = $_POST;
$spreadsheetId = "1vkRW7B33edqK_tlkcMFeVsaZowG_7PnjAwBkb2LN9n8";
$group         = new Group();
$util          = new Util();
$line          = $group->group + 1;
$spreadsheet   = new Spreadsheet($spreadsheetId);
$requestBody   = new Google_Service_Sheets_BatchUpdateValuesRequest();
$headerRange= $spreadsheet->getRange("$sheetName!A1:1");
$header        = preg_split("/,/",trim ($headerRange));
$data          = array();
foreach ($testData as $key => $value) {
 $headerIndex = array_search($key, $header);
 if (!$headerIndex) {
  $header[]    = $key;
  $headerIndex = count($header) - 1;
 }
$columnName= $util->numberToColumnName($headerIndex+1);

$batchItem=['range'=>"$sheetName!$columnName$line",'values'=>[[$util->stripQuotes($value)]]];
$data[] = new Google_Service_Sheets_ValueRange($batchItem);

print_r($key." ".$value);
}
$values = $spreadsheet->updateRange("$sheetName!A1:1", [$header]);
$body = new Google_Service_Sheets_BatchUpdateValuesRequest(array(
  'valueInputOption' => "USER_ENTERED",
  'data' => $data
));
//for ($i =1;$i<80;$i++)print_r($util->numberToColumnName($i)."\n");
$result = $spreadsheet->service->spreadsheets_values->batchUpdate($spreadsheetId, $body);
// $result = $service->spreadsheets_values->batchUpdate($spreadsheetId, $body);


//$response = $service->spreadsheets_values->batchUpdate($spreadsheetId, $requestBody);

// $range_number = 1; // Keep spreadsheet header
// $data = array();
// for($i=0;$i<count($data);$i++){
//     $range_number++;
//     $range = 'Sheet1!A'.$range_number.':XX';
//     $values = array( array($data1[$i], $data2[$i], $data3[$i]) );
//     $data[] = new Google_Service_Sheets_ValueRange(
//         array( 'range' => $range, 'values' => $values )
//     );
// }
// $body = new Google_Service_Sheets_BatchUpdateValuesRequest(array(
//   'valueInputOption' => "USER_ENTERED",
//   'data' => $data
// ));
// $result = $service->spreadsheets_values->batchUpdate($spreadsheetId, $body);

// // Clear rest of spreadsheet
// $range_number++;
// $range = 'Sheet1!A'.$range_number.':XX';
// $clearRange = new Google_Service_Sheets_ClearValuesRequest();
// $service->spreadsheets_values->clear($spreadsheetId, $range, $clearRange

//print_r($_POST);
