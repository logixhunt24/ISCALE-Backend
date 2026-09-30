const express = require("express");
const router = express.Router();

const upload = require("../middlewares/uploadMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { courseUpload } = require("../middlewares/uploadMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");

const {
  addCourse,
  getAllCourses,
  getCategoryDropdown,
  updateCourse,
  deleteCourse,
  getPopularCourses,
  getRecommendedCourses,
  getCourseById,
  getCourseDropdown,
  changeCourseStatus,
  toggleLmsStatus,
  getLmsCourses,
  appGetCourseTeamList,
  appGetCourseDetailsById,
  appGetTopTrendingCourses
} = require("../controllers/courseController");

const {
  appGetCourseFaq,
  appGetCourseSubjectTopic,
  appGetCourseFeatures,
} = require("../controllers/appMobileController");

router.post(
  "/add-course",
  authMiddleware,
  adminMiddleware,
  courseUpload,
  addCourse,
);
router.get("/all-courses", authMiddleware, adminMiddleware, getAllCourses);
router.get(
  "/categories-dropdown",
  authMiddleware,
  adminMiddleware,
  getCategoryDropdown,
);
router.put(
  "/update-course/:id",
  authMiddleware,
  adminMiddleware,
  courseUpload,
  updateCourse,
);
router.delete(
  "/delete-course/:id",
  authMiddleware,
  adminMiddleware,
  deleteCourse,
);
router.get(
  "/popular-courses",
  authMiddleware,
  adminMiddleware,
  getPopularCourses,
);
router.get(
  "/recommended-courses",
  authMiddleware,
  adminMiddleware,
  getRecommendedCourses,
);
router.get("/course/:id", authMiddleware, adminMiddleware, getCourseById);
router.get("/dropdown", authMiddleware, adminMiddleware, getCourseDropdown);
router.patch(
  "/status/:id",
  authMiddleware,
  adminMiddleware,
  changeCourseStatus,
);
router.patch(
  "/lms-status/:id",
  authMiddleware,
  adminMiddleware,
  toggleLmsStatus,
);
router.get(
  "/lms-courses",
  authMiddleware,
  adminMiddleware,
  getLmsCourses,
);

router.get("/public-all-courses", getAllCourses);
router.get("/public-course/:id", getCourseById);

// Mobile App Routes ==================================================================================

router.post(
  "/course_team_list",
  authMiddleware,
  userMiddleware,
  appGetCourseTeamList,
);

router.post("/course_details", authMiddleware,userMiddleware, appGetCourseDetailsById);

router.get("/trending_course", authMiddleware,userMiddleware,appGetTopTrendingCourses);

router.post("/course_faq", appGetCourseFaq);
router.post("/get_course_subject_topic", appGetCourseSubjectTopic);
router.post("/get_course_features", appGetCourseFeatures);

module.exports = router;
