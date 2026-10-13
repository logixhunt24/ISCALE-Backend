const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");
const {
  listResults,
  getResultForAdmin,
  resetAttempt,
} = require("../controllers/quizResultsAdminController");

router.get("/list", authMiddleware, adminMiddleware, listResults);
router.get("/details/:result_id", authMiddleware, adminMiddleware, getResultForAdmin);
router.delete("/reset/:result_id", authMiddleware, adminMiddleware, resetAttempt);

module.exports = router;
