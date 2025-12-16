<?php
require 'vendor/autoload.php';
require 'spreadsheet.php';
require 'email_send.php';

$spreadsheetId = "1jA4Irh9G5XM4ePbWZAosnroMu0rY5vGvuc671TtykeA";
$spreadsheet = new Spreadsheet($spreadsheetId);

$highestRow = $spreadsheet->getHighestRow("Sheet1");
// $highestRow =2;

$columnMap = [
    "1" => "Email address of thesis director/course director/GPD/ English faculty nominee (MA/BA program) for approval",
    "2" => "Email address of second reader/committee member/English faculty nominee (MA/BA program)  (if relevant)",
    "3" => "Email address of third reader/committee member/English faculty nominee (MA/BA program)  (if relevant)" 
];

for ($rowId = 2; $rowId <= $highestRow; $rowId++) {
    $processedCell = strtolower(trim($spreadsheet->getRangeColumn("P", $rowId, $rowId)));
    // print($processedCell);   

    if (strpos($processedCell, "yes") === false) {
        $dataJson = json_decode($spreadsheet->getRange("A$rowId:Z$rowId", true), true);

        foreach ($columnMap as $approvalId => $columnName) {
            $emailAddress = $dataJson[0][$columnName] ?? "";
            $firstName = json_decode($spreadsheet->getRangeColumn("C", $rowId, $rowId), true)[0] ?? '';
            $lastName = json_decode($spreadsheet->getRangeColumn("D", $rowId, $rowId), true)[0] ?? '';
            $columnH = json_decode($spreadsheet->getRangeColumn("H", $rowId, $rowId), true)[0] ?? '';

            if (!empty($emailAddress)) {
                sendEmail($rowId - 1, $approvalId, $emailAddress, $firstName, $lastName, $columnH, $dataJson);
            }    

            $spreadsheet->updateRowColumn($rowId, "P", "Yes");
            }
    }
}
?>
