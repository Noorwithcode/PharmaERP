const invoiceInfo = (data) => {
    const { purchaseNo, date, invoiceNo, paymentStatus, paymentMethod, createdBy } = data;
    return `
        <div style="width: 50%; float: left; margin-bottom: 20px;">
            <h3 style="color: white; background: #003366; padding: 5px 10px; margin: 0;">PURCHASE INVOICE</h3>
            <div style="border: 1px solid #ddd; padding: 10px; border-top: none;">
                <p><strong>Purchase No</strong> : ${purchaseNo}</p>
                <p><strong>Purchase Date</strong> : ${date}</p>
                <p><strong>Invoice No</strong> : ${invoiceNo}</p>
                <p><strong>Payment Status</strong> : ${paymentStatus}</p>
                <p><strong>Payment Method</strong> : ${paymentMethod}</p>
                <p><strong>Created By</strong> : ${createdBy}</p>
            </div>
        </div>
    `;
};
module.exports = invoiceInfo;