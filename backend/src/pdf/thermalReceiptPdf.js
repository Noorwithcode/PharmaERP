const PDFDocument = require("pdfkit");
const { formatMoney, formatDate, safeText } = require("../utils/formatters");

/**
 * Generate 80mm Thermal Receipt (POS)
 */
const renderThermalReceipt = async ({ sale, items, res }) => {
    // 80mm paper width is approximately 226 points
    const PAGE_WIDTH = 226; 
    const MARGIN = 10;
    
    const doc = new PDFDocument({
        margin: MARGIN,
        size: [PAGE_WIDTH, 800], // Height can be arbitrary, thermal printers just roll
    });

    // Pipe directly to the response object
    doc.pipe(res);

    // --- 1. HEADER (Pharmacy Info) ---
    doc.font("Helvetica-Bold").fontSize(12).text(
        process.env.PHARMACY_NAME || "PHARMA ERP",
        { align: "center", width: PAGE_WIDTH - (MARGIN * 2) }
    );
    
    doc.font("Helvetica").fontSize(8).text(
        process.env.PHARMACY_ADDRESS || "123 Healthcare Avenue, City",
        { align: "center", width: PAGE_WIDTH - (MARGIN * 2) }
    );
    
    doc.text(`Ph: ${process.env.PHARMACY_PHONE || "9876543210"}`, { align: "center" });
    
    doc.moveDown(0.5);
    drawDivider(doc, PAGE_WIDTH, MARGIN);

    // --- 2. INVOICE INFO ---
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(8);
    doc.text(`Inv No : ${safeText(sale.invoiceNumber)}`);
    doc.text(`Date   : ${formatDate(sale.saleDate)}`);
    if (sale.customerName) {
        doc.text(`Name   : ${safeText(sale.customerName)}`);
    }
    
    doc.moveDown(0.5);
    drawDivider(doc, PAGE_WIDTH, MARGIN);

    // --- 3. ITEMS TABLE HEADER ---
    doc.moveDown(0.5);
    doc.font("Helvetica-Bold").fontSize(8);
    
    const startY = doc.y;
    doc.text("Item", MARGIN, startY, { width: 90 });
    doc.text("Qty", MARGIN + 95, startY, { width: 25, align: "center" });
    doc.text("Rate", MARGIN + 120, startY, { width: 35, align: "right" });
    doc.text("Total", MARGIN + 160, startY, { width: 45, align: "right" });
    
    doc.moveDown(0.5);
    drawDivider(doc, PAGE_WIDTH, MARGIN);

    // --- 4. ITEMS LIST ---
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(7.5);
    
    items.forEach(item => {
        const itemY = doc.y;
        
        // Item Name (Truncated if too long)
        let medicineName = safeText(item.brandName);
        if (medicineName.length > 20) medicineName = medicineName.substring(0, 18) + "..";
        
        doc.text(medicineName, MARGIN, itemY, { width: 90 });
        doc.text(String(item.quantity), MARGIN + 95, itemY, { width: 25, align: "center" });
        doc.text(Number(item.unitPrice).toFixed(2), MARGIN + 120, itemY, { width: 35, align: "right" });
        doc.text(Number(item.totalAmount).toFixed(2), MARGIN + 160, itemY, { width: 45, align: "right" });
        
        doc.moveDown(0.3);
    });

    drawDivider(doc, PAGE_WIDTH, MARGIN);

    // --- 5. TOTALS ---
    doc.moveDown(0.5);
    const totalsX = MARGIN + 80;
    
    doc.font("Helvetica").fontSize(8);
    doc.text("Subtotal:", MARGIN, doc.y, { width: 70, align: "right" });
    doc.text(formatMoney(sale.subtotal), totalsX, doc.y - 9.5, { width: 126, align: "right" });
    
    if (sale.discountAmount > 0) {
        doc.text("Discount:", MARGIN, doc.y, { width: 70, align: "right" });
        doc.text(`-${formatMoney(sale.discountAmount)}`, totalsX, doc.y - 9.5, { width: 126, align: "right" });
    }
    
    if (sale.taxAmount > 0) {
        doc.text("GST:", MARGIN, doc.y, { width: 70, align: "right" });
        doc.text(formatMoney(sale.taxAmount), totalsX, doc.y - 9.5, { width: 126, align: "right" });
    }

    doc.moveDown(0.2);
    
    // Grand Total (Bold)
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("GRAND TOTAL:", MARGIN, doc.y, { width: 70, align: "right" });
    doc.text(formatMoney(sale.grandTotal), totalsX, doc.y - 12, { width: 126, align: "right" });

    // Paid & Due (Small)
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(8);
    doc.text(`Paid: ${formatMoney(sale.paidAmount)}`, MARGIN, doc.y, { width: PAGE_WIDTH - (MARGIN * 2), align: "right" });
    if (sale.dueAmount > 0) {
        doc.text(`Due: ${formatMoney(sale.dueAmount)}`, MARGIN, doc.y, { width: PAGE_WIDTH - (MARGIN * 2), align: "right" });
    }

    // --- 6. FOOTER ---
    doc.moveDown(1);
    drawDivider(doc, PAGE_WIDTH, MARGIN);
    doc.moveDown(0.5);
    
    doc.font("Helvetica-Bold").fontSize(8).text(
        "Thank You! Visit Again.",
        { align: "center", width: PAGE_WIDTH - (MARGIN * 2) }
    );
    
    doc.font("Helvetica").fontSize(7).text(
        "Goods once sold cannot be taken back",
        { align: "center", width: PAGE_WIDTH - (MARGIN * 2) }
    );

    doc.end();
};

/**
 * Helper to draw a dashed divider line
 */
function drawDivider(doc, pageWidth, margin) {
    doc.strokeColor("#aaaaaa")
       .lineWidth(0.5)
       .moveTo(margin, doc.y)
       .lineTo(pageWidth - margin, doc.y)
       .dash(3, { space: 2 }) // Dashed line effect for thermal printers
       .stroke()
       .undash(); // Reset dash for future lines
}

module.exports = {
    renderThermalReceipt
};
