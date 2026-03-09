<?php
// api/index.php  - REST API endpoint

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/Database.php';
require_once __DIR__ . '/../includes/Auth.php';

session_name(SESSION_NAME);
session_start();

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

$auth = new Auth();
$db   = Database::getInstance();

$method   = $_SERVER['REQUEST_METHOD'];
$path     = trim($_GET['path'] ?? '', '/');
$segments = explode('/', $path);
$resource = $segments[0] ?? '';
$id       = isset($segments[1]) ? (int)$segments[1] : null;

$body = [];
if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? $_POST;
}

// ---- Public endpoints ----
if ($resource === 'auth') {
    $action = $segments[1] ?? '';
    if ($action === 'login' && $method === 'POST') {
        $result = $auth->login($body['email'] ?? '', $body['password'] ?? '');
        echo json_encode($result);
    } elseif ($action === 'logout') {
        $auth->logout();
        echo json_encode(['success' => true]);
    } elseif ($action === 'me') {
        $user = $auth->getCurrentUser();
        echo $user ? json_encode($user) : json_encode(['error' => 'Not authenticated']);
    }
    exit;
}

// ---- All other endpoints require auth ----
$auth->requireLogin();
$currentUser = $auth->getCurrentUser();

// ---- Route to resource handlers ----
try {
    switch ($resource) {
        case 'dashboard':  handleDashboard($db); break;
        case 'products':   handleResource($db, 'products', 'Product', $method, $id, $body); break;
        case 'categories': handleResource($db, 'categories', 'Category', $method, $id, $body); break;
        case 'warehouses': handleResource($db, 'warehouses', 'Warehouse', $method, $id, $body); break;
        case 'suppliers':  handleResource($db, 'suppliers', 'Supplier', $method, $id, $body); break;
        case 'transactions': handleTransactions($db, $method, $id, $body); break;
        case 'purchase-orders': handlePurchaseOrders($db, $method, $id, $body, $segments); break;
        case 'warranties': handleResource($db, 'warranties', 'Warranty', $method, $id, $body); break;
        case 'adjustments': handleAdjustments($db, $method, $id, $body); break;
        case 'users':      handleUsers($db, $method, $id, $body); break;
        case 'activity-logs': handleActivityLogs($db); break;
        case 'settings':   handleSettings($db, $method, $body); break;
        case 'reports':    handleReports($db); break;
        case 'import':     handleImport($db, $body); break;
        case 'export':     handleExport($db, $_GET['entity'] ?? ''); break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown resource']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

// ============================================================
// GENERIC CRUD RESOURCE HANDLER
// ============================================================
function handleResource(Database $db, string $table, string $entityName, string $method, ?int $id, array $body): void {
    switch ($method) {
        case 'GET':
            if ($id) {
                $row = $db->fetchOne("SELECT * FROM `$table` WHERE id = ?", [$id]);
                echo $row ? json_encode($row) : json_encode(['error' => 'Not found']);
            } else {
                $orderBy = sanitizeColumn($_GET['sort'] ?? 'id');
                $dir     = strtoupper($_GET['dir'] ?? 'ASC') === 'DESC' ? 'DESC' : 'ASC';
                $limit   = min((int)($_GET['limit'] ?? 500), 1000);
                $rows    = $db->fetchAll("SELECT * FROM `$table` ORDER BY `$orderBy` $dir LIMIT $limit");
                echo json_encode($rows);
            }
            break;
        case 'POST':
            $fields = buildInsert($table, $body);
            $newId  = $db->execute($fields['sql'], $fields['params']);
            Auth::logAction('create', $entityName, $newId, $body['name'] ?? "ID:$newId");
            echo json_encode(['id' => $newId, 'success' => true]);
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID required']); return; }
            $fields = buildUpdate($table, $body, $id);
            $db->executeUpdate($fields['sql'], $fields['params']);
            Auth::logAction('update', $entityName, $id, $body['name'] ?? "ID:$id");
            echo json_encode(['success' => true]);
            break;
        case 'DELETE':
            if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID required']); return; }
            $db->executeUpdate("DELETE FROM `$table` WHERE id = ?", [$id]);
            Auth::logAction('delete', $entityName, $id, "ID:$id");
            echo json_encode(['success' => true]);
            break;
    }
}

// ============================================================
// DASHBOARD STATS
// ============================================================
function handleDashboard(Database $db): void {
    $stats = [
        'total_products'   => $db->fetchOne('SELECT COUNT(*) as c FROM products WHERE status != "discontinued"')['c'],
        'total_stock'      => $db->fetchOne('SELECT SUM(quantity_in_stock) as c FROM products')['c'] ?? 0,
        'total_value'      => $db->fetchOne('SELECT SUM(quantity_in_stock * cost_price) as c FROM products')['c'] ?? 0,
        'total_warehouses' => $db->fetchOne('SELECT COUNT(*) as c FROM warehouses WHERE status = "active"')['c'],
        'total_suppliers'  => $db->fetchOne('SELECT COUNT(*) as c FROM suppliers WHERE status = "active"')['c'],
        'low_stock_count'  => $db->fetchOne('SELECT COUNT(*) as c FROM products WHERE quantity_in_stock <= reorder_level AND status = "active"')['c'],
        'expiring_warranties' => $db->fetchOne('SELECT COUNT(*) as c FROM warranties WHERE end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND status = "active"')['c'],
    ];

    $category_data = $db->fetchAll('
        SELECT c.name, SUM(p.quantity_in_stock) as total_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = "active"
        GROUP BY p.category_id, c.name
        ORDER BY total_stock DESC LIMIT 10
    ');

    $recent_transactions = $db->fetchAll('
        SELECT t.*, p.name as product_name, p.sku, w.name as warehouse_name
        FROM stock_transactions t
        LEFT JOIN products p ON t.product_id = p.id
        LEFT JOIN warehouses w ON t.warehouse_id = w.id
        ORDER BY t.created_at DESC LIMIT 10
    ');

    $monthly_movement = $db->fetchAll('
        SELECT
            DATE_FORMAT(transaction_date, "%Y-%m") as month,
            SUM(CASE WHEN type = "inward" THEN quantity ELSE 0 END) as inward,
            SUM(CASE WHEN type = "outward" THEN quantity ELSE 0 END) as outward
        FROM stock_transactions
        WHERE transaction_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(transaction_date, "%Y-%m")
        ORDER BY month ASC
    ');

    $low_stock = $db->fetchAll('
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.quantity_in_stock <= p.reorder_level AND p.status = "active"
        ORDER BY p.quantity_in_stock ASC LIMIT 10
    ');

    $warranty_alerts = $db->fetchAll('
        SELECT w.*, p.name as product_name, p.sku
        FROM warranties w
        LEFT JOIN products p ON w.product_id = p.id
        WHERE w.end_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND w.status IN ("active","expiring_soon")
        ORDER BY w.end_date ASC LIMIT 10
    ');

    echo json_encode(compact('stats', 'category_data', 'recent_transactions', 'monthly_movement', 'low_stock', 'warranty_alerts'));
}

// ============================================================
// TRANSACTIONS
// ============================================================
function handleTransactions(Database $db, string $method, ?int $id, array $body): void {
    if ($method === 'GET') {
        if ($id) {
            $row = $db->fetchOne('SELECT t.*, p.name as product_name, p.sku, w.name as warehouse_name, s.name as supplier_name FROM stock_transactions t LEFT JOIN products p ON t.product_id = p.id LEFT JOIN warehouses w ON t.warehouse_id = w.id LEFT JOIN suppliers s ON t.supplier_id = s.id WHERE t.id = ?', [$id]);
            echo json_encode($row ?: ['error' => 'Not found']);
        } else {
            $limit = min((int)($_GET['limit'] ?? 200), 1000);
            $rows  = $db->fetchAll("SELECT t.*, p.name as product_name, p.sku, w.name as warehouse_name FROM stock_transactions t LEFT JOIN products p ON t.product_id = p.id LEFT JOIN warehouses w ON t.warehouse_id = w.id ORDER BY t.created_at DESC LIMIT $limit");
            echo json_encode($rows);
        }
        return;
    }
    if ($method === 'POST') {
        // Validate
        if (empty($body['product_id']) || empty($body['type']) || !isset($body['quantity'])) {
            http_response_code(400); echo json_encode(['error' => 'product_id, type and quantity are required']); return;
        }
        // Generate transaction number
        if (empty($body['transaction_number'])) {
            $body['transaction_number'] = 'TXN-' . date('Ymd') . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        }
        $body['total_cost'] = ($body['quantity'] ?? 0) * ($body['unit_cost'] ?? 0);
        if (!isset($body['transaction_date'])) $body['transaction_date'] = date('Y-m-d');

        $db->beginTransaction();
        try {
            $fields = buildInsert('stock_transactions', $body);
            $newId  = $db->execute($fields['sql'], $fields['params']);

            // Update product stock for completed transactions
            if (($body['status'] ?? '') === 'completed' || ($body['status'] ?? '') === 'approved') {
                $product = $db->fetchOne('SELECT quantity_in_stock FROM products WHERE id = ?', [$body['product_id']]);
                if ($product) {
                    $qty = (float)$product['quantity_in_stock'];
                    $change = (float)$body['quantity'];
                    if (in_array($body['type'], ['inward', 'return'])) $qty += $change;
                    elseif (in_array($body['type'], ['outward'])) $qty = max(0, $qty - $change);
                    $db->executeUpdate('UPDATE products SET quantity_in_stock = ? WHERE id = ?', [$qty, $body['product_id']]);
                }
            }
            $db->commit();
            Auth::logAction('create', 'StockTransaction', $newId, $body['transaction_number']);
            echo json_encode(['id' => $newId, 'success' => true]);
        } catch (Exception $e) {
            $db->rollback();
            throw $e;
        }
        return;
    }
    if ($method === 'PUT' || $method === 'PATCH') {
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID required']); return; }
        $old = $db->fetchOne('SELECT * FROM stock_transactions WHERE id = ?', [$id]);
        $fields = buildUpdate('stock_transactions', $body, $id);
        $db->executeUpdate($fields['sql'], $fields['params']);
        // Handle approval status changes
        if (isset($body['status']) && in_array($body['status'], ['approved','completed']) && $old && $old['status'] === 'pending') {
            $product = $db->fetchOne('SELECT quantity_in_stock FROM products WHERE id = ?', [$old['product_id']]);
            if ($product) {
                $qty = (float)$product['quantity_in_stock'];
                $change = (float)$old['quantity'];
                if (in_array($old['type'], ['inward','return'])) $qty += $change;
                elseif ($old['type'] === 'outward') $qty = max(0, $qty - $change);
                $db->executeUpdate('UPDATE products SET quantity_in_stock = ? WHERE id = ?', [$qty, $old['product_id']]);
            }
        }
        Auth::logAction('update', 'StockTransaction', $id, "TXN ID:$id");
        echo json_encode(['success' => true]);
        return;
    }
    http_response_code(405); echo json_encode(['error' => 'Method not allowed']);
}

// ============================================================
// PURCHASE ORDERS
// ============================================================
function handlePurchaseOrders(Database $db, string $method, ?int $id, array $body, array $segments): void {
    // Special sub-actions: /purchase-orders/{id}/receive
    $action = $segments[2] ?? null;

    if ($method === 'GET') {
        if ($id) {
            $po = $db->fetchOne('SELECT po.*, s.name as supplier_name, w.name as warehouse_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id LEFT JOIN warehouses w ON po.warehouse_id = w.id WHERE po.id = ?', [$id]);
            if (!$po) { echo json_encode(['error' => 'Not found']); return; }
            $items = $db->fetchAll('SELECT poi.*, p.name as product_name, p.sku FROM purchase_order_items poi LEFT JOIN products p ON poi.product_id = p.id WHERE poi.po_id = ?', [$id]);
            $po['items'] = $items;
            echo json_encode($po);
        } else {
            $rows = $db->fetchAll('SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id ORDER BY po.created_at DESC LIMIT 500');
            echo json_encode($rows);
        }
        return;
    }
    if ($method === 'POST') {
        if ($action === 'receive' && $id) {
            receivePurchaseOrder($db, $id);
            return;
        }
        if (empty($body['supplier_id']) || empty($body['order_date'])) {
            http_response_code(400); echo json_encode(['error' => 'supplier_id and order_date are required']); return;
        }
        if (empty($body['po_number'])) {
            $body['po_number'] = 'PO-' . date('Ymd') . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        }
        $items = $body['items'] ?? [];
        unset($body['items']);

        $db->beginTransaction();
        try {
            $fields = buildInsert('purchase_orders', $body);
            $poId   = $db->execute($fields['sql'], $fields['params']);

            foreach ($items as $item) {
                $item['po_id'] = $poId;
                $item['total_cost'] = ($item['quantity_ordered'] ?? 0) * ($item['unit_cost'] ?? 0);
                $itemFields = buildInsert('purchase_order_items', $item);
                $db->execute($itemFields['sql'], $itemFields['params']);
            }
            $db->commit();
            Auth::logAction('create', 'PurchaseOrder', $poId, $body['po_number']);
            echo json_encode(['id' => $poId, 'po_number' => $body['po_number'], 'success' => true]);
        } catch (Exception $e) {
            $db->rollback();
            throw $e;
        }
        return;
    }
    if ($method === 'PUT' || $method === 'PATCH') {
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID required']); return; }
        $items = $body['items'] ?? null;
        unset($body['items']);
        $fields = buildUpdate('purchase_orders', $body, $id);
        $db->executeUpdate($fields['sql'], $fields['params']);
        if ($items !== null) {
            $db->executeUpdate('DELETE FROM purchase_order_items WHERE po_id = ?', [$id]);
            foreach ($items as $item) {
                $item['po_id']     = $id;
                $item['total_cost'] = ($item['quantity_ordered'] ?? 0) * ($item['unit_cost'] ?? 0);
                $f = buildInsert('purchase_order_items', $item);
                $db->execute($f['sql'], $f['params']);
            }
        }
        Auth::logAction('update', 'PurchaseOrder', $id, "PO ID:$id");
        echo json_encode(['success' => true]);
        return;
    }
    if ($method === 'DELETE') {
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID required']); return; }
        $db->executeUpdate('DELETE FROM purchase_orders WHERE id = ?', [$id]);
        Auth::logAction('delete', 'PurchaseOrder', $id, "PO ID:$id");
        echo json_encode(['success' => true]);
        return;
    }
}

function receivePurchaseOrder(Database $db, int $poId): void {
    $po    = $db->fetchOne('SELECT * FROM purchase_orders WHERE id = ?', [$poId]);
    $items = $db->fetchAll('SELECT * FROM purchase_order_items WHERE po_id = ?', [$poId]);

    if (!$po || $po['status'] === 'received') {
        echo json_encode(['error' => 'PO not found or already received']); return;
    }

    $db->beginTransaction();
    try {
        foreach ($items as $item) {
            // Create stock transaction
            $txnNum = 'TXN-PO' . $po['po_number'] . '-' . $item['id'];
            $db->execute(
                'INSERT INTO stock_transactions (transaction_number, product_id, warehouse_id, type, quantity, unit_cost, total_cost, currency, supplier_id, reference_number, transaction_date, status, notes)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$txnNum, $item['product_id'], $po['warehouse_id'], 'inward', $item['quantity_ordered'],
                 $item['unit_cost'], $item['total_cost'], $po['currency'], $po['supplier_id'],
                 $po['po_number'], date('Y-m-d'), 'completed', 'Auto from PO ' . $po['po_number']]
            );
            // Update product stock
            $db->executeUpdate('UPDATE products SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?', [$item['quantity_ordered'], $item['product_id']]);
            // Mark item received
            $db->executeUpdate('UPDATE purchase_order_items SET quantity_received = quantity_ordered WHERE id = ?', [$item['id']]);
        }
        $db->executeUpdate("UPDATE purchase_orders SET status='received', actual_delivery_date=?, received_by=?, received_date=NOW() WHERE id = ?",
            [date('Y-m-d'), $_SESSION['user_email'] ?? 'system', $poId]);
        $db->commit();
        Auth::logAction('update', 'PurchaseOrder', $poId, 'PO ' . $po['po_number'], 'Received');
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        $db->rollback();
        throw $e;
    }
}

// ============================================================
// ADJUSTMENTS
// ============================================================
function handleAdjustments(Database $db, string $method, ?int $id, array $body): void {
    if ($method === 'GET') {
        if ($id) {
            $row = $db->fetchOne('SELECT sa.*, p.name as product_name, p.sku, w.name as warehouse_name FROM stock_adjustments sa LEFT JOIN products p ON sa.product_id = p.id LEFT JOIN warehouses w ON sa.warehouse_id = w.id WHERE sa.id = ?', [$id]);
            echo json_encode($row ?: ['error' => 'Not found']);
        } else {
            $rows = $db->fetchAll('SELECT sa.*, p.name as product_name, p.sku FROM stock_adjustments sa LEFT JOIN products p ON sa.product_id = p.id ORDER BY sa.created_at DESC LIMIT 200');
            echo json_encode($rows);
        }
        return;
    }
    if ($method === 'POST') {
        if (empty($body['product_id']) || empty($body['adjustment_type'])) {
            http_response_code(400); echo json_encode(['error' => 'product_id and adjustment_type required']); return;
        }
        $product = $db->fetchOne('SELECT * FROM products WHERE id = ?', [$body['product_id']]);
        if (!$product) { http_response_code(404); echo json_encode(['error' => 'Product not found']); return; }

        $body['previous_quantity'] = $product['quantity_in_stock'];
        $body['variance']          = ($body['new_quantity'] ?? $body['previous_quantity']) - $body['previous_quantity'];
        $body['previous_value']    = $body['previous_quantity'] * ($product['cost_price'] ?? 0);
        $body['new_value']         = ($body['new_quantity'] ?? $body['previous_quantity']) * ($product['cost_price'] ?? 0);
        $body['value_variance']    = $body['new_value'] - $body['previous_value'];
        if (empty($body['adjustment_number'])) {
            $body['adjustment_number'] = 'ADJ-' . date('Ymd') . '-' . str_pad(rand(1,9999), 4, '0', STR_PAD_LEFT);
        }
        if (empty($body['adjustment_date'])) $body['adjustment_date'] = date('Y-m-d');

        $db->beginTransaction();
        try {
            $fields = buildInsert('stock_adjustments', $body);
            $newId  = $db->execute($fields['sql'], $fields['params']);
            // Apply if approved
            if (($body['status'] ?? '') === 'approved' && isset($body['new_quantity'])) {
                $db->executeUpdate('UPDATE products SET quantity_in_stock = ? WHERE id = ?', [$body['new_quantity'], $body['product_id']]);
            }
            $db->commit();
            Auth::logAction('create', 'StockAdjustment', $newId, $body['adjustment_number']);
            echo json_encode(['id' => $newId, 'success' => true]);
        } catch (Exception $e) { $db->rollback(); throw $e; }
        return;
    }
    if ($method === 'PUT' || $method === 'PATCH') {
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID required']); return; }
        $old    = $db->fetchOne('SELECT * FROM stock_adjustments WHERE id = ?', [$id]);
        $fields = buildUpdate('stock_adjustments', $body, $id);
        $db->executeUpdate($fields['sql'], $fields['params']);
        if (isset($body['status']) && $body['status'] === 'approved' && $old && $old['status'] !== 'approved' && isset($old['new_quantity'])) {
            $db->executeUpdate('UPDATE products SET quantity_in_stock = ? WHERE id = ?', [$old['new_quantity'], $old['product_id']]);
        }
        Auth::logAction('update', 'StockAdjustment', $id, "ADJ ID:$id");
        echo json_encode(['success' => true]);
        return;
    }
    if ($method === 'DELETE') {
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'ID required']); return; }
        $db->executeUpdate('DELETE FROM stock_adjustments WHERE id = ?', [$id]);
        Auth::logAction('delete', 'StockAdjustment', $id, "ADJ ID:$id");
        echo json_encode(['success' => true]);
        return;
    }
}

// ============================================================
// USERS
// ============================================================
function handleUsers(Database $db, string $method, ?int $id, array $body): void {
    global $auth;
    if ($method === 'GET') {
        $rows = $db->fetchAll('SELECT id, email, full_name, role, status, last_login, created_at FROM users ORDER BY id ASC');
        echo json_encode($rows);
        return;
    }
    if ($method === 'POST') {
        if (!$auth->hasRole('admin')) { http_response_code(403); echo json_encode(['error' => 'Forbidden']); return; }
        if (empty($body['email']) || empty($body['password'])) {
            http_response_code(400); echo json_encode(['error' => 'email and password required']); return;
        }
        $body['password_hash'] = password_hash($body['password'], PASSWORD_BCRYPT);
        unset($body['password']);
        $fields = buildInsert('users', $body);
        $newId  = $db->execute($fields['sql'], $fields['params']);
        Auth::logAction('create', 'User', $newId, $body['email']);
        echo json_encode(['id' => $newId, 'success' => true]);
        return;
    }
    if (($method === 'PUT' || $method === 'PATCH') && $id) {
        if (!$auth->hasRole('admin')) { http_response_code(403); echo json_encode(['error' => 'Forbidden']); return; }
        if (!empty($body['password'])) {
            $body['password_hash'] = password_hash($body['password'], PASSWORD_BCRYPT);
            unset($body['password']);
        }
        $fields = buildUpdate('users', $body, $id);
        $db->executeUpdate($fields['sql'], $fields['params']);
        Auth::logAction('update', 'User', $id, "User ID:$id");
        echo json_encode(['success' => true]);
        return;
    }
}

// ============================================================
// ACTIVITY LOGS
// ============================================================
function handleActivityLogs(Database $db): void {
    $limit = min((int)($_GET['limit'] ?? 200), 500);
    $rows  = $db->fetchAll("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT $limit");
    echo json_encode($rows);
}

// ============================================================
// SETTINGS
// ============================================================
function handleSettings(Database $db, string $method, array $body): void {
    if ($method === 'GET') {
        $rows = $db->fetchAll('SELECT setting_key, setting_value FROM app_settings');
        $out  = [];
        foreach ($rows as $r) $out[$r['setting_key']] = $r['setting_value'];
        echo json_encode($out);
        return;
    }
    if ($method === 'POST' || $method === 'PUT') {
        foreach ($body as $key => $val) {
            $db->executeUpdate('INSERT INTO app_settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value = ?', [$key, $val, $val]);
        }
        Auth::logAction('update', 'Settings', null, 'App Settings');
        echo json_encode(['success' => true]);
        return;
    }
}

// ============================================================
// REPORTS
// ============================================================
function handleReports(Database $db): void {
    $type = $_GET['type'] ?? 'stock_levels';
    switch ($type) {
        case 'stock_levels':
            $data = $db->fetchAll('SELECT p.*, c.name as category_name, w.name as warehouse_name FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN warehouses w ON p.warehouse_id = w.id ORDER BY p.quantity_in_stock ASC');
            break;
        case 'low_stock':
            $data = $db->fetchAll('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.quantity_in_stock <= p.reorder_level ORDER BY p.quantity_in_stock ASC');
            break;
        case 'valuation':
            $data = $db->fetchAll('SELECT p.sku, p.name, c.name as category, p.quantity_in_stock, p.cost_price, p.unit_price, (p.quantity_in_stock * p.cost_price) as total_cost_value, (p.quantity_in_stock * p.unit_price) as total_retail_value FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY total_cost_value DESC');
            break;
        case 'transactions':
            $from  = $_GET['from'] ?? date('Y-m-01');
            $to    = $_GET['to'] ?? date('Y-m-d');
            $data  = $db->fetchAll('SELECT t.*, p.name as product_name, p.sku, w.name as warehouse_name FROM stock_transactions t LEFT JOIN products p ON t.product_id = p.id LEFT JOIN warehouses w ON t.warehouse_id = w.id WHERE t.transaction_date BETWEEN ? AND ? ORDER BY t.transaction_date DESC', [$from, $to]);
            break;
        case 'warranty_expiry':
            $data = $db->fetchAll('SELECT w.*, p.name as product_name, p.sku, DATEDIFF(w.end_date, CURDATE()) as days_remaining FROM warranties w LEFT JOIN products p ON w.product_id = p.id ORDER BY w.end_date ASC');
            break;
        case 'supplier_performance':
            $data = $db->fetchAll('SELECT s.name as supplier_name, s.rating, COUNT(po.id) as total_orders, SUM(po.total_amount) as total_value, COUNT(CASE WHEN po.status="received" THEN 1 END) as completed_orders FROM suppliers s LEFT JOIN purchase_orders po ON s.id = po.supplier_id GROUP BY s.id ORDER BY s.name');
            break;
        default:
            $data = [];
    }
    echo json_encode(['type' => $type, 'data' => $data]);
}

// ============================================================
// IMPORT / EXPORT
// ============================================================
function handleImport(Database $db, array $body): void {
    $entity = $body['entity'] ?? '';
    $rows   = $body['data'] ?? [];
    if (!$entity || !$rows) { http_response_code(400); echo json_encode(['error' => 'entity and data required']); return; }
    $tableMap = ['products' => 'products', 'categories' => 'categories', 'warehouses' => 'warehouses', 'suppliers' => 'suppliers'];
    $table    = $tableMap[$entity] ?? null;
    if (!$table) { http_response_code(400); echo json_encode(['error' => 'Unknown entity']); return; }
    $imported = 0; $errors = [];
    foreach ($rows as $i => $row) {
        try {
            $fields = buildInsert($table, $row);
            $db->execute($fields['sql'], $fields['params']);
            $imported++;
        } catch (Exception $e) {
            $errors[] = "Row $i: " . $e->getMessage();
        }
    }
    Auth::logAction('import', ucfirst($entity), null, ucfirst($entity), "Imported $imported rows");
    echo json_encode(['success' => true, 'imported' => $imported, 'errors' => $errors]);
}

function handleExport(Database $db, string $entity): void {
    $tableMap = ['products' => 'products', 'categories' => 'categories', 'warehouses' => 'warehouses', 'suppliers' => 'suppliers', 'warranties' => 'warranties'];
    $table    = $tableMap[$entity] ?? null;
    if (!$table) { http_response_code(400); echo json_encode(['error' => 'Unknown entity']); return; }
    $rows = $db->fetchAll("SELECT * FROM `$table`");
    Auth::logAction('export', ucfirst($entity), null, ucfirst($entity), 'Exported ' . count($rows) . ' rows');
    echo json_encode($rows);
}

// ============================================================
// HELPERS
// ============================================================
function buildInsert(string $table, array $data): array {
    $allowed = getAllowedFields($table);
    $data    = array_intersect_key($data, array_flip($allowed));
    $data    = array_filter($data, fn($v) => $v !== null && $v !== '');
    if (empty($data)) return ['sql' => "INSERT INTO `$table` () VALUES ()", 'params' => []];
    $cols   = implode('`, `', array_keys($data));
    $places = implode(', ', array_fill(0, count($data), '?'));
    return ['sql' => "INSERT INTO `$table` (`$cols`) VALUES ($places)", 'params' => array_values($data)];
}

function buildUpdate(string $table, array $data, int $id): array {
    $allowed = getAllowedFields($table);
    $data    = array_intersect_key($data, array_flip($allowed));
    unset($data['id'], $data['created_at']);
    if (empty($data)) return ['sql' => "UPDATE `$table` SET id=id WHERE id=?", 'params' => [$id]];
    $sets   = implode(', ', array_map(fn($k) => "`$k` = ?", array_keys($data)));
    $params = array_values($data);
    $params[] = $id;
    return ['sql' => "UPDATE `$table` SET $sets WHERE id = ?", 'params' => $params];
}

function sanitizeColumn(string $col): string {
    return preg_replace('/[^a-zA-Z0-9_]/', '', $col) ?: 'id';
}

function getAllowedFields(string $table): array {
    $fields = [
        'products'             => ['sku','name','description','category_id','supplier_id','preferred_supplier_id','warehouse_id','unit_price','cost_price','currency','quantity_in_stock','reorder_level','reorder_quantity','unit_of_measure','serial_number_tracking','length','width','height','weight','barcode','image_url','tax_rate','status','notes'],
        'categories'           => ['name','description','parent_id','color','status'],
        'warehouses'           => ['name','code','address','city','country','manager_name','manager_email','phone','capacity','status'],
        'suppliers'            => ['name','code','contact_person','email','phone','address','city','country','payment_terms','currency','tax_id','rating','status'],
        'purchase_orders'      => ['po_number','supplier_id','order_date','expected_delivery_date','actual_delivery_date','warehouse_id','status','currency','subtotal','tax_amount','shipping_cost','total_amount','payment_terms','notes','approved_by','approved_date','received_by','received_date','created_by'],
        'purchase_order_items' => ['po_id','product_id','quantity_ordered','quantity_received','unit_cost','tax_rate','total_cost','notes'],
        'stock_transactions'   => ['transaction_number','product_id','warehouse_id','type','quantity','serial_numbers','unit_cost','total_cost','currency','reference_number','supplier_id','transaction_date','notes','status','approved_by','approved_date','created_by'],
        'stock_adjustments'    => ['adjustment_number','product_id','warehouse_id','adjustment_type','valuation_method','previous_quantity','new_quantity','variance','previous_value','new_value','value_variance','reason','financial_year','status','approved_by','approved_date','adjustment_date','created_by'],
        'warranties'           => ['warranty_number','product_id','supplier_id','serial_number','start_date','end_date','warranty_type','coverage','status','notes'],
        'activity_logs'        => ['user_id','user_email','user_name','action','entity_type','entity_id','entity_name','details','ip_address','user_agent'],
        'users'                => ['email','password_hash','full_name','role','status'],
        'app_settings'         => ['setting_key','setting_value'],
    ];
    return $fields[$table] ?? [];
}
