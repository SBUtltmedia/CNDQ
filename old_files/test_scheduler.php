<?php
require 'vendor/autoload.php';
require 'spreadsheet.php';
require 'email_send.php';



$dbSpreadsheetId = "18RFkENSfxNkyDJY7S68ZWnSM_Ed_eIwzq9XnbxIjMIY";
$spreadsheet = new Spreadsheet($dbSpreadsheetId);



//iterate to find out the last row in "Record ID" sheet
$highestRow = $spreadsheet->getHighestRow("Sheet1");



//iterate over the "Record ID" sheet to find out whether the new rows/sheets/URLs have been added or not
for ($rowId = 2; $rowId <= $highestRow; $rowId++) {

    $headers = $spreadsheet->headers;


    $processedData = strtolower(trim($spreadsheet->getCellFromRowByHeader("Sheet Processed", $rowId) ?? ""));

    $sheetId = trim($spreadsheet->getCellFromRowByHeader("Google Sheet ID", $rowId) ?? "");

    // if the value of the column "Sheet Processed" is not yes it means its a new row so we call processingNewSheets() else processPendingApprovals()
    if (strpos($processedData, "yes") === false) {
        processingNewSheets($sheetId, $rowId);
        $sheetProcessedIndex = $spreadsheet->findHeaderIndex($headers, 'sheet processed');
        $sheetProcessedColumnLetter = $spreadsheet->util->numberToColumnName($sheetProcessedIndex + 1);
        $spreadsheet->updateRowColumn($rowId, $sheetProcessedColumnLetter, "Yes");
    } else {
        processPendingApprovals($sheetId, $rowId);
    }

}




// function to handle processed sheets in the "Record ID"
function processPendingApprovals($sheetId, $rowId) {
    $spreadsheetUpdate = new Spreadsheet($sheetId);

    $headers = $spreadsheetUpdate->headers;
    $highestRow = $spreadsheetUpdate->getHighestRow();


    for ($rowId = 2; $rowId <= $highestRow; $rowId++) {

    $approvalId = 0;

    $processedCell = strtolower(trim($spreadsheetUpdate->getCellFromRowByHeader("Form Processed", $rowId)?? ""));

    //if the "Form Processed is blank it means it hasnt been processed, there is a new student row so just send emails too all
    if (strpos($processedCell, "yes") === false) {
        $dataJson = json_decode($spreadsheetUpdate->getRange("A$rowId:Z$rowId", true), true);


        //check for all the headers with "e,mail address" in their name but excluding first two columns, to send emails.
        foreach ($headers as $index => $header) {

            if ($index < 2) continue;
            $headerValue = strtolower(trim($header));


            if (strpos($headerValue, "email address") !== false) {

                $approvalId++;

                $headerColumnLetter = $spreadsheetUpdate->util->numberToColumnName($index+1); //coz this method is 1-based
                $emailAddress = json_decode($spreadsheetUpdate->getRangeColumn($headerColumnLetter, $rowId, $rowId), true)[0] ?? '';


                $firstNameIndex = $spreadsheetUpdate->findHeaderIndex($headers, 'first name');
                $firstNameColumnLetter = $spreadsheetUpdate->util->numberToColumnName($firstNameIndex + 1);
                $firstName = json_decode($spreadsheetUpdate->getRangeColumn($firstNameColumnLetter, $rowId, $rowId), true)[0] ?? '';


                $lastNameIndex = $spreadsheetUpdate->findHeaderIndex($headers, 'last name');
                $lastNameColumnLetter = $spreadsheetUpdate->util->numberToColumnName($lastNameIndex + 1);
                $lastName = json_decode($spreadsheetUpdate->getRangeColumn($lastNameColumnLetter, $rowId, $rowId), true)[0] ?? '';


                $columnH = $spreadsheetUpdate->getSheetName($sheetId);


                if (!empty($emailAddress)) {
                    $sheetInfo = array("rowId"=>$rowId, "approvalId"=>"$approvalId", "sheetId"=>"$sheetId");
                    $queryString = $spreadsheetUpdate->util->returnQueryString($sheetInfo);
                    sendEmail($queryString, $emailAddress, $firstName, $lastName, $columnH, $dataJson);
                }    


                $formProcessedHIndex = $spreadsheetUpdate->findHeaderIndex($headers, 'form processed');
                $formProcessedColumnLetter = $spreadsheetUpdate->util->numberToColumnName($formProcessedHIndex + 1);
                $spreadsheetUpdate->updateRowColumn($rowId, $formProcessedColumnLetter, "Yes");
            }
        }

    }
            
    } 
}


//function to handle new sheets by making sure all their email addresses field have a corresponding "Approvals" section
// and last column is "Form Processed"
function processingNewSheets($sheetId, $rowId){
    $spreadsheetNew = new Spreadsheet($sheetId);
    $emailColumnsCount = 0;
    $index = 0;

    $columnsInserted=0;

    while ($index < count($spreadsheetNew->headers)) {
        $headers = $spreadsheetNew->headers;

        if ($index < 2) {
            $index++;
            continue;
        }

        $headerValue = strtolower(trim($headers[$index]));

        if (strpos($headerValue, "email address") !== false) {
            $emailColumnsCount++;

            $nextHeader = strtolower(trim($headers[$index + 1] ?? ""));

            if (strpos($nextHeader, "approval") === false) {
                $spreadsheetNew->insertColumnAtIndex($sheetId, "Approval " . $emailColumnsCount, $index + 1+ $columnsInserted);
                $headers = $spreadsheetNew->headers;
                $columnsInserted++;
            }
        }
        $index++;
    }

    $headers = $spreadsheetNew->headers;
    $lastColumnIndex = count($headers)+$columnsInserted;
    $lastHeaderValue = (strtolower(trim($headers[$lastColumnIndex-1])));
    if (strpos($lastHeaderValue, "form processed") === false){
    $spreadsheetNew->insertColumnAtIndex($sheetId, "Form Processed", $lastColumnIndex);
    }


    processPendingApprovals($sheetId, $rowId);
}

?>