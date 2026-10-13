const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");
const {
  downloadCourseInvoice,
  downloadSignedInvoice,
} = require("../controllers/invoiceController");

router.get("/course/:course_id", authMiddleware, userMiddleware, downloadCourseInvoice);
router.get("/signed/:enrollment_id", downloadSignedInvoice);

module.exports = router;
