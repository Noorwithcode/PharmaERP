require("dotenv").config();

const db = require("../config/db");

const setupDatabase = async () => {
  try {
    console.log("Starting PharmaERP database setup...");

    // Roles table
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Roles table created");

    // Default roles
    await db.query(`
      INSERT IGNORE INTO roles (name, description)
      VALUES
        ('admin', 'Complete system access'),
        ('manager', 'Manage pharmacy operations and reports'),
        ('pharmacist', 'Manage medicines and prescriptions'),
        ('cashier', 'Create bills and manage customers')
    `);

    console.log("✅ Default roles inserted");

    // Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        role_id TINYINT UNSIGNED NOT NULL,
        full_name VARCHAR(120) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        phone VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_users_role
          FOREIGN KEY (role_id)
          REFERENCES roles(id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT
      )
    `);

    console.log("✅ Users table created");

    const [roles] = await db.query(`
      SELECT id, name, description
      FROM roles
      ORDER BY id
    `);

    console.table(roles);

    console.log("✅ PharmaERP database setup completed");
  } catch (error) {
    console.error("❌ Database setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

setupDatabase();
