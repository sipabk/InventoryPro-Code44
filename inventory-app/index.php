<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/includes/Database.php';
require_once __DIR__ . '/includes/Auth.php';

session_name(SESSION_NAME);
session_start();

$auth = new Auth();

// Handle logout
if (isset($_GET['logout'])) {
    $auth->logout();
    header('Location: ' . APP_URL . '/index.php');
    exit;
}

$isLoggedIn = $auth->isLoggedIn();
$user       = $auth->getCurrentUser();
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= htmlspecialchars(APP_NAME) ?></title>
<link rel="stylesheet" href="assets/css/app.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>

<?php if (!$isLoggedIn): ?>
<!-- ============ LOGIN PAGE ============ -->
<div id="login-page" class="login-page">
  <div class="login-card">
    <div class="login-logo">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="10" fill="#3b82f6"/><path d="M12 20h16M20 12v16" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>
      <h1><?= htmlspecialchars(APP_NAME) ?></h1>
    </div>
    <p class="login-subtitle">Sign in to your account</p>
    <div id="login-error" class="alert alert-danger" style="display:none"></div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" id="login-email" placeholder="admin@inventory.local" value="admin@inventory.local">
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="login-password" placeholder="••••••••" value="password">
    </div>
    <button class="btn btn-primary btn-full" onclick="doLogin()">
      <span id="login-btn-text">Sign In</span>
    </button>
    <p class="login-hint">Default: admin@inventory.local / password</p>
  </div>
</div>

<?php else: ?>
<!-- ============ MAIN APP ============ -->
<div id="app">

  <!-- Sidebar -->
  <nav id="sidebar" class="sidebar">
    <div class="sidebar-header">
      <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><rect width="40" height="40" rx="8" fill="#3b82f6"/><path d="M12 20h16M20 12v16" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>
      <span><?= htmlspecialchars(APP_NAME) ?></span>
      <button class="sidebar-close" onclick="toggleSidebar()">✕</button>
    </div>
    <ul class="nav-list">
      <li><a href="#" class="nav-link" data-page="dashboard"><span class="nav-icon">📊</span>Dashboard</a></li>
      <li><a href="#" class="nav-link" data-page="products"><span class="nav-icon">📦</span>Products</a></li>
      <li><a href="#" class="nav-link" data-page="categories"><span class="nav-icon">🗂</span>Categories</a></li>
      <li><a href="#" class="nav-link" data-page="warehouses"><span class="nav-icon">🏭</span>Warehouses</a></li>
      <li><a href="#" class="nav-link" data-page="suppliers"><span class="nav-icon">🏢</span>Suppliers</a></li>
      <li><a href="#" class="nav-link" data-page="purchase-orders"><span class="nav-icon">🛒</span>Purchase Orders</a></li>
      <li><a href="#" class="nav-link" data-page="transactions"><span class="nav-icon">↔️</span>Transactions</a></li>
      <li><a href="#" class="nav-link" data-page="warranties"><span class="nav-icon">🛡</span>Warranties</a></li>
      <li><a href="#" class="nav-link" data-page="adjustments"><span class="nav-icon">📋</span>Adjustments</a></li>
      <li><a href="#" class="nav-link" data-page="reports"><span class="nav-icon">📈</span>Reports</a></li>
      <li><a href="#" class="nav-link" data-page="import-export"><span class="nav-icon">⬆️</span>Import/Export</a></li>
      <li><a href="#" class="nav-link" data-page="activity-logs"><span class="nav-icon">📝</span>Activity Logs</a></li>
      <?php if ($user['role'] === 'admin'): ?>
      <li><a href="#" class="nav-link" data-page="users"><span class="nav-icon">👥</span>Users</a></li>
      <li><a href="#" class="nav-link" data-page="settings"><span class="nav-icon">⚙️</span>Settings</a></li>
      <?php endif; ?>
    </ul>
    <div class="sidebar-footer">
      <div class="user-info">
        <div class="avatar"><?= strtoupper(substr($user['name'] ?? $user['email'], 0, 1)) ?></div>
        <div>
          <div class="user-name"><?= htmlspecialchars($user['name'] ?? $user['email']) ?></div>
          <div class="user-role"><?= htmlspecialchars($user['role']) ?></div>
        </div>
      </div>
      <a href="?logout=1" class="btn btn-ghost btn-sm">Logout</a>
    </div>
  </nav>

  <!-- Main Content -->
  <div id="main-content" class="main-content">
    <!-- Topbar -->
    <header class="topbar">
      <button class="btn btn-ghost btn-icon" onclick="toggleSidebar()">☰</button>
      <h2 id="page-title">Dashboard</h2>
      <div class="topbar-right">
        <span class="badge badge-info"><?= htmlspecialchars($user['role']) ?></span>
      </div>
    </header>

    <!-- Page Container -->
    <div id="page-container" class="page-container">
      <div id="page-content">
        <!-- Pages rendered here by JS -->
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>
  </div>
</div>

<!-- Modal -->
<div id="modal-overlay" class="modal-overlay" style="display:none" onclick="closeModal(event)">
  <div class="modal" id="modal-box">
    <div class="modal-header">
      <h3 id="modal-title">Modal</h3>
      <button class="btn btn-ghost btn-icon" onclick="hideModal()">✕</button>
    </div>
    <div class="modal-body" id="modal-body"></div>
    <div class="modal-footer" id="modal-footer"></div>
  </div>
</div>

<!-- Toast container -->
<div id="toast-container"></div>

<script>
  const APP_URL  = '<?= APP_URL ?>';
  const API_BASE = '<?= APP_URL ?>/api/index.php?path=';
  const CURRENT_USER = <?= json_encode($user) ?>;
</script>
<script src="assets/js/app.js"></script>

<?php endif; ?>
</body>
</html>
