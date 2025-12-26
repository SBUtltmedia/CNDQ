<?php
require 'vendor/autoload.php';
require 'util.php';

$util = new Util();

$columnName= $util->numberToColumnName(18000);

echo "$columnName";