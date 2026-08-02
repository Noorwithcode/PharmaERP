const puppeteer = require("puppeteer");
const purchaseInvoiceTemplate = require("../pdf/purchaseInvoicePdf");

const generatePurchasePdf = async (purchase, items) => {
  const browser = await puppeteer.launch({ headless: true });

  const page = await browser.newPage();
  await page.setContent(purchaseInvoiceTemplate(purchase, items));

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "15mm",
      bottom: "15mm",
      left: "10mm",
      right: "10mm",
    },
  });

  await browser.close();

  return pdf;
};

module.exports = {
  generatePurchasePdf,
};