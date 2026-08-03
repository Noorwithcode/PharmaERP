const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");

dotenv.config();

// =====================================================
// Route imports
// =====================================================

const databaseRoutes = require(
  "./routes/databaseRoutes"
);

const authRoutes = require(
  "./routes/authRoutes"
);

const categoryRoutes = require(
  "./routes/categoryRoutes"
);

const manufacturerRoutes = require(
  "./routes/manufacturerRoutes"
);

const supplierRoutes = require(
  "./routes/supplierRoutes"
);

const medicineRoutes = require(
  "./routes/medicineRoutes"
);

const stockRoutes = require(
  "./routes/stockRoutes"
);

const purchaseRoutes = require(
  "./routes/purchaseRoutes"
);

const customerRoutes = require(
  "./routes/customerRoutes"
);

const salesRoutes = require(
  "./routes/salesRoutes"
);

const saleReturnRoutes = require(
  "./routes/saleReturnRoutes"
);

const purchaseReturnRoutes = require(
  "./routes/purchaseReturnRoutes"
);

const stockAdjustmentRoutes = require(
  "./routes/stockAdjustmentRoutes"
);

const dashboardRoutes = require(
  "./routes/dashboardRoutes"
);

const reportRoutes = require(
  "./routes/reportRoutes"
);

const barcodeRoutes = require(
  "./routes/barcodeRoutes"
);

const settingsRoutes = require(
  "./routes/settingsRoutes"
);

const app = express();

// =====================================================
// 1. Global middleware
// =====================================================

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
  })
);

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// =====================================================
// 2. Root health check
// GET /
// =====================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message:
      "PharmaERP Enterprise API is running optimally",
    version: "1.0.0",
    environment:
      process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// 3. API router
// =====================================================

const apiRouter = express.Router();

// GET /api/health
apiRouter.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "PharmaERP API is healthy",
    version: "1.0.0",
    environment:
      process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use(
  "/database",
  databaseRoutes
);

apiRouter.use(
  "/auth",
  authRoutes
);

apiRouter.use(
  "/categories",
  categoryRoutes
);

apiRouter.use(
  "/manufacturers",
  manufacturerRoutes
);

apiRouter.use(
  "/suppliers",
  supplierRoutes
);

apiRouter.use(
  "/medicines",
  medicineRoutes
);

apiRouter.use(
  "/stock",
  stockRoutes
);

apiRouter.use(
  "/purchases",
  purchaseRoutes
);

apiRouter.use(
  "/customers",
  customerRoutes
);

apiRouter.use(
  "/sales",
  salesRoutes
);

apiRouter.use(
  "/sale-returns",
  saleReturnRoutes
);

apiRouter.use(
  "/purchase-returns",
  purchaseReturnRoutes
);

apiRouter.use(
  "/stock-adjustments",
  stockAdjustmentRoutes
);

apiRouter.use(
  "/dashboard",
  dashboardRoutes
);

apiRouter.use(
  "/reports",
  reportRoutes
);

apiRouter.use(
  "/barcodes",
  barcodeRoutes
);

apiRouter.use(
  "/settings",
  settingsRoutes
);

app.use("/api", apiRouter);

// =====================================================
// 4. API route not found handler
// Must remain after all API routes.
// =====================================================

app.use("/api", (req, res) => {
  return res.status(404).json({
    success: false,
    message:
      `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =====================================================
// 5. General route not found handler
// =====================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message:
      `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =====================================================
// 6. Global error handler
// Must remain after all routes.
// =====================================================

app.use((error, req, res, next) => {
  console.error(error);

  let statusCode =
    Number(error.statusCode) || 500;

  let message =
    error.message ||
    "Internal server error.";

  if (error.code === "ER_DUP_ENTRY") {
    statusCode = 409;
    message =
      "A duplicate database record was detected.";
  }

  if (
    error.code ===
    "ER_NO_REFERENCED_ROW_2"
  ) {
    statusCode = 400;
    message =
      "A referenced database record does not exist.";
  }

  if (error.code === "ER_BAD_FIELD_ERROR") {
    statusCode = 500;
    message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "A database schema error occurred.";
  }

  return res.status(statusCode).json({
    success: false,
    message,

    ...(process.env.NODE_ENV ===
      "development" && {
      errorCode: error.code || null,
      stack: error.stack,
    }),
  });
});

// =====================================================
// 7. Start server
// =====================================================

const PORT =
  Number(process.env.PORT) || 5000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Server running on http://0.0.0.0:${PORT}`
    );
  }
);

module.exports = app;
