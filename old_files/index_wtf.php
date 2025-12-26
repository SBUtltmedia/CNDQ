<?php
require("spreadsheet.php");

$spreadsheet = new Spreadsheet("1PYWpfz4qNRZxb7ni7ybDVa7Tcs33NcBiHpoxrNXdSxo");
$sheetName = "Sheet1";
$storeFile = "store.txt";

$lastFillRowId = 0;
$currentFillRowId = 0;

if (file_exists($storeFile)) {
    $storeData = file($storeFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    foreach ($storeData as $line) {
        if (strpos($line, "lastFillRowID=") !== false) {
            $lastFillRowId = (int) str_replace("lastFillRowID=", "", $line);
        }
        if (strpos($line, "currentFillRowID=") !== false) {
            $currentFillRowId = (int) str_replace("currentFillRowID=", "", $line);
        }
    }
}

if ($currentFillRowId <= $lastFillRowId) {
    exit;
}
//list of rows generate 
$rangeList = [];
for ($i = $lastFillRowId + 1; $i <= $currentFillRowId; $i++) {
    $rangeList[] = "{$sheetName}!A{$i}:B{$i}";
}

$response = $spreadsheet->batchGet($rangeList);

$dataRows = [];
if (!empty($response)) {
    foreach ($response as $range) {
        $data = $range->getValues();
        if (!empty($data)) {
            $dataRows[] = $data[0];
        }
    }
}

$newEnrollments = $currentFillRowId - $lastFillRowId;

// require 'send_email.php';
// sendEmail($newEnrollments);

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Sheets Data</title>
    <style>
        table {
            width: 50%;
            border-collapse: collapse;
            margin: 20px auto;
            font-family: Arial, sans-serif;
        }
        th, td {
            border: 1px solid black;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>
<body>

    <h2 style="text-align:center;">Fetched Data from Google Sheets</h2>

    <table>
        <tr>
            <th>ID</th>
       
        </tr>
        <?php if (!empty($dataRows)): ?>
            <?php foreach ($dataRows as $row): ?>
                <tr>
                    ?rowId=
                    <td><?php echo htmlspecialchars($row[0]); ?></td>
                    <td><?php echo htmlspecialchars($row[1]); ?></td>
                </tr>
            <?php endforeach; ?>
        <?php else: ?>
            <tr>
                <td colspan="2" style="text-align:center;">No Data Found</td>
            </tr>
        <?php endif; ?>
    </table>

</body>
</html> 