const supplierService = require(
    "../services/supplierService"
);

/**
 * GET /api/suppliers
 */
const getSuppliers = async (
    req,
    res,
    next
) => {
    try {
        const result =
            await supplierService
                .getSuppliers({
                    search:
                        req.query.search,

                    isActive:
                        req.query.isActive,

                    page:
                        req.query.page,

                    limit:
                        req.query.limit
                });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/suppliers/:id/ledger
 */
const getSupplierLedger = async (
    req,
    res,
    next
) => {
    try {
        const {
            startDate,
            endDate
        } = req.query;

        const result =
            await supplierService
                .getSupplierLedger(
                    req.params.id,
                    startDate,
                    endDate
                );

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSuppliers,
    getSupplierLedger
};