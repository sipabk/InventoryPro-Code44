# 📦 Inventory Manager — Complete Installation Guide

A full-featured inventory management system converted from Base44/Code44 to a standalone PHP/MySQL web application.

---

## ✅ What's Included

| Module | Features |
|---|---|
| Dashboard | KPI stats, charts, low stock alerts, warranty alerts |
| Products | Full CRUD, categories, warehouses, pricing, stock levels |
| Categories | Hierarchical categories with color coding |
| Warehouses | Multi-warehouse management with capacity tracking |
| Suppliers | Supplier directory, payment terms, ratings |
| Purchase Orders | Full PO workflow: Draft → Ordered → Received |
| Transactions | Inward/Outward/Transfer/Return/Adjustment transactions |
| Warranties | Warranty tracking with expiry alerts |
| Stock Adjustments | Stock takes, corrections, damage, with approval workflow |
| Reports | 6 report types with CSV export |
| Import/Export | JSON & CSV import/export for all entities |
| Activity Logs | Full audit trail of all user actions |
| Users | User management with role-based access |
| Settings | Application configuration |

---

## 🔧 Requirements

| Requirement | Minimum Version |
|---|---|
| PHP | 7.4+ (8.0+ recommended) |
| MySQL | 5.7+ or MariaDB 10.3+ |
| Apache | 2.4+ with mod_rewrite enabled |
| Browser | Chrome 80+, Firefox 75+, Edge 80+ |

---

## 🚀 Installation (XAMPP / WAMP)

### Step 1 — Install XAMPP or WAMP

**XAMPP (recommended):**
1. Download from https://www.apachefriends.org/
2. Install and start Apache + MySQL modules

**WAMP:**
1. Download from https://www.wampserver.com/
2. Install and start all services

---

### Step 2 — Copy Application Files

Copy the entire `inventory-app` folder into your web root:

**XAMPP:** `C:\xampp\htdocs\inventory-app\`
**WAMP:** `C:\wamp64\www\inventory-app\`
**Linux/Mac XAMPP:** `/opt/lampp/htdocs/inventory-app/`

---

### Step 3 — Run the Installer (Easy Method)

1. Open your browser and go to: `http://localhost/inventory-app/setup.php`
2. Fill in your database details:
   - **Database Host:** `localhost`
   - **Database Name:** `inventory_db`
   - **Database User:** `root`
   - **Database Password:** *(leave blank for XAMPP default)*
   - **App URL:** `http://localhost/inventory-app`
3. Click **Install Database & Configure**
4. **Delete `setup.php` after installation!**

---

### Step 3 — Manual Installation (Alternative)

**a) Create the database:**
1. Open phpMyAdmin: `http://localhost/phpmyadmin`
2. Click **New** → name it `inventory_db` → **Create**
3. Select `inventory_db` → click **Import**
4. Choose `sql/schema.sql` → click **Go**

**b) Edit config.php:**
```php
define('DB_HOST',  'localhost');
define('DB_NAME',  'inventory_db');
define('DB_USER',  'root');
define('DB_PASS',  '');           // Your MySQL password
define('APP_URL',  'http://localhost/inventory-app');
```

---

### Step 4 — Enable mod_rewrite (Apache)

**XAMPP Windows:**
1. Open `C:\xampp\apache\conf\httpd.conf`
2. Find and uncomment: `LoadModule rewrite_module modules/mod_rewrite.so`
3. Find `<Directory "C:/xampp/htdocs">` block
4. Change `AllowOverride None` → `AllowOverride All`
5. Restart Apache

**WAMP:**
1. Left-click WAMP icon → Apache → Apache modules
2. Enable `rewrite_module`

---

### Step 5 — Open the Application

Go to: **http://localhost/inventory-app/**

**Default Login:**
- Email: `admin@inventory.local`
- Password: `password`

> ⚠️ Change the default password immediately after first login!

---

## 🐧 Linux / Ubuntu (Apache)

```bash
# Install dependencies
sudo apt install apache2 php php-mysql mysql-server -y
sudo a2enmod rewrite
sudo systemctl restart apache2

# Copy files
sudo cp -r inventory-app /var/www/html/

# Set permissions
sudo chown -R www-data:www-data /var/www/html/inventory-app
sudo chmod -R 755 /var/www/html/inventory-app

# Create database
mysql -u root -p -e "CREATE DATABASE inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p inventory_db < /var/www/html/inventory-app/sql/schema.sql

# Update config.php with your MySQL credentials
```

---

## 🌐 Nginx Configuration

```nginx
server {
    listen 80;
    server_name localhost;
    root /var/www/html/inventory-app;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php$is_args$args;
    }

    location ~ ^/api/ {
        rewrite ^/api/(.*)$ /api/index.php?path=$1 last;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.0-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

---

## 📁 Project Structure

```
inventory-app/
├── index.php              # Main entry point & login
├── config.php             # Database & app configuration
├── setup.php              # One-time installer (delete after use)
├── .htaccess              # Apache URL rewriting rules
├── api/
│   └── index.php          # REST API (all JSON endpoints)
├── assets/
│   ├── css/
│   │   └── app.css        # Main stylesheet
│   └── js/
│       └── app.js         # Frontend SPA logic
├── includes/
│   ├── Database.php       # PDO database wrapper
│   └── Auth.php           # Authentication & session management
└── sql/
    └── schema.sql         # Complete database schema + sample data
```

---

## 🔐 User Roles

| Role | Permissions |
|---|---|
| **admin** | Full access including users & settings |
| **manager** | All inventory operations |
| **staff** | Create/edit transactions and products |
| **viewer** | Read-only access |

---

## 📡 API Reference

All API endpoints are at `/api/index.php?path=RESOURCE`

| Endpoint | Methods | Description |
|---|---|---|
| `auth/login` | POST | Login |
| `auth/logout` | GET | Logout |
| `auth/me` | GET | Current user |
| `dashboard` | GET | Dashboard stats |
| `products` | GET, POST, PUT, DELETE | Products CRUD |
| `categories` | GET, POST, PUT, DELETE | Categories CRUD |
| `warehouses` | GET, POST, PUT, DELETE | Warehouses CRUD |
| `suppliers` | GET, POST, PUT, DELETE | Suppliers CRUD |
| `transactions` | GET, POST, PUT, DELETE | Stock transactions |
| `purchase-orders` | GET, POST, PUT, DELETE | Purchase orders |
| `purchase-orders/{id}/receive` | POST | Mark PO received |
| `warranties` | GET, POST, PUT, DELETE | Warranties |
| `adjustments` | GET, POST, PUT, DELETE | Stock adjustments |
| `users` | GET, POST, PUT | User management |
| `activity-logs` | GET | Audit logs |
| `settings` | GET, POST | App settings |
| `reports` | GET | Reports (`?type=stock_levels`) |
| `export` | GET | Export data (`?entity=products`) |
| `import` | POST | Import data |

---

## 🗃 Database Reset

To reset all data (keep structure):
```sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE activity_logs;
TRUNCATE TABLE stock_adjustments;
TRUNCATE TABLE stock_transactions;
TRUNCATE TABLE purchase_order_items;
TRUNCATE TABLE purchase_orders;
TRUNCATE TABLE warranties;
TRUNCATE TABLE products;
TRUNCATE TABLE categories;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE warehouses;
SET FOREIGN_KEY_CHECKS = 1;
```

To fully reinstall: drop and recreate the database, re-run `sql/schema.sql`.

---

## 🐞 Troubleshooting

**Blank page / 500 error:**
- Enable PHP error display: Set `APP_DEBUG` to `true` in `config.php`
- Check Apache error logs

**Database connection failed:**
- Verify MySQL is running
- Check credentials in `config.php`
- Ensure the database exists

**404 on navigation:**
- Enable `mod_rewrite` in Apache
- Ensure `AllowOverride All` is set for the directory
- Check `.htaccess` file exists

**Login not working:**
- Clear browser cookies
- Verify the admin user exists in the `users` table
- Re-run `sql/schema.sql` to restore default admin

---

## 📊 Converting Base44 Data

If you have existing Base44 app data:
1. Export each entity from Base44 as JSON
2. Use the **Import/Export** page in this app
3. Select the entity type and upload the JSON file
4. The import will map fields automatically

---

## 🛡 Security Recommendations

Before going to production:
1. Delete `setup.php`
2. Set `APP_DEBUG` to `false` in `config.php`
3. Change the default admin password
4. Use a strong MySQL password
5. Set up HTTPS with an SSL certificate
6. Restrict `config.php` in `.htaccess`

---

*Converted from Base44/Code44 platform — runs fully independently on PHP/MySQL/Apache.*
