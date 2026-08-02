const db = require("../config/db");

/**
 * Get Sale Header / Master details
 */
const getSaleHeader = async (saleId) => {
    const [rows] = await db.query(
        `
        SELECT
            sales.id,
            sales.invoice_number AS invoiceNumber,
            sales.sale_date AS saleDate,
            sales.subtotal,
            sales.discount_amount AS discountAmount,
            sales.tax_amount AS taxAmount,
            sales.round_off AS roundOff,
            sales.grand_total AS grandTotal,
            sales.paid_amount AS paidAmount,
            sales.due_amount AS dueAmount,
            sales.payment_status AS paymentStatus,
            sales.payment_method AS paymentMethod,
            sales.notes,
            sales.created_at AS createdAt,
            customers.id AS customerId,
            customers.name AS customerName,
            customers.phone AS customerPhone,
            customers.address AS customerAddress,
            users.full_name AS createdByName
        FROM sales
        LEFT JOIN customers ON customers.id = sales.customer_id
        LEFT JOIN users ON users.id = sales.created_by
        WHERE sales.id = ?
        LIMIT 1
        `,
        [saleId]
    );

    return rows[0] || null;
};

/**
 * Get Sale Items with Batch and Medicine details
 */
const getSaleItems = async (saleId) => {
    const [rows] = await db.query(
        `
        SELECT
            sale_items.id,
            sale_items.medicine_id AS medicineId,
            sale_items.batch_id AS batchId,
            sale_items.quantity,
            sale_items.unit_price AS unitPrice,
            sale_items.discount_amount AS discountAmount,
            sale_items.tax_rate AS taxRate,
            sale_items.tax_amount AS taxAmount,
            sale_items.total_amount AS totalAmount,
            medicines.brand_name AS brandName,
            medicines.generic_name AS genericName,
            medicine_batches.batch_number AS batchNumber,
            medicine_batches.expiry_date AS expiryDate
        FROM sale_items
        INNER JOIN medicines ON medicines.id = sale_items.medicine_id
        INNER JOIN medicine_batches ON medicine_batches.id = sale_items.batch_id
        WHERE sale_items.sale_id = ?
        ORDER BY sale_items.id ASC
        `,
        [saleId]
    );

    return rows;
};

/**
 * Create a new Sale (POS Billing) with Transaction & Stock Deduction
 */
const createSale = async (saleData, itemsData) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // 1. Insert into Sales (Master Table)
        const [saleResult] = await connection.query(
            `INSERT INTO sales 
            (invoice_number, customer_id, sale_date, subtotal, discount_amount, tax_amount, round_off, grand_total, paid_amount, due_amount, payment_status, payment_method, notes, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                saleData.invoiceNumber, 
                saleData.customerId || null, // Customer can be null for walking customers
                saleData.saleDate, 
                saleData.subtotal, 
                saleData.discountAmount, 
                saleData.taxAmount, 
                saleData.roundOff, 
                saleData.grandTotal, 
                saleData.paidAmount, 
                saleData.dueAmount, 
                saleData.paymentStatus, 
                saleData.paymentMethod, 
                saleData.notes, 
                saleData.createdBy
            ]
        );

        const saleId = saleResult.insertId;

        // 2. Insert Sale Items and Deduct Inventory
        for (const item of itemsData) {
            
            // a. Insert Item
            await connection.query(
                `INSERT INTO sale_items 
                (sale_id, medicine_id, batch_id, quantity, unit_price, discount_amount, tax_rate, tax_amount, total_amount) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    saleId, 
                    item.medicineId, 
                    item.batchId, 
                    item.quantity, 
                    item.unitPrice, 
                    item.discountAmount, 
                    item.taxRate, 
                    item.taxAmount, 
                    item.totalAmount
                ]
            );

            // b. Deduct Stock from medicine_batches (CRITICAL: Prevent Negative Stock)
            const [updateStock] = await connection.query(
                `UPDATE medicine_batches 
                 SET current_stock = current_stock - ? 
                 WHERE id = ? AND current_stock >= ?`,
                [item.quantity, item.batchId, item.quantity]
            );

            // If affectedRows is 0, it means either the batch doesn't exist or stock is less than requested
            if (updateStock.affectedRows === 0) {
                throw new Error(`Insufficient stock for Batch ID: ${item.batchId}. Billing cancelled.`);
            }
        }

        // 3. Commit Transaction
        await connection.commit();
        return saleId;

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    getSaleHeader,
    getSaleItems,
    createSale
};
