<?php
// includes/Auth.php

class Auth {
    private Database $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function login(string $email, string $password): array {
        $user = $this->db->fetchOne(
            'SELECT * FROM users WHERE email = ? AND status = "active"',
            [$email]
        );
        if (!$user || !password_verify($password, $user['password_hash'])) {
            return ['success' => false, 'message' => 'Invalid email or password'];
        }
        // Update last login
        $this->db->executeUpdate(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [$user['id']]
        );
        // Store session
        $_SESSION['user_id']    = $user['id'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['user_name']  = $user['full_name'];
        $_SESSION['user_role']  = $user['role'];
        $_SESSION['logged_in']  = true;

        // Log activity
        $this->logActivity('login', 'User', $user['id'], $user['email'], 'User logged in');

        return ['success' => true, 'user' => [
            'id'        => $user['id'],
            'email'     => $user['email'],
            'full_name' => $user['full_name'],
            'role'      => $user['role'],
        ]];
    }

    public function logout(): void {
        if (isset($_SESSION['user_email'])) {
            $this->logActivity('logout', 'User', $_SESSION['user_id'] ?? null, $_SESSION['user_email'], 'User logged out');
        }
        session_destroy();
    }

    public function isLoggedIn(): bool {
        return !empty($_SESSION['logged_in']) && !empty($_SESSION['user_id']);
    }

    public function requireLogin(): void {
        if (!$this->isLoggedIn()) {
            if (isset($_SERVER['HTTP_X_REQUESTED_WITH'])) {
                http_response_code(401);
                echo json_encode(['error' => 'Not authenticated']);
                exit;
            }
            header('Location: ' . APP_URL . '/index.php?page=login');
            exit;
        }
    }

    public function getCurrentUser(): ?array {
        if (!$this->isLoggedIn()) return null;
        return [
            'id'    => $_SESSION['user_id'],
            'email' => $_SESSION['user_email'],
            'name'  => $_SESSION['user_name'],
            'role'  => $_SESSION['user_role'],
        ];
    }

    public function hasRole(string ...$roles): bool {
        return in_array($_SESSION['user_role'] ?? '', $roles);
    }

    private function logActivity(string $action, string $entityType, $entityId, string $userEmail, string $details): void {
        try {
            $this->db->execute(
                'INSERT INTO activity_logs (user_id, user_email, user_name, action, entity_type, entity_id, details, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $_SESSION['user_id'] ?? null,
                    $userEmail,
                    $_SESSION['user_name'] ?? $userEmail,
                    $action,
                    $entityType,
                    $entityId,
                    $details,
                    $_SERVER['REMOTE_ADDR'] ?? '',
                    $_SERVER['HTTP_USER_AGENT'] ?? '',
                ]
            );
        } catch (Exception $e) { /* silence log failures */ }
    }

    public static function logAction(string $action, string $entityType, $entityId, string $entityName, string $details = ''): void {
        try {
            $db = Database::getInstance();
            $db->execute(
                'INSERT INTO activity_logs (user_id, user_email, user_name, action, entity_type, entity_id, entity_name, details, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $_SESSION['user_id']    ?? null,
                    $_SESSION['user_email'] ?? 'system',
                    $_SESSION['user_name']  ?? 'System',
                    $action,
                    $entityType,
                    $entityId,
                    $entityName,
                    $details,
                    $_SERVER['REMOTE_ADDR']     ?? '',
                    $_SERVER['HTTP_USER_AGENT'] ?? '',
                ]
            );
        } catch (Exception $e) {}
    }
}
