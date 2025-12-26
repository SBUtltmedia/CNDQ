<?php
require 'vendor/autoload.php';
require 'spreadsheet.php';
require 'email_send.php';

// Main spreadsheet ID

$dbSpreadsheetId = "1qCXZyon6chwQreXi8eBbaZ6Qmu5jWwJ2bFcvvVUmqXk";

// print_r($_ENV);
// exit;

if (array_key_exists('DDEV_USER', $_ENV)) {
    $dbSpreadsheetId = "1eEGRFrrd93mKzseQEyO5eIrBvTfFHWWhs3UrtS_-HKI";
}

$masterSheet = new Spreadsheet($dbSpreadsheetId);

// Print the sheet name
$sheetName = $masterSheet->getSheetName($dbSpreadsheetId);
echo "Processing Master Sheet: $sheetName\n";

// 1. Read Master Sheet headers to find column positions dynamically
$masterSheetName = $masterSheet->getSheetName($dbSpreadsheetId);
$headerData = $masterSheet->getSheetData("$masterSheetName!1:1");
if (empty($headerData)) {
    die("Error: Master sheet is empty or inaccessible.\n");
}

// print_r($headerData);

$headers = array_map('strtolower', array_map('trim', $headerData[0]));

$sheetIdCol = array_search('google sheet id', $headers);
$processedCol = array_search('sheet processed', $headers);

if ($sheetIdCol === false || $processedCol === false) {
    $foundHeaders = implode("', '", $headers);
    die("Error: Could not find 'Google Sheet ID' and/or 'Sheet Processed' columns in master sheet. Please check spelling and spacing. Found headers: ['" . $foundHeaders . "']\n");
}

// Read all data from the master sheet
$masterSheetData = $masterSheet->getSheetData("$masterSheetName");


$sheetsToProcess = [];
if ($masterSheetData) {
    foreach ($masterSheetData as $rowIndex => $row) {
        if ($rowIndex == 0)
            continue; // Skip header row

        $sheetId = $row[$sheetIdCol] ?? null;
        // print_r($sheetId);
        $processedStatus = strtolower(trim($row[$processedCol] ?? ''));

        // print_r($processedStatus);


        if ($sheetId) {
            $sheetsToProcess[] = [
                'sheetId' => $sheetId,
                'isNew' => (strpos($processedStatus, 'yes') === false),
                'masterSheetRow' => $rowIndex + 1 // 1-based row index for updates
            ];
        }
    }
}

$rowsToMarkAsProcessed = [];

// 2. Process Each Sub-Sheet
foreach ($sheetsToProcess as $sheetInfo) {
    $sheetId = $sheetInfo['sheetId'];
    $isNew = $sheetInfo['isNew'];
    $subSheet = new Spreadsheet($sheetId);
    $spreadSheetTitle = $subSheet->getSpreadsheetTitle();
    $sheetName = $subSheet->getSheetName($sheetId);

    // Read all data from the sub-sheet at once

    $sheetQuery = "'" . $sheetName . "'!A:Z";

    $subSheetData = $subSheet->getSheetData($sheetQuery);

    if (empty($subSheetData)) {
        if ($isNew) {
            $rowsToMarkAsProcessed[] = $sheetInfo['masterSheetRow'];
        }
        continue; // Skip empty or inaccessible sheets
    }

    $originalHeaders = $subSheetData[0];
    $modifiedData = $subSheetData;

    // print_r($modifiedData);
    // exit;

    if ($isNew) {
        // print_r("Processing new sheet with ID: $sheetId\n");
        $modifiedData = processingNewSheets($modifiedData);
        // print_r($modifiedData);
        // exit;
        $rowsToMarkAsProcessed[] = $sheetInfo['masterSheetRow'];
    }

    $result = processPendingApprovals($modifiedData, $sheetId, $spreadSheetTitle);
    $finalData = $result['data'];

    // 3. Write Changes Back to Sub-Sheet
    $rowCount = count($finalData);
    $colCount = count($finalData[0]);
    $range = $sheetName . '!A1:' . $subSheet->util->numberToColumnName($colCount) . $rowCount;

    $subSheet->clearSheet($range);

    if ($finalData) {
        $subSheet->updateSheetData($range, $finalData);
    }
}

// 4. Batch Update Master Sheet
if (!empty($rowsToMarkAsProcessed)) {
    $updateData = [];
    $sheetProcessedColumn = $masterSheet->util->numberToColumnName($processedCol + 1);
    foreach ($rowsToMarkAsProcessed as $rowIndex) {
        $updateData[] = [
            'range' => "$masterSheetName!" . $sheetProcessedColumn . $rowIndex,
            'values' => [['Yes']]
        ];
    }
    $masterSheet->batchUpdateValues($updateData);
}

echo "Scheduler finished.\n";

function processingNewSheets(array $sheetData): array
{
    $originalHeaders = $sheetData[0];
    $dataRows = array_slice($sheetData, 1);

    $baseHeaders = [];
    $baseHeaderMap = [];
    $movedHeaders = [];
    $movedHeaderMap = [];

    // 1. Separate form-related columns from script-related columns
    foreach ($originalHeaders as $index => $header) {
        $lowerHeader = strtolower(trim($header));
        if (strpos($lowerHeader, "approval") !== false || strpos($lowerHeader, "form processed") !== false) {
            $movedHeaders[] = $header;
            $movedHeaderMap[] = $index;
        } else {
            $baseHeaders[] = $header;
            $baseHeaderMap[] = $index;
        }
    }

    $formProcessedFound = false;
    foreach ($movedHeaders as $h) {
        if (strpos(strtolower(trim($h)), "form processed") !== false) {
            $formProcessedFound = true;
            break;
        }
    }

    // 2. Identify missing "Approval" columns that need to be added
    $originalHeaderCount = count($originalHeaders);
    for ($i = 0; $i < $originalHeaderCount; $i++) {
        $header = $originalHeaders[$i];
        if (strpos(strtolower(trim($header)), "email address") !== false && $i > 2) {
            $nextIsApproval = ($i + 1 < $originalHeaderCount) && (strpos(strtolower(trim($originalHeaders[$i + 1])), "approval") !== false);
            if (!$nextIsApproval) {
                // Queue up a new "Approval" column. Mark it as new.
                $movedHeaders[] = "Approval new"; // Special name to signify it's new
                $movedHeaderMap[] = -1; // No old data to map from
            }
        }
    }

    // 3. Re-number and organize all "Approval" and "Form Processed" headers
    $approvalCount = 0;
    $finalApprovalHeaders = [];
    $formProcessedHeader = null;

    if (!$formProcessedFound) {
        $formProcessedHeader = "Form Processed";
    }

    foreach ($movedHeaders as $header) {
        $lowerHeader = strtolower(trim($header));
        if (strpos($lowerHeader, "form processed") !== false) {
            $formProcessedHeader = "Form Processed";
        } elseif (strpos($lowerHeader, "approval") !== false) {
            $approvalCount++;
            $finalApprovalHeaders[] = "Approval " . $approvalCount;
        }
    }

    // 4. Construct final header row
    $finalHeaders = $baseHeaders;
    if ($formProcessedHeader) {
        $finalHeaders[] = $formProcessedHeader;
    }
    $finalHeaders = array_merge($finalHeaders, $finalApprovalHeaders);

    // 5. Build the new data rows based on the new header order
    $newDataRows = [];
    foreach ($dataRows as $oldRow) {
        $newRow = [];

        // Add data for base columns
        foreach ($baseHeaderMap as $oldIndex) {
            $newRow[] = $oldRow[$oldIndex] ?? '';
        }

        // Add data for "Form Processed"
        if ($formProcessedHeader) {
            $formProcessedData = '';
            foreach ($movedHeaderMap as $i => $oldIndex) {
                if ($oldIndex !== -1 && strpos(strtolower(trim($movedHeaders[$i])), "form processed") !== false) {
                    $formProcessedData = $oldRow[$oldIndex] ?? '';
                    break;
                }
            }
            $newRow[] = $formProcessedData;
        }

        // Add data for "Approval" columns
        $approvalData = [];
        foreach ($movedHeaderMap as $i => $oldIndex) {
            if ($oldIndex !== -1 && strpos(strtolower(trim($movedHeaders[$i])), "approval") !== false) {
                $approvalData[] = $oldRow[$oldIndex] ?? '';
            }
        }
        
        $newRow = array_merge($newRow, $approvalData);

        // Pad the row with empty strings for any newly added columns
        $expectedCount = count($finalHeaders);
        $currentRowCount = count($newRow);
        for ($i = $currentRowCount; $i < $expectedCount; $i++) {
            $newRow[] = '';
        }

        $newDataRows[] = $newRow;
    }

    return array_merge([$finalHeaders], $newDataRows);
}

function processPendingApprovals(array $sheetData, string $sheetId, string $spreadSheetTitle): array
{
    $headers = $sheetData[0];
    $formProcessedIndex = -1;
    $firstNameIndex = -1;
    $lastNameIndex = -1;

    // Find header indices once
    foreach ($headers as $index => $header) {
        $lowerHeader = strtolower(trim($header));
        if (strpos($lowerHeader, "form processed") !== false)
            $formProcessedIndex = $index;
        if (strpos($lowerHeader, "first name") !== false)
            $firstNameIndex = $index;
        if (strpos($lowerHeader, "last name") !== false)
            $lastNameIndex = $index;
    }

    if ($formProcessedIndex === -1) {
        return ['data' => $sheetData]; // Cannot proceed
    }

    $emailColumnIndices = [];

    foreach ($headers as $index => $header) {
        if (strpos(strtolower(trim($header)), "email address") !== false) {
            $emailColumnIndices[] = $index;
        }
    }

    $keyCounts = [];

    foreach ($headers as $index => $key) {
        $originalKey = $key; //original current key with no changes, untouched
        $allLowerKey = trim(strtolower($key)); 

        $keyCounts[$allLowerKey] = ($keyCounts[$allLowerKey] ?? 0) + 1;

        // if the count is > 1 append the count to make the key unique
        if ($keyCounts[$allLowerKey] > 1) {
            // append the count like "Email Address 2", "Email Address 3")
            $originalKey = $key . ' ~' . $keyCounts[$allLowerKey];
        }
        
        // update the header in the sheetData[0]
        $sheetData[0][$index] = $originalKey;
    }


    for ($i = 1; $i < count($sheetData); $i++) {

        $processedStatus = strtolower(trim($sheetData[$i][$formProcessedIndex] ?? ''));

        if (strpos($processedStatus, "yes") === false) {
            $approvalId = 0;
            $firstName = ($firstNameIndex !== -1) ? ($sheetData[$i][$firstNameIndex] ?? '') : '';
            $lastName = ($lastNameIndex !== -1) ? ($sheetData[$i][$lastNameIndex] ?? '') : '';
            $emailIndicesToProcess = array_slice($emailColumnIndices, 1); //Eliminate the first email address
            foreach ($emailIndicesToProcess as $emailIndex) {
                $approvalId++;
                $emailAddress = $sheetData[$i][$emailIndex] ?? '';
                if (!empty($emailAddress)) {
                    $sheetInfo = ["rowId" => $i + 1, "approvalId" => $approvalId, "sheetId" => $sheetId];
                    $queryString = (new Util())->returnQueryString($sheetInfo);
                    $rawRowData = $sheetData[$i];
                    $paddedRowData = array_pad($rawRowData, count($headers), '');
                    // print_r($rawRowData);
                    // print_r($paddedRowData);
                    // exit;
                    // $rowDataAssociative = array_combine($headers, $paddedRowData);
                    $rowDataAssociative = array_map(null, $headers, $paddedRowData);
                    // print_r($rowDataAssociative);
                    // $rowDataForEmail = [$rowDataAssociative];
                    // print_r($rowDataForEmail);
                    // exit;

                    // print_r($rowDataForEmail);
                    // exit;

                    sendEmail($queryString, $emailAddress, $firstName, $lastName, $spreadSheetTitle, $rowDataAssociative);
                }
            }

            $sheetData[$i] = $sheetData[$i] + array_fill(0, count($headers), '');
            $sheetData[$i][$formProcessedIndex] = "Yes";

            // print_r($sheetData);
            // exit;
        }
    }

    return ['data' => $sheetData];

}
?>
