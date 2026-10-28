const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");
const {
  listAppReviews,
  publishAppReview,
  unpublishAppReview,
  deleteAppReview,
} = require("../controllers/courseReviewController");

router.get("/list", authMiddleware, adminMiddleware, listAppReviews);
router.post("/publish/:id", authMiddleware, adminMiddleware, publishAppReview);
router.post("/unpublish/:id", authMiddleware, adminMiddleware, unpublishAppReview);
router.delete("/delete/:id", authMiddleware, adminMiddleware, deleteAppReview);

module.exports = router;
