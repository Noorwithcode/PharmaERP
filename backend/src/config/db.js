require("dotenv").config();

const fs = require("fs");
const mysql = require("mysql2/promise");

const isSslEnabled =
  String(process.env.DB_SSL || "false")
    .trim()
    .toLowerCase() === "true";

const createSslConfig = () => {
  if (!isSslEnabled) {
    return undefined;
  }

  const caPath =
    process.env.DB_CA_PATH;

  if (
    caPath &&
    fs.existsSync(caPath)
  ) {
    return {
      ca: fs.readFileSync(
        caPath,
        "utf8"
      ),
      rejectUnauthorized: true,
    };
  }

  return {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
  };
};

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(
    process.env.DB_PORT || 3306
  ),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: Number(
    process.env.DB_CONNECTION_LIMIT || 10
  ),
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,

  decimalNumbers: true,

  ssl: createSslConfig(),
});

const testConnection = async () => {
  const connection =
    await db.getConnection();

  try {
    const [rows] =
      await connection.query(`
        SELECT
          DATABASE() AS databaseName,
          VERSION() AS databaseVersion,
          NOW() AS connectedAt
      `);

    console.log(
      "✅ Cloud MySQL connected:",
      rows[0]
    );
  } finally {
    connection.release();
  }
};

testConnection().catch((error) => {
  console.error(
    "❌ Database connection failed:",
    error.message
  );
});

module.exports = db;