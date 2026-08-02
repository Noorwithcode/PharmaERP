const db = require("../config/db");

// 1. FEFO (First Expired, First Out) Stock Report
const getFEFOReport = async () => {
    const [rows] = await db.query(
        `SELECT s.*, m.brand_name as medicine_name, m.unit 
         FROM stocks s 
         LEFT JOIN medicines m ON s.medicine_id = m.id 
         WHERE s.quantity > 0 
         ORDER BY s.expiry_date ASC`
    );
    return rows;
};

// 2. Get All Stock Batches Ledger
const getAllStocks = async () => {
    const [rows] = await db.query(
        `SELECT s.*, m.brand_name as medicine_name, m.unit 
         FROM stocks s 
         LEFT JOIN medicines m ON s.medicine_id = m.id 
         ORDER BY s.id DESC`
    );
    return rows;
};

module.exports = {
    getFEFOReport,
    getAllStocks
};
