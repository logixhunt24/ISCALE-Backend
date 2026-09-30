const express = require("express");
const router = express.Router();



const courseRoutes = require("../routes/courseRoutes");
const categoryRoutes = require("../routes/categoryRoutes");
const toolsRoutes = require("../routes/toolsRoutes");
const compRequirementRoutes = require("../routes/compRequirementRoutes");
const dashboardRoutes = require("../routes/dashboardRoutes");
const eventRoutes = require("../routes/eventRoutes");
const successStoryRoutes = require("../routes/successStoryRoutes");
const updateProfileRoutes = require("../routes/updateProfileRoutes");
const userWishlistRoutes = require("../routes/userWishlistRoutes");
const enrolledCoursesRoutes = require("../routes/enrolledCoursesRoutes");
const trainingRoutes = require("../routes/trainingRoutes");
const profileRoutes = require("../routes/profileRoutes");
const newsRoutes = require("../routes/newsRoutes");
const searchRoutes = require("../routes/searchRoutes");
const batchRoutes = require("../routes/batchRoutes");
const appMobileRoutes = require("../routes/appMobileRoutes");



router.use("/course", courseRoutes);
router.use("/category", categoryRoutes);
router.use("/tools", toolsRoutes);
router.use("/jobs", compRequirementRoutes);
router.use("/user/dashboard", dashboardRoutes);
router.use("/events", eventRoutes);
router.use("/ss", successStoryRoutes);
router.use("/profile", updateProfileRoutes);
router.use("/wishlist", userWishlistRoutes);
router.use("/enrolled_courses", enrolledCoursesRoutes);
router.use("/training_highlightes", trainingRoutes);
router.use("/profile", profileRoutes);
router.use("/news", newsRoutes);
router.use("/search", searchRoutes);
router.use("/batch", batchRoutes);

// Phase 4 mobile routes (banner, webinar, coupon, offers, progress, video, test-series, reviews)
router.use("/", appMobileRoutes);






module.exports = router;