const PDFDocument = require("pdfkit");
const db = require("../config/db");

const generateThermalReceiptPDF = async (saleId, res) => {
    try {
        // 1. Fetch Sale Master & Customer Details
        const [saleRows] = await db.query(
            `SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.full_name as user_name 
             FROM sales s 
             LEFT JOIN customers c ON s.customer_id = c.id 
             LEFT JOIN users u ON s.user_id = u.id 
             WHERE s.id = ?`,
            [saleId]
        );

        if (saleRows.length === 0) {
            throw new Error("Sale invoice not found");
        }

        const sale = saleRows[0];

        // 2. Fetch Sale Items
        const [items] = await db.query(
            `SELECT si.*, m.brand_name as medicine_name 
             FROM sale_items si 
             LEFT JOIN medicines m ON si.medicine_id = m.id 
             WHERE si.sale_id = ?`,
            [saleId]
        );

        // 80mm width = ~226 points
        const doc = new PDFDocument({ margin: 10, size: [226.77, 500] });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename=Thermal-Receipt-${sale.id}.pdf`);

        doc.pipe(res);

        // --- Store Header ---
        doc.fontSize(12).font('Helvetica-Bold').text("PharmaERP Store", { align: 'center' });
        doc.fontSize(8).font('Helvetica').text("120, Medical College Street, Kolkata", { align: 'center' });
        doc.text("Ph: +91 9876543210", { align: 'center' });
        doc.text("----------------------------------------------------------------", { align: 'center' });

        // --- Receipt Info ---
        doc.fontSize(8).font('Helvetica');
        doc.text(`Receipt ID: #${sale.id}`);
        doc.text(`Date: ${new Date(sale.created_at).toLocaleString()}`);
        doc.text(`Cashier: ${sale.user_name || 'Admin'}`);
        if (sale.customer_name) {
            doc.text(`Customer: ${sale.customer_name} (${sale.customer_phone || ''})`);
        }
        doc.text("----------------------------------------------------------------", { align: 'center' });

        // --- Items Table Header ---
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text("Item", 10, doc.y, { continued: true, width: 95 });
        doc.text("Qty", 105, doc.y, { continued: true, width: 25, align: 'center' });
        doc.text("Price", 130, doc.y, { continued: true, width: 40, align: 'right' });
        doc.text("Total", 172, doc.y, { width: 45, align: 'right' });

        doc.text("----------------------------------------------------------------", { align: 'center' });

        // --- Items Rows ---
        doc.font('Helvetica').fontSize(8);
        items.forEach((item) => {
            doc.text(item.medicine_name, 10, doc.y, { continued: true, width: 95 });
            doc.text(item.quantity.toString(), 105, doc.y, { continued: true, width: 25, align: 'center' });
            doc.text(Number(item.selling_price).toFixed(2), 130, doc.y, { continued: true, width: 40, align: 'right' });
            doc.text(Number(item.total_price).toFixed(2), 172, doc.y, { width: 45, align: 'right' });
        });

        doc.text("----------------------------------------------------------------", { align: 'center' });

        // --- Totals ---
        doc.font('Helvetica-Bold');
        doc.text(`Total Amount: Rs. ${Number(sale.total_amount).toFixed(2)}`, { align: 'right' });
        doc.text(`Discount: Rs. ${Number(sale.discount || 0).toFixed(2)}`, { align: 'right' });
        doc.text(`Paid Amount: Rs. ${Number(sale.paid_amount).toFixed(2)}`, { align: 'right' });
        doc.text(`Payment Mode: ${sale.payment_method}`, { align: 'right' });

        doc.text("----------------------------------------------------------------", { align: 'center' });
        doc.fontSize(8).font('Helvetica').text("Thank You! Get Well Soon.", { align: 'center' });

        doc.end();
    } catch (error) {
        throw error;
    }
};

module.exports = {
    generateThermalReceiptPDF
};
