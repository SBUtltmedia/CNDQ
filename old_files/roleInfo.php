<?php
require "spreadsheet.php";
require "group.php";
require "util.php";
$util = new Util();

$spreadsheet = new Spreadsheet("1vkRW7B33edqK_tlkcMFeVsaZowG_7PnjAwBkb2LN9n8");
$values      = $spreadsheet->getRange("Role Info!A1:D122");
print($values);