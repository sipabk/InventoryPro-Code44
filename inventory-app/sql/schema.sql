-- ============================================================
-- Inventory Management System - Database Schema
-- Compatible with MySQL 5.7+ / MariaDB 10.3+
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS `activity_logs`;
DROP TABLE IF EXISTS `stock_adjustments`;
DROP TABLE IF EXISTS `stock_transactions`;
DROP TABLE IF EXISTS `purchase_order_items`;
DROP TABLE IF EXISTS `purchase_orders`;
DROP TABLE IF EXISTS `warranties`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `suppliers`;
DROP TABLE IF EXISTS `warehouses`;
DROP TABLE IF EXISTS `scheduled_reports`;
DROP TABLE IF EXISTS `app_settings`;
DROP TABLE IF EXISTS `users`;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255),
  `role` ENUM('admin','manager','staff','viewer') NOT NULL DEFAULT 'staff',
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `last_login` DATETIME,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default admin user (password: admin123)
INSERT INTO `users` (`email`, `password_hash`, `full_name`, `role`, `status`) VALUES
('admin@inventory.local', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Admin', 'admin', 'active');

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `parent_id` INT DEFAULT NULL,
  `color` VARCHAR(20) DEFAULT '#3b82f6',
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- WAREHOUSES
-- ============================================================
CREATE TABLE `warehouses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `address` TEXT,
  `city` VARCHAR(100),
  `country` VARCHAR(100),
  `manager_name` VARCHAR(255),
  `manager_email` VARCHAR(255),
  `phone` VARCHAR(50),
  `capacity` DECIMAL(15,2) DEFAULT 0,
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE `suppliers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50),
  `contact_person` VARCHAR(255),
  `email` VARCHAR(255),
  `phone` VARCHAR(50),
  `address` TEXT,
  `city` VARCHAR(100),
  `country` VARCHAR(100),
  `payment_terms` ENUM('net_30','net_60','net_90','immediate','cod') DEFAULT 'net_30',
  `currency` ENUM('USD','EUR','GBP','INR','AUD','CAD','JPY','CNY') DEFAULT 'USD',
  `tax_id` VARCHAR(100),
  `rating` TINYINT DEFAULT 3,
  `status` ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sku` VARCHAR(100) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category_id` INT DEFAULT NULL,
  `supplier_id` INT DEFAULT NULL,
  `preferred_supplier_id` INT DEFAULT NULL,
  `warehouse_id` INT DEFAULT NULL,
  `unit_price` DECIMAL(15,4) DEFAULT 0,
  `cost_price` DECIMAL(15,4) DEFAULT 0,
  `currency` ENUM('USD','EUR','GBP','INR','AUD','CAD','JPY','CNY') DEFAULT 'USD',
  `quantity_in_stock` DECIMAL(15,4) DEFAULT 0,
  `reorder_level` DECIMAL(15,4) DEFAULT 10,
  `reorder_quantity` DECIMAL(15,4) DEFAULT 50,
  `unit_of_measure` ENUM('piece','kg','lb','box','carton','pallet','liter','gallon','meter','foot') DEFAULT 'piece',
  `serial_number_tracking` TINYINT(1) DEFAULT 0,
  `length` DECIMAL(10,4),
  `width` DECIMAL(10,4),
  `height` DECIMAL(10,4),
  `weight` DECIMAL(10,4),
  `barcode` VARCHAR(100),
  `image_url` VARCHAR(500),
  `tax_rate` DECIMAL(5,2) DEFAULT 0,
  `status` ENUM('active','inactive','discontinued') DEFAULT 'active',
  `notes` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`preferred_supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TABLE `purchase_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `po_number` VARCHAR(100) NOT NULL UNIQUE,
  `supplier_id` INT NOT NULL,
  `order_date` DATE NOT NULL,
  `expected_delivery_date` DATE,
  `actual_delivery_date` DATE,
  `warehouse_id` INT,
  `status` ENUM('draft','ordered','received','cancelled') DEFAULT 'draft',
  `currency` ENUM('USD','EUR','GBP','INR','AUD','CAD','JPY','CNY') DEFAULT 'USD',
  `subtotal` DECIMAL(15,4) DEFAULT 0,
  `tax_amount` DECIMAL(15,4) DEFAULT 0,
  `shipping_cost` DECIMAL(15,4) DEFAULT 0,
  `total_amount` DECIMAL(15,4) DEFAULT 0,
  `payment_terms` ENUM('net_30','net_60','net_90','immediate','cod') DEFAULT 'net_30',
  `notes` TEXT,
  `approved_by` VARCHAR(255),
  `approved_date` DATETIME,
  `received_by` VARCHAR(255),
  `received_date` DATETIME,
  `created_by` INT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`),
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PURCHASE ORDER ITEMS
-- ============================================================
CREATE TABLE `purchase_order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `po_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity_ordered` DECIMAL(15,4) NOT NULL,
  `quantity_received` DECIMAL(15,4) DEFAULT 0,
  `unit_cost` DECIMAL(15,4) NOT NULL,
  `tax_rate` DECIMAL(5,2) DEFAULT 0,
  `total_cost` DECIMAL(15,4),
  `notes` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- STOCK TRANSACTIONS
-- ============================================================
CREATE TABLE `stock_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_number` VARCHAR(100) NOT NULL UNIQUE,
  `product_id` INT NOT NULL,
  `warehouse_id` INT,
  `type` ENUM('inward','outward','transfer','adjustment','return') NOT NULL,
  `quantity` DECIMAL(15,4) NOT NULL,
  `serial_numbers` TEXT COMMENT 'JSON array of serial numbers',
  `unit_cost` DECIMAL(15,4) DEFAULT 0,
  `total_cost` DECIMAL(15,4) DEFAULT 0,
  `currency` ENUM('USD','EUR','GBP','INR','AUD','CAD','JPY','CNY') DEFAULT 'USD',
  `reference_number` VARCHAR(100),
  `supplier_id` INT,
  `transaction_date` DATE,
  `notes` TEXT,
  `status` ENUM('pending','approved','completed','cancelled') DEFAULT 'pending',
  `approved_by` VARCHAR(255),
  `approved_date` DATETIME,
  `created_by` INT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- STOCK ADJUSTMENTS
-- ============================================================
CREATE TABLE `stock_adjustments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `adjustment_number` VARCHAR(100) NOT NULL UNIQUE,
  `product_id` INT NOT NULL,
  `warehouse_id` INT,
  `adjustment_type` ENUM('stock_take','damage','loss','correction','opening_balance','closing_balance') DEFAULT 'correction',
  `valuation_method` ENUM('fifo','lifo','weighted_average') DEFAULT 'weighted_average',
  `previous_quantity` DECIMAL(15,4),
  `new_quantity` DECIMAL(15,4),
  `variance` DECIMAL(15,4),
  `previous_value` DECIMAL(15,4),
  `new_value` DECIMAL(15,4),
  `value_variance` DECIMAL(15,4),
  `reason` TEXT,
  `financial_year` VARCHAR(20),
  `status` ENUM('draft','pending_approval','approved','rejected') DEFAULT 'draft',
  `approved_by` VARCHAR(255),
  `approved_date` DATETIME,
  `adjustment_date` DATE,
  `created_by` INT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- WARRANTIES
-- ============================================================
CREATE TABLE `warranties` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `warranty_number` VARCHAR(100),
  `product_id` INT NOT NULL,
  `supplier_id` INT,
  `serial_number` VARCHAR(100),
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `warranty_type` ENUM('manufacturer','extended','third_party') DEFAULT 'manufacturer',
  `coverage` TEXT,
  `status` ENUM('active','expiring_soon','expired','claimed','void') DEFAULT 'active',
  `notes` TEXT,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE `activity_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `user_email` VARCHAR(255),
  `user_name` VARCHAR(255),
  `action` ENUM('create','read','update','delete','login','logout','export','import','approve','reject') NOT NULL,
  `entity_type` VARCHAR(100),
  `entity_id` VARCHAR(100),
  `entity_name` VARCHAR(255),
  `details` TEXT,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- APP SETTINGS
-- ============================================================
CREATE TABLE `app_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `app_settings` (`setting_key`, `setting_value`) VALUES
('app_name', 'Inventory Manager'),
('company_name', 'My Company'),
('default_currency', 'USD'),
('low_stock_alert_enabled', '1'),
('warranty_alert_days', '30'),
('date_format', 'Y-m-d'),
('items_per_page', '25');

-- ============================================================
-- SAMPLE DATA
-- ============================================================

INSERT INTO `categories` (`name`, `description`, `color`, `status`) VALUES
('Electronics', 'Electronic devices and components', '#3b82f6', 'active'),
('Office Supplies', 'General office supplies', '#10b981', 'active'),
('Tools & Equipment', 'Tools and maintenance equipment', '#f59e0b', 'active'),
('Raw Materials', 'Raw materials for production', '#8b5cf6', 'active');

INSERT INTO `warehouses` (`name`, `code`, `address`, `city`, `country`, `manager_name`, `manager_email`, `phone`, `capacity`, `status`) VALUES
('Main Warehouse', 'WH-001', '123 Industrial Ave', 'New York', 'USA', 'John Smith', 'john@company.com', '+1-555-0100', 10000, 'active'),
('Secondary Storage', 'WH-002', '456 Storage Blvd', 'Los Angeles', 'USA', 'Jane Doe', 'jane@company.com', '+1-555-0200', 5000, 'active');

INSERT INTO `suppliers` (`name`, `code`, `contact_person`, `email`, `phone`, `city`, `country`, `payment_terms`, `currency`, `rating`, `status`) VALUES
('TechSupplies Inc.', 'SUP-001', 'Bob Johnson', 'bob@techsupplies.com', '+1-555-1000', 'Chicago', 'USA', 'net_30', 'USD', 4, 'active'),
('Office Pro Ltd.', 'SUP-002', 'Alice Brown', 'alice@officepro.com', '+1-555-2000', 'Houston', 'USA', 'net_60', 'USD', 5, 'active'),
('Global Equipment Co.', 'SUP-003', 'Charlie Wilson', 'charlie@globalequip.com', '+1-555-3000', 'Seattle', 'USA', 'net_30', 'USD', 3, 'active');

INSERT INTO `products` (`sku`, `name`, `description`, `category_id`, `supplier_id`, `warehouse_id`, `unit_price`, `cost_price`, `quantity_in_stock`, `reorder_level`, `reorder_quantity`, `status`) VALUES
('ELEC-001', 'Laptop Pro 15"', '15 inch business laptop', 1, 1, 1, 1299.99, 899.99, 25, 5, 20, 'active'),
('ELEC-002', 'Wireless Mouse', 'Ergonomic wireless mouse', 1, 1, 1, 29.99, 12.50, 150, 20, 100, 'active'),
('ELEC-003', 'USB-C Hub 7-Port', 'Multi-port USB-C hub', 1, 1, 1, 49.99, 22.00, 80, 10, 50, 'active'),
('OFF-001', 'A4 Paper Ream (500 sheets)', 'Standard A4 copy paper', 2, 2, 1, 8.99, 4.50, 500, 100, 500, 'active'),
('OFF-002', 'Ballpoint Pen Box (50)', 'Blue ballpoint pens', 2, 2, 2, 12.99, 5.00, 200, 50, 200, 'active'),
('TOOL-001', 'Electric Drill', 'Cordless electric drill 18V', 3, 3, 2, 89.99, 45.00, 30, 5, 20, 'active'),
('TOOL-002', 'Safety Helmet', 'Construction safety helmet', 3, 3, 2, 24.99, 10.00, 60, 15, 50, 'active');

-- Sample warranty
INSERT INTO `warranties` (`warranty_number`, `product_id`, `start_date`, `end_date`, `warranty_type`, `coverage`, `status`) VALUES
('WRN-001', 1, '2024-01-01', '2026-01-01', 'manufacturer', 'Full parts and labor', 'active'),
('WRN-002', 6, '2024-06-01', '2025-06-01', 'manufacturer', 'Parts only', 'expired');

-- Sample activity log
INSERT INTO `activity_logs` (`user_email`, `user_name`, `action`, `entity_type`, `entity_name`, `details`, `ip_address`) VALUES
('admin@inventory.local', 'System Admin', 'login', 'User', 'System Admin', 'Initial system setup', '127.0.0.1');

-- Sample stock transactions
INSERT INTO `stock_transactions` (`transaction_number`, `product_id`, `warehouse_id`, `type`, `quantity`, `unit_cost`, `total_cost`, `currency`, `transaction_date`, `status`, `notes`) VALUES
('TXN-20240101-001', 1, 1, 'inward', 25, 899.99, 22499.75, 'USD', '2024-01-01', 'completed', 'Initial stock'),
('TXN-20240101-002', 2, 1, 'inward', 150, 12.50, 1875.00, 'USD', '2024-01-01', 'completed', 'Initial stock'),
('TXN-20240101-003', 4, 1, 'inward', 500, 4.50, 2250.00, 'USD', '2024-01-01', 'completed', 'Initial stock');
