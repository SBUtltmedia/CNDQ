<?php
class Util
{

    public function str_putcsv($data)
    {
        # Generate CSV data from array
        $fh = fopen('php://temp', 'rw'); # don't create a file, attempt
        # to use memory instead

        # write out the headers
        fputcsv($fh, array_keys(current($data)));

        # write out the data
        foreach ($data as $row) {
            fputcsv($fh, $row);
        }
        rewind($fh);
        $csv = stream_get_contents($fh);
        fclose($fh);

        return $csv;
    }
    public function csvToAssociative($values)
    {
        function _combine_array(&$row, $key, $header)
        {
            $row = array_combine($header, $row);
        }
        $array = array_map('str_getcsv', str_getcsv($values, "\n"));

        $header = array_shift($array);

        array_walk($array, '_combine_array', $header);

        return $array;
    }

    public function numberToColumnName($num)
    {
        $numeric = ($num - 1) % 26;
        $letter = chr(65 + $numeric);
        $num2 = intval(($num - 1) / 26);
        if ($num2 > 0) {
            return Util::numberToColumnName($num2) . $letter;
        } else {
            return $letter;
        }
    }

    public function columnNameToNumber($columnName)
    {
        $columnName = strtoupper($columnName);
        $length = strlen($columnName);
        $number = 0;
        for ($i = 0; $i < $length; $i++) {
            $number = $number * 26 + ord($columnName[$i]) - ord('A') + 1;
        }
        return $number;
    }
    public function stripQuotes($text) {
        return preg_replace('/^(\'(.*)\'|"(.*)")$/', '$2$3', $text);
      }


    public function returnQueryString($assocArray){
        $queryString = "";
        foreach ($assocArray as $key => $value) {
            $queryString.="$key=$value&";
        }
        //remove the last &
        $queryString = rtrim($queryString, '&'); 

        return $queryString;
    }



}
