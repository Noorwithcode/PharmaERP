const express = require("express");
const {
  testDatabase,
} = require("../controllers/databaseController");

const router = express.Router();

router.get("/test", testDatabase);

module.exports = router;
