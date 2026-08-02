const puppeteer = require('puppeteer');

// Components Import
const header = require('./components/header');
const invoiceInfo = require('./components/invoiceInfo');
const medicineTable = require('./components/medicineTable');
const footer = require('./components/footer');
// ... import অন্যান্য কম্পোনেন্ট ...

const generateInvoicePDF = async (data) => {
    try {
        // 1. সব কম্পোনেন্ট থেকে HTML তৈরি করা
        const headerHTML = header(data.header);
        const invoiceInfoHTML = invoiceInfo(data.invoiceInfo);
        // ... অন্যান্য কম্পোনেন্ট কল করা ...
        const medicineTableHTML = medicineTable(data.items);
        const footerHTML = footer();

        // 2. সম্পূর্ণ HTML টেমপ্লেট
        const fullHTML = `
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; width: 210mm; margin: auto; }
                        /* এখানে অন্যান্য গ্লোবাল CSS দিন */
                        .clearfix::after { content: ""; clear: both; display: table; }
                    </style>
                </head>
                <body>
                    ${headerHTML}
                    <div class="clearfix">
                        ${invoiceInfoHTML}
                        <!-- Party Details div -->
                    </div>
                    ${medicineTableHTML}
                    <!-- Summary and Bank Details div -->
                    ${footerHTML}
                </body>
            </html>
        `;

        // 3. Puppeteer দিয়ে PDF জেনারেশন
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(fullHTML, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
        });

        await browser.close();
        return pdfBuffer;

    } catch (error) {
        console.error("PDF Generation Error:", error);
        throw error;
    }
};

module.exports = generateInvoicePDF;