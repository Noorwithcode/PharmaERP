const db = require("../config/db");

/**
 * Get paginated supplier list.
 */
const getSuppliers = async ({
    search,
    isActive,
    page,
    limit
}) => {
    const conditions = [];
    const values = [];

    if (search) {
        const searchValue = `%${search}%`;

        conditions.push(`
            (
                suppliers.name LIKE ?
                OR suppliers.contact_person LIKE ?
                OR suppliers.phone LIKE ?
                OR suppliers.email LIKE ?
            )
        `);

        values.push(
            searchValue,
            searchValue,
            searchValue,
            searchValue
        );
    }

    if (isActive !== null) {
        conditions.push(
            "suppliers.is_active = ?"
        );

        values.push(isActive ? 1 : 0);
    }

    const whereClause =
        conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

    const offset = (page - 1) * limit;

    const [countRows] = await db.query(
        `
            SELECT COUNT(*) AS total
            FROM suppliers
            ${whereClause}
        `,
        values
    );

    const total = Number(
        countRows[0].total
    );

    const [suppliers] = await db.query(
        `
            SELECT
                suppliers.id,

                suppliers.name,

                suppliers.contact_person
                    AS contactPerson,

                suppliers.phone,

                suppliers.email,

                suppliers.address,

                suppliers.drug_license
                    AS drugLicense,

                suppliers.gstin,

                suppliers.credit_days
                    AS creditDays,

                suppliers.is_active
                    AS isActive,

                suppliers.created_at
                    AS createdAt,

                suppliers.updated_at
                    AS updatedAt

            FROM suppliers

            ${whereClause}

            ORDER BY suppliers.name ASC

            LIMIT ${limit}
            OFFSET ${offset}
        `,
        values
    );

    return {
        suppliers: suppliers.map(
            (supplier) => ({
                ...supplier,
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
                Math.ceil(total / limit),
                1
            )
        }
    };
};