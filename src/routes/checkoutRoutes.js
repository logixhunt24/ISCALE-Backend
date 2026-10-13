const express = require("express");
const router = express.Router();

const {
  getSummary,
  createOrder,
  verifyPayment,
  getOrderStatus,
  razorpayWebhook,
} = require("../controllers/checkoutController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");

router.get("/summary/:courseId", authMiddleware, userMiddleware, getSummary);
router.post("/create-order", authMiddleware, userMiddleware, createOrder);
router.post("/verify", authMiddleware, userMiddleware, verifyPayment);
router.get("/order-status/:razorpayOrderId", authMiddleware, userMiddleware, getOrderStatus);

// Called by Razorpay itself (signature-checked inside, no login)
router.post("/webhook", razorpayWebhook);

module.exports = router;
