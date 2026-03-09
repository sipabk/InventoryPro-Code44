<?php
// ============================================================
// config.php - Application Configuration
// ============================================================

define('DB_HOST',     getenv('DB_HOST')     ?: 'localhost');
define('DB_NAME',     getenv('DB_NAME')     ?: 'inventory_db');
define('DB_USER',     getenv('DB_USER')     ?: 'root');
define('DB_PASS',     getenv('DB_PASS')     ?: '');
define('DB_CHARSET',  'utf8mb4');

define('APP_NAME',    'Inventory Manager');
define('APP_VERSION', '1.0.0');
define('APP_URL',     'http://localhost/inventory-app');
define('APP_DEBUG',   true);

// Session config
define('SESSION_NAME',    'INV_SESSION');
define('SESSION_TIMEOUT', 28800); // 8 hours

// Timezone
date_default_timezone_set('UTC');

// Error reporting
if (APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}
