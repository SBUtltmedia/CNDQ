<?php
require "spreadsheet.php";
require "group.php";
require "util.php";
$util = new Util();

$spreadsheet = new Spreadsheet("1vkRW7B33edqK_tlkcMFeVsaZowG_7PnjAwBkb2LN9n8");
$values      = $spreadsheet->getRange("Roles!A1:C10");
$array       = $util->csvToAssociative($values);

$groupRoles = array_filter($array, function ($item) {
 $group = new Group();

 return $item["Group"] == $group->group;});

print_r($util->str_putcsv($groupRoles));
