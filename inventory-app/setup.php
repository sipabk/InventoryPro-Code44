<?php
// setup.php - One-time installation helper
// DELETE this file after setup!

$step = (int)($_GET['step'] ?? 1);
$msg  = '';
$err  = '';

if ($step === 2 && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $host   = $_POST['db_host']   ?? 'localhost';
    $name   = $_POST['db_name']   ?? 'inventory_db';
    $user   = $_POST['db_user']   ?? 'root';
    $pass   = $_POST['db_pass']   ?? '';
    $appUrl = rtrim($_POST['app_url'] ?? 'http://localhost/inventory-app', '/');

    try {
        $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

        // Create database
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$name`");

        // Run schema
        $sql = file_get_contents(__DIR__ . '/sql/schema.sql');
        $statements = array_filter(array_map('trim', explode(';', $sql)));
        foreach ($statements as $stmt) {
            if ($stmt) $pdo->exec($stmt);
        }

        // Write config
        $config = "<?php\ndefine('DB_HOST',     '$host');\ndefine('DB_NAME',     '$name');\ndefine('DB_USER',     '$user');\ndefine('DB_PASS',     '$pass');\ndefine('DB_CHARSET',  'utf8mb4');\ndefine('APP_NAME',    'Inventory Manager');\ndefine('APP_VERSION', '1.0.0');\ndefine('APP_URL',     '$appUrl');\ndefine('APP_DEBUG',   false);\ndefine('SESSION_NAME',    'INV_SESSION');\ndefine('SESSION_TIMEOUT', 28800);\ndate_default_timezone_set('UTC');\nerror_reporting(0);\nini_set('display_errors', 0);\n";
        file_put_contents(__DIR__ . '/config.php', $config);

        $msg = 'Installation complete! <a href="' . htmlspecialchars($appUrl) . '/index.php">Go to App →</a><br><br><strong>⚠️ Delete setup.php now for security!</strong>';
        $step = 3;
    } catch (Exception $e) {
        $err = 'Error: ' . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Inventory Manager Setup</title>
<style>
body{font-family:system-ui,sans-serif;background:#f0f4f8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:white;border-radius:12px;padding:40px;max-width:500px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,.1)}
h1{font-size:24px;margin-bottom:24px;color:#1e293b}
.form-group{margin-bottom:16px}label{display:block;font-weight:500;margin-bottom:6px;font-size:13px}
input{width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;box-sizing:border-box}
.btn{background:#3b82f6;color:white;padding:10px 20px;border:none;border-radius:8px;font-size:14px;cursor:pointer;width:100%}
.alert{padding:12px;border-radius:8px;margin-bottom:16px}
.alert-danger{background:#fee2e2;color:#991b1b}.alert-success{background:#dcfce7;color:#166534}
</style></head>
<body>
<div class="card">
  <h1>🗄 Inventory Manager Setup</h1>
  <?php if ($err): ?><div class="alert alert-danger"><?= htmlspecialchars($err) ?></div><?php endif; ?>
  <?php if ($msg): ?><div class="alert alert-success"><?= $msg ?></div><?php endif; ?>

  <?php if ($step < 3): ?>
  <form method="post" action="setup.php?step=2">
    <div class="form-group"><label>Database Host</label><input name="db_host" value="localhost" required></div>
    <div class="form-group"><label>Database Name</label><input name="db_name" value="inventory_db" required></div>
    <div class="form-group"><label>Database User</label><input name="db_user" value="root" required></div>
    <div class="form-group"><label>Database Password</label><input type="password" name="db_pass"></div>
    <div class="form-group"><label>App URL (no trailing slash)</label><input name="app_url" value="http://localhost/inventory-app" required></div>
    <br>
    <button type="submit" class="btn">Install Database & Configure →</button>
  </form>
  <?php endif; ?>
</div>
</body></html>
