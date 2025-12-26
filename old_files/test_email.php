<?php
$to = "priya.prakash@stonybrook.edu";
$subject = "Test Email from PHP";
$message = "Hello Priya, this is a test email sent using PHP's mail() function.";
$headers = "From: sender@example.com\r\n";
$headers .= "Reply-To: sender@example.com\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

if (mail($to, $subject, $message, $headers)) {
    echo "Email sent successfully!";
} else {
    echo "Email sending failed.";
}

?>