const inventoryService = require("../services/inventoryService");

// Controller for FEFO Report
const fetchFEFOReport = async (req, res) => {
    try {
        const report = await inventoryService.getFEFOReport();
        return res.status(200).json({
            success: true,
            count: report.length,
            data: report
        });
    } catch (error) {
        console.error("Error fetching FEFO report:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Controller for All Stocks
const fetchAllStocks = async (req, res) => {
    try {
        const stocks = await inventoryService.getAllStocks();
        return res.status(200).json({
            success: true,
            count: stocks.length,
            data: stocks
        });
    } catch (error) {
        console.error("Error fetching stocks:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    fetchFEFOReport,
    fetchAllStocks
};
