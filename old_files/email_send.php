<?php
function sendEmail($queryString, $to, $firstName, $lastName, $columnH, $data) {
    $server = $_ENV['VIRTUAL_HOST'] ?? 'apps.tlt.stonybrook.edu';

    $folderName = "sbuApprove";

    $approvalLink = "https://$server/show_row.html?$queryString";
    if ($server === 'apps.tlt.stonybrook.edu') {
        $approvalLink = "https://$server/$folderName/show_row.html?$queryString";
    }
    
    $to = "$to";
    $subject = "$firstName $lastName has requested an approval for \"$columnH\"";

    $formattedData = "";
    foreach ($data as $pair) {
        $key = $pair[0]; //header is at 0 index
        $value = $pair[1]; //value is at 1 index

    // foreach ($data[0] as $key => $value) {

        if (stripos($key, 'approval') !== false || stripos($key, 'form processed') !== false) {
            continue;
        }
    
        if (stripos($key, 'timestamp') !== false) {
            $key = "Time Submitted";
        }
    
        $formattedData .= "<strong>$key:</strong> $value<br>";
    }



    $message = "
        <html>
        <head>
            <title>Approval Request</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
                .approval-link { margin-top: 20px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class='container'>
                <h3>Approval Request Details</h3>
                <p><strong>Request from:</strong> $firstName $lastName</p>
                <p><strong>Topic:</strong> $columnH</p>
                <hr>
                <p>$formattedData</p>
            </div>
            <div class='approval-link'>

                <p><strong>You can access the new record here and give your approval:</strong> 
                <a href='$approvalLink' style='color: blue; text-decoration: underline;'>Approval Link</a></p>
            </div>
        </body>
        </html>
    ";

    $headers = "From: tltmedialab@connect.stonybrook.edu\r\n" .
               "Reply-To: tltmedialab@connect.stonybrook.edu\r\n" .
               "MIME-Version: 1.0\r\n" .
               "Content-Type: text/html; charset=UTF-8\r\n" .
               "X-Mailer: PHP/" . phpversion();


    mail($to, $subject, $message, $headers);
}
?>
