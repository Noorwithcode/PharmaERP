const db = require("../config/db");

const supplierRepository = require(
    "../repositories/supplierRepository"
);

const createError = (
    message,
    statusCode = 400
) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const parseActiveFilter = (value) => {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return null;
    }

    const normalizedValue = String(value)
        .trim()
        .toLowerCase();

    if (
        normalizedValue === "true" ||
        normalizedValue === "1"
    ) {
        return true;
    }

    if (
        normalizedValue === "false" ||
        normalizedValue === "0"
    ) {
        return false;
    }

    throw createError(
        "Invalid isActive filter."
    );
};

/**
 * Get supplier list.
 */
const getSuppliers = async (
    filters = {}
) => {
    const page = Math.max(
        Number(filters.page) || 1,
        1
    );

    const limit = Math.min(
        Math.max(
            Number(filters.limit) || 20,
            1
        ),
        500
    );

    const offset =
        (page - 1) * limit;

    const search =
        filters.search?.trim() || "";

    const isActive =
        parseActiveFilter(
            filters.isActive
        );

    const conditions = [];
    const values = [];

    if (search) {
        conditions.push(
            "suppliers.name LIKE ?"
        );

        values.push(`%${search}%`);
    }

    if (isActive !== null) {
        conditions.push(
            "suppliers.is_active = ?"
        );

        values.push(
            isActive ? 1 : 0
        );
    }

    const whereClause =
        conditions.length > 0
            ? `WHERE ${conditions.join(
                " AND "
            )}`
            : "";

    const [countRows] =
        await db.query(
            `
                SELECT
                    COUNT(*) AS total

                FROM suppliers

                ${whereClause}
            `,
            values
        );

    const total = Number(
        countRows[0]?.total || 0
    );

    const [rows] = await db.query(
        `
            SELECT
                suppliers.id,
                suppliers.name,

                suppliers.is_active
                    AS isActive

            FROM suppliers

            ${whereClause}

            ORDER BY
                suppliers.name ASC,
                suppliers.id ASC

            LIMIT ${limit}
            OFFSET ${offset}
        `,
        values
    );

    return {
        suppliers: rows.map(
            (supplier) => ({
                id: Number(
                    supplier.id
                ),

                name:
                    supplier.name,

                isActive: Boolean(
                    supplier.isActive
                )
            })
        ),

        pagination: {
            page,
            limit,
            total,

            totalPages: Math.max(
                Math.ceil(
                    total / limit
                ),
                1
            )
        }
    };
};

/**
 * Get supplier ledger.
 */
const getSupplierLedger = async (
    supplierId,
    startDate,
    endDate
) => {
    const validSupplierId =
        Number(supplierId);

    if (
        !Number.isInteger(
            validSupplierId
        ) ||
        validSupplierId <= 0
    ) {
        throw createError(
            "Valid supplier ID is required."
        );
    }

    const today = new Date();

    const defaultEndDate = today
        .toISOString()
        .slice(0, 10);

    const thirtyDaysAgo =
        new Date(today);

    thirtyDaysAgo.setDate(
        thirtyDaysAgo.getDate() - 30
    );

    const defaultStartDate =
        thirtyDaysAgo
            .toISOString()
            .slice(0, 10);

    const finalStartDate =
        startDate ||
        defaultStartDate;

    const finalEndDate =
        endDate ||
        defaultEndDate;

    if (
        finalStartDate >
        finalEndDate
    ) {
        throw createError(
            "startDate cannot be after endDate."
        );
    }

    const ledgerResult =
        await supplierRepository
            .getSupplierLedger(
                validSupplierId,
                finalStartDate,
                finalEndDate
            );

    if (!ledgerResult) {
        throw createError(
            "Supplier ledger not found.",
            404
        );
    }

    const openingBalance = Number(
        ledgerResult.openingBalance || 0
    );

    const transactions =
        Array.isArray(
            ledgerResult.transactions
        )
            ? ledgerResult.transactions
            : [];

    let runningBalance =
        openingBalance;

    const formattedTransactions =
        transactions.map(
            (transaction) => {
                const credit = Number(
                    transaction.credit || 0
                );

                const debit = Number(
                    transaction.debit || 0
                );

                runningBalance =
                    runningBalance +
                    credit -
                    debit;

                return {
                    ...transaction,
                    credit,
                    debit,

                    balance: Number(
                        runningBalance
                            .toFixed(2)
                    )
                };
            }
        );

    return {
        supplierId:
            validSupplierId,

        period: {
            startDate:
                finalStartDate,

            endDate:
                finalEndDate
        },

        openingBalance:
            Number(
                openingBalance
                    .toFixed(2)
            ),

        closingBalance:
            Number(
                runningBalance
                    .toFixed(2)
            ),

        transactions:
            formattedTransactions
    };
};

module.exports = {
    getSuppliers,
    getSupplierLedger
};