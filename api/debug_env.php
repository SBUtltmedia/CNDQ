<?php
header('Content-Type: application/json');
echo json_encode([
    'file' => __FILE__,
    'dir' => __DIR__,
    'doc_root' => $_SERVER['DOCUMENT_ROOT'],
    'cwd' => getcwd(),
    'opcache' => function_exists('opcache_get_status') ? opcache_get_status(false) : 'not enabled'
], JSON_PRETTY_PRINT);
