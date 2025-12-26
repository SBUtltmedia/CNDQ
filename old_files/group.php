<?php
class Group{

function __construct () {

    if(php_sapi_name()==="cli")
  {  $this->group =1; }
  else 
  {

    $m=preg_match('/Group_(\d*)/' ,$_SERVER['REQUEST_URI'],$matches);
$this->group =$matches[1];  }
  }
}

