require("dotenv").config();

const db = require("../config/db");

const API_URL =
  process.env.API_URL ||
  "http://localhost:5000/api";

const MEDICINE_ID = 1;
const BATCH_ID = 1;

const sendAdjustmentRequest = async (
  requestName,
  quantity
) => {
  const response = await fetch(
    `${API_URL}/stock-adjustments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        adjustmentDate:
          new Date()
            .toISOString()
            .slice(0, 10),

        reason: "MANUAL_CORRECTION",

        notes:
          `Concurrency test ${requestName}`,

        items: [
          {
            medicineId: MEDICINE_ID,
            batchId: BATCH_ID,
            adjustmentType: "SUBTRACT",
            quantity,
            notes:
              `Simultaneous request ${requestName}`
          }
        ]
      })
    }
  );

  const responseBody =
    await response.json();

  return {
    requestName,
    statusCode: response.status,
    success: response.ok,
    responseBody
  };
};

const testConcurrency = async () => {
  try {
    console.log(
      "Starting Stock Adjustment concurrency test..."
    );

    /*
     * Test শুরুর আগের batch stock।
     */
    const [beforeBatchRows] =
      await db.query(
        `
          SELECT
            id,
            batch_number AS batchNumber,
            quantity_available
              AS quantityAvailable
          FROM medicine_batches
          WHERE id = ?
        `,
        [BATCH_ID]
      );

    if (beforeBatchRows.length === 0) {
      throw new Error(
        `Batch ID ${BATCH_ID} not found.`
      );
    }

    const stockBefore =
      Number(
        beforeBatchRows[0]
          .quantityAvailable
      );

    if (stockBefore < 2) {
      throw new Error(
        "At least 2 stock units are " +
        "required for this test."
      );
    }

    /*
     * প্রতিটি request অর্ধেকের চেয়ে
     * এক unit বেশি চাইবে।
     *
     * ফলে একটিই succeed করতে পারবে।
     */
    const requestQuantity =
      Math.floor(stockBefore / 2) + 1;

    const expectedFinalStock =
      stockBefore - requestQuantity;

    const [beforeCountRows] =
      await db.query(
        `
          SELECT
            (
              SELECT COUNT(*)
              FROM stock_adjustments
            ) AS adjustmentCount,

            (
              SELECT COUNT(*)
              FROM stock_movements
              WHERE reference_type =
                'STOCK_ADJUSTMENT'
            ) AS movementCount
        `
      );

    const adjustmentCountBefore =
      Number(
        beforeCountRows[0]
          .adjustmentCount
      );

    const movementCountBefore =
      Number(
        beforeCountRows[0]
          .movementCount
      );

    console.log({
      batchId: BATCH_ID,
      batchNumber:
        beforeBatchRows[0].batchNumber,
      stockBefore,
      requestQuantity,
      expectedFinalStock
    });

    /*
     * Promise.all একই সময়ে দুইটি
     * HTTP request পাঠাবে।
     */
    const results =
      await Promise.all([
        sendAdjustmentRequest(
          "REQUEST-A",
          requestQuantity
        ),

        sendAdjustmentRequest(
          "REQUEST-B",
          requestQuantity
        )
      ]);

    console.log(
      "\nRequest results:"
    );

    console.table(
      results.map((result) => ({
        request:
          result.requestName,
        statusCode:
          result.statusCode,
        success:
          result.success,
        message:
          result.responseBody.message
      }))
    );

    /*
     * Test-এর পর latest database state।
     */
    const [afterBatchRows] =
      await db.query(
        `
          SELECT
            quantity_available
              AS quantityAvailable
          FROM medicine_batches
          WHERE id = ?
        `,
        [BATCH_ID]
      );

    const stockAfter =
      Number(
        afterBatchRows[0]
          .quantityAvailable
      );

    const [afterCountRows] =
      await db.query(
        `
          SELECT
            (
              SELECT COUNT(*)
              FROM stock_adjustments
            ) AS adjustmentCount,

            (
              SELECT COUNT(*)
              FROM stock_movements
              WHERE reference_type =
                'STOCK_ADJUSTMENT'
            ) AS movementCount
        `
      );

    const adjustmentCountAfter =
      Number(
        afterCountRows[0]
          .adjustmentCount
      );

    const movementCountAfter =
      Number(
        afterCountRows[0]
          .movementCount
      );

    const successfulRequests =
      results.filter(
        (result) =>
          result.statusCode === 201
      ).length;

    const rejectedRequests =
      results.filter(
        (result) =>
          result.statusCode === 409
      ).length;

    const adjustmentDifference =
      adjustmentCountAfter -
      adjustmentCountBefore;

    const movementDifference =
      movementCountAfter -
      movementCountBefore;

    const passed =
      successfulRequests === 1 &&
      rejectedRequests === 1 &&
      stockAfter ===
        expectedFinalStock &&
      adjustmentDifference === 1 &&
      movementDifference === 1;

    console.log(
      "\nConcurrency verification:"
    );

    console.table([
      {
        check:
          "Successful requests",
        expected: 1,
        actual:
          successfulRequests
      },
      {
        check:
          "Rejected requests",
        expected: 1,
        actual:
          rejectedRequests
      },
      {
        check:
          "Final stock",
        expected:
          expectedFinalStock,
        actual:
          stockAfter
      },
      {
        check:
          "New adjustments",
        expected: 1,
        actual:
          adjustmentDifference
      },
      {
        check:
          "New movements",
        expected: 1,
        actual:
          movementDifference
      }
    ]);

    if (!passed) {
      throw new Error(
        "Concurrency test failed."
      );
    }

    console.log(
      "\n✅ Concurrency test passed."
    );

    console.log(
      "✅ No negative stock."
    );

    console.log(
      "✅ No lost update."
    );

    console.log(
      "✅ Failed request rolled back."
    );
  } catch (error) {
    console.error(
      "\n❌ Concurrency test failed:"
    );

    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await db.end();
  }
};

testConcurrency();