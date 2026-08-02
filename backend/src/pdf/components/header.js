const header = (data) => {
    const { pharmacyName, address, phone, email, gstin, drugLicense } = data;
    return `
        <div style="text-align: center; border-bottom: 3px solid #003366; padding-bottom: 15px; margin-bottom: 20px; font-family: 'Arial', sans-serif;">
            <h1 style="color: #003366; font-size: 26px; margin: 0;">${pharmacyName}</h1>
            <p style="margin: 5px 0;">${address}</p>
            <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; font-size: 13px; font-weight: bold; margin-top: 8px;">
                <span>Phone: ${phone}</span>
                <span>Email: ${email}</span>
                <span style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">GSTIN: ${gstin}</span>
                <span style="background: #f0f0f0; padding: 2px 8px; border-radius: 4px;">Drug License: ${drugLicense}</span>
            </div>
        </div>
    `;
};
module.exports = header;