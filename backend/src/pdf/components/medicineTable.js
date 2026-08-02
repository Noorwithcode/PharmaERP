const medicineTable = (items) => {
    let rows = items.map((item, index) => `
        <tr>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${index + 1}</td>
            <td style="border: 1px solid #000; padding: 5px;">${item.name}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.batchNo}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.mfgDate}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.expDate}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.qty}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${item.free}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${item.mrp}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${item.purPrice}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${item.disc}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${item.taxable}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${item.gst}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${item.taxAmt}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right;">${item.total}</td>
        </tr>
    `).join('');

    return `
        <div style="clear: both; margin-top: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #003366; color: white;">
                        <th style="border: 1px solid #003366; padding: 8px;">#</th>
                        <th style="border: 1px solid #003366; padding: 8px; text-align: left;">Medicine</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Batch</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Mfg</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Exp</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Qty</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Free</th>
                        <th style="border: 1px solid #003366; padding: 8px;">MRP</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Pur ₹</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Disc</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Taxable</th>
                        <th style="border: 1px solid #003366; padding: 8px;">GST</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Tax ₹</th>
                        <th style="border: 1px solid #003366; padding: 8px;">Total</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};
module.exports = medicineTable;