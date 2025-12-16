<?php
require("spreadsheet.php");
require("config.php");

$spreadsheet=new Spreadsheet($sheetId);
$values=$spreadsheet->getRange("$sheetName!A1:5000");

$headers = $values[0];

$groups = array();

foreach($values as $lineNumber => $lineContent){
    if($lineNumber==0) continue; // skip header line

    $row = array();

    foreach($lineContent as $index => $values){
     
        $row[$headers[$index]]=$values;

    }

    array_push($groups, $row);

}

print_r(json_encode($groups));