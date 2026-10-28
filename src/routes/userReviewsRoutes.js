const express = require("express");

const router = express.Router();

const {
  addUserReview,
  getAllUserReviews,
  getSingleUserReview,
  changeUserReviewStatus,
  updateUserReview,
  deleteUserReview,
} = require("../controllers/userReviewsController");

const { getCourseReviews } = require("../controllers/courseReviewController");
const { userReviewUpload } = require("../middlewares/uploadMiddleware");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");

router.post("/add",authMiddleware,adminMiddleware, userReviewUpload, addUserReview);


router.get("/all-reviews", getAllUserReviews);

// Reviews the admin chose to show on one course page (falls back to site-wide ones)
router.get("/course/:courseId", getCourseReviews);

router.get("/all",authMiddleware,adminMiddleware, getAllUserReviews);

router.get("/:id",authMiddleware,adminMiddleware, getSingleUserReview);

router.patch("/status/:id",authMiddleware,adminMiddleware, changeUserReviewStatus);

router.put("/update/:id",authMiddleware,adminMiddleware, userReviewUpload, updateUserReview);

router.delete("/delete/:id",authMiddleware,adminMiddleware, deleteUserReview);

module.exports = router;
