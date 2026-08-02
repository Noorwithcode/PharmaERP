const customerRepository = require(
  "../repositories/customerRepository"
);

const createError = (
  message,
  statusCode = 400
) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
};

const parseActiveFilter = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() ===
      "true"
  ) {
    return 1;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    String(value).toLowerCase() ===
      "false"
  ) {
    return 0;
  }

  throw createError(
    "isActive must be true or false."
  );
};

/**
 * Get paginated customer list
 */
const getCustomers = async (
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

  const search =
    String(
      filters.search || ""
    )
      .trim()
      .slice(0, 100);

  const isActive =
    parseActiveFilter(
      filters.isActive
    );

  const offset =
    (page - 1) * limit;

  const [
    customers,
    total
  ] = await Promise.all([
    customerRepository.getCustomers({
      search,
      isActive,
      limit,
      offset
    }),

    customerRepository.countCustomers({
      search,
      isActive
    })
  ]);

  return {
    customers,

    pagination: {
      page,
      limit,
      total,

      totalPages:
        total === 0
          ? 0
          : Math.ceil(
              total / limit
            )
    }
  };
};

const validateDate = (
  value,
  fieldName
) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      String(value)
    )
  ) {
    throw createError(
      `${fieldName} must use YYYY-MM-DD format.`
    );
  }

  const parsedDate =
    new Date(
      `${value}T00:00:00Z`
    );

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    throw createError(
      `${fieldName} is invalid.`
    );
  }

  return value;
};

/**
 * Get customer ledger
 */
const getCustomerLedger = async (
  customerId,
  startDate,
  endDate
) => {
  const normalizedCustomerId =
    Number(customerId);

  if (
    !Number.isInteger(
      normalizedCustomerId
    ) ||
    normalizedCustomerId <= 0
  ) {
    throw createError(
      "Valid customer ID is required."
    );
  }

  const today = new Date();

  const defaultEndDate =
    today
      .toISOString()
      .slice(0, 10);

  const thirtyDaysAgo =
    new Date(today);

  thirtyDaysAgo.setUTCDate(
    thirtyDaysAgo.getUTCDate() - 30
  );

  const defaultStartDate =
    thirtyDaysAgo
      .toISOString()
      .slice(0, 10);

  const finalStartDate =
    validateDate(
      startDate ||
        defaultStartDate,
      "startDate"
    );

  const finalEndDate =
    validateDate(
      endDate ||
        defaultEndDate,
      "endDate"
    );

  if (
    finalStartDate >
    finalEndDate
  ) {
    throw createError(
      "startDate cannot be after endDate."
    );
  }

  const {
    openingBalance,
    transactions
  } =
    await customerRepository
      .getCustomerLedger(
        normalizedCustomerId,
        finalStartDate,
        finalEndDate
      );

  let runningBalance =
    Number(openingBalance);

  const formattedTransactions =
    transactions.map(
      (transaction) => {
        const debit =
          Number(
            transaction.debit || 0
          );

        const credit =
          Number(
            transaction.credit || 0
          );

        runningBalance =
          runningBalance +
          debit -
          credit;

        return {
          ...transaction,
          debit,
          credit,
          balance:
            Number(
              runningBalance.toFixed(2)
            )
        };
      }
    );

  return {
    customerId:
      normalizedCustomerId,

    period: {
      startDate:
        finalStartDate,

      endDate:
        finalEndDate
    },

    openingBalance:
      Number(
        Number(
          openingBalance
        ).toFixed(2)
      ),

    closingBalance:
      Number(
        runningBalance.toFixed(2)
      ),

    transactions:
      formattedTransactions
  };
};

module.exports = {
  getCustomers,
  getCustomerLedger
};