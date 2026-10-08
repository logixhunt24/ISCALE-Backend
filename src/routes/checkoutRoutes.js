const express = require("express");
const router = express.Router();

const {
  getSummary,
  createOrder,
  verifyPayment,
} = require("../controllers/checkoutController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");

router.get("/summary/:courseId", authMiddleware, userMiddleware, getSummary);
router.post("/create-order", authMiddleware, userMiddleware, createOrder);
router.post("/verify", authMiddleware, userMiddleware, verifyPayment);

module.exports = router;
