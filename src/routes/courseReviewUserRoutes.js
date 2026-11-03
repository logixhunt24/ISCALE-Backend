const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");
const { getMyCourseReview, saveMyCourseReview } = require("../controllers/courseReviewController");

router.get("/my/:courseId", authMiddleware, userMiddleware, getMyCourseReview);
router.post("/my", authMiddleware, userMiddleware, saveMyCourseReview);

module.exports = router;
