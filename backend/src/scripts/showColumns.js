require("dotenv").config();
const db = require("../config/db");

(async () => {
  try {
    const [rows] = await db.query("SHOW COLUMNS FROM purchase_items");
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();