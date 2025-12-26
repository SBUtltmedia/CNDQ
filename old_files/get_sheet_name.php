<?php
require 'vendor/autoload.php';
require 'spreadsheet.php';

$sheetId = "1We3d3XS7fyX6GJujUGc1DFT-Al4IroE8w_yx3EryaRs";
$spreadsheet = new Spreadsheet($sheetId);

$sheetName = $spreadsheet->getSheetName($sheetId);
echo $sheetName;
?>