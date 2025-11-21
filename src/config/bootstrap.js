const mysql = require('mysql2/promise');

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASS = '',
  DB_NAME = 'rst_affiliates',
} = process.env;

const TABLE_DEFINITIONS = {
  users: {
    create: `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        role ENUM('admin', 'influencer') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: [
      { name: 'id', ddl: 'id INT AUTO_INCREMENT PRIMARY KEY' },
      { name: 'email', ddl: 'email VARCHAR(255) NOT NULL' },
      { name: 'name', ddl: 'name VARCHAR(255) NOT NULL' },
      { name: 'role', ddl: "role ENUM('admin', 'influencer') NOT NULL" },
      { name: 'created_at', ddl: 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    ],
    indexes: [{ name: 'uniq_users_email', ddl: 'UNIQUE KEY uniq_users_email (email)' }],
  },
  discount_codes: {
    create: `
      CREATE TABLE IF NOT EXISTS discount_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        prestashop_code VARCHAR(100) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_discount_code (prestashop_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: [
      { name: 'id', ddl: 'id INT AUTO_INCREMENT PRIMARY KEY' },
      { name: 'user_id', ddl: 'user_id INT NOT NULL' },
      { name: 'prestashop_code', ddl: 'prestashop_code VARCHAR(100) NOT NULL' },
    ],
    indexes: [{ name: 'uniq_discount_code', ddl: 'UNIQUE KEY uniq_discount_code (prestashop_code)' }],
  },
  brands: {
    create: `
      CREATE TABLE IF NOT EXISTS brands (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prestashop_brand_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        UNIQUE KEY uniq_brand_prestashop (prestashop_brand_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: [
      { name: 'id', ddl: 'id INT AUTO_INCREMENT PRIMARY KEY' },
      { name: 'prestashop_brand_id', ddl: 'prestashop_brand_id INT NOT NULL' },
      { name: 'name', ddl: 'name VARCHAR(255) NOT NULL' },
    ],
    indexes: [{ name: 'uniq_brand_prestashop', ddl: 'UNIQUE KEY uniq_brand_prestashop (prestashop_brand_id)' }],
  },
  commission_rules: {
    create: `
      CREATE TABLE IF NOT EXISTS commission_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        brand_id INT NULL,
        commission_first DECIMAL(5,2) NOT NULL,
        commission_subsequent DECIMAL(5,2) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_rule (user_id, brand_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: [
      { name: 'id', ddl: 'id INT AUTO_INCREMENT PRIMARY KEY' },
      { name: 'user_id', ddl: 'user_id INT NOT NULL' },
      { name: 'brand_id', ddl: 'brand_id INT NULL' },
      { name: 'commission_first', ddl: 'commission_first DECIMAL(5,2) NOT NULL' },
      { name: 'commission_subsequent', ddl: 'commission_subsequent DECIMAL(5,2) NOT NULL' },
    ],
    indexes: [{ name: 'uniq_rule', ddl: 'UNIQUE KEY uniq_rule (user_id, brand_id)' }],
  },
  customers: {
    create: `
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prestashop_customer_id INT NOT NULL,
        email VARCHAR(255),
        id_current_afiliate INT NOT NULL,
        FOREIGN KEY (id_current_afiliate) REFERENCES users(id),
        UNIQUE KEY uniq_customer_prestashop (prestashop_customer_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: [
      { name: 'id', ddl: 'id INT AUTO_INCREMENT PRIMARY KEY' },
      { name: 'prestashop_customer_id', ddl: 'prestashop_customer_id INT NOT NULL' },
      { name: 'email', ddl: 'email VARCHAR(255)' },
      { name: 'id_current_afiliate', ddl: 'id_current_afiliate INT NOT NULL' },
    ],
    indexes: [{ name: 'uniq_customer_prestashop', ddl: 'UNIQUE KEY uniq_customer_prestashop (prestashop_customer_id)' }],
  },
  commissions: {
    create: `
      CREATE TABLE IF NOT EXISTS commissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        prestashop_order_id INT NOT NULL,
        customer_id INT NOT NULL,
        afiliado_id INT NOT NULL,
        order_total_with_vat DECIMAL(10,2) NOT NULL,
        order_total_without_vat DECIMAL(10,2) NOT NULL DEFAULT 0,
        commission_earned DECIMAL(10,2) NOT NULL,
        is_first_purchase_commission BOOLEAN NOT NULL DEFAULT FALSE,
        status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
        order_created_at TIMESTAMP NOT NULL,
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (afiliado_id) REFERENCES users(id),
        UNIQUE KEY uniq_commission_order (prestashop_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: [
      { name: 'id', ddl: 'id INT AUTO_INCREMENT PRIMARY KEY' },
      { name: 'prestashop_order_id', ddl: 'prestashop_order_id INT NOT NULL' },
      { name: 'customer_id', ddl: 'customer_id INT NOT NULL' },
      { name: 'afiliado_id', ddl: 'afiliado_id INT NOT NULL' },
      { name: 'order_total_with_vat', ddl: 'order_total_with_vat DECIMAL(10,2) NOT NULL' },
      { name: 'order_total_without_vat', ddl: 'order_total_without_vat DECIMAL(10,2) NOT NULL DEFAULT 0' },
      { name: 'commission_earned', ddl: 'commission_earned DECIMAL(10,2) NOT NULL' },
      { name: 'is_first_purchase_commission', ddl: 'is_first_purchase_commission BOOLEAN NOT NULL DEFAULT FALSE' },
      { name: 'status', ddl: "status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending'" },
      { name: 'order_created_at', ddl: 'order_created_at TIMESTAMP NOT NULL' },
      { name: 'paid_at', ddl: 'paid_at TIMESTAMP NULL' },
      { name: 'created_at', ddl: 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    ],
    indexes: [{ name: 'uniq_commission_order', ddl: 'UNIQUE KEY uniq_commission_order (prestashop_order_id)' }],
  },
  otps: {
    create: `
      CREATE TABLE IF NOT EXISTS otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: [
      { name: 'id', ddl: 'id INT AUTO_INCREMENT PRIMARY KEY' },
      { name: 'email', ddl: 'email VARCHAR(255) NOT NULL' },
      { name: 'otp_code', ddl: 'otp_code VARCHAR(10) NOT NULL' },
      { name: 'expires_at', ddl: 'expires_at TIMESTAMP NOT NULL' },
      { name: 'created_at', ddl: 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
    ],
    indexes: [],
  },
  settings: {
    create: `
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY DEFAULT 1,
        smtp_host VARCHAR(255),
        smtp_port INT,
        smtp_user VARCHAR(255),
        smtp_pass VARCHAR(255),
        prestashop_api_url VARCHAR(255),
        prestashop_api_key VARCHAR(255)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: [
      { name: 'id', ddl: 'id INT PRIMARY KEY DEFAULT 1' },
      { name: 'smtp_host', ddl: 'smtp_host VARCHAR(255)' },
      { name: 'smtp_port', ddl: 'smtp_port INT' },
      { name: 'smtp_user', ddl: 'smtp_user VARCHAR(255)' },
      { name: 'smtp_pass', ddl: 'smtp_pass VARCHAR(255)' },
      { name: 'prestashop_api_url', ddl: 'prestashop_api_url VARCHAR(255)' },
      { name: 'prestashop_api_key', ddl: 'prestashop_api_key VARCHAR(255)' },
    ],
    indexes: [],
  },
};

const DEFAULT_ADMINS = [
  { email: 'tcardosa@outlook.com', name: 'RST Admin TC' },
  { email: 'info@rstferramentas.com', name: 'RST Admin Info' },
];

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
}

async function getExistingColumns(pool, table) {
  const [rows] = await pool.query(
    'SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
    [DB_NAME, table],
  );
  return new Set(rows.map((row) => row.COLUMN_NAME));
}

async function getExistingIndexes(pool, table) {
  const [rows] = await pool.query(
    'SELECT DISTINCT INDEX_NAME FROM information_schema.statistics WHERE table_schema = ? AND table_name = ?',
    [DB_NAME, table],
  );
  return new Set(rows.map((row) => row.INDEX_NAME));
}

async function ensureSchema(pool) {
  // First pass: ensure tables exist with base definitions
  for (const definition of Object.values(TABLE_DEFINITIONS)) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query(definition.create);
  }

  // Second pass: ensure all columns and indexes exist even if table pre-existed without them
  for (const [table, definition] of Object.entries(TABLE_DEFINITIONS)) {
    const existingColumns = await getExistingColumns(pool, table);
    for (const column of definition.columns) {
      if (existingColumns.has(column.name)) continue;
      // eslint-disable-next-line no-await-in-loop
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column.ddl}`);
    }

    const existingIndexes = await getExistingIndexes(pool, table);
    for (const index of definition.indexes) {
      if (existingIndexes.has(index.name)) continue;
      // eslint-disable-next-line no-await-in-loop
      await pool.query(`ALTER TABLE ${table} ADD ${index.ddl}`);
    }
  }
}

async function ensureAdminUsers(pool) {
  for (const admin of DEFAULT_ADMINS) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES (?, ?, 'admin')
       ON DUPLICATE KEY UPDATE role = 'admin', name = VALUES(name)`,
      [admin.email, admin.name],
    );
  }
}

async function bootstrapDatabase() {
  await ensureDatabaseExists();
  const pool = await mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
  });

  try {
    await ensureSchema(pool);
    await ensureAdminUsers(pool);
  } finally {
    await pool.end();
  }
}

module.exports = bootstrapDatabase;
