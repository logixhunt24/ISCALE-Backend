const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");
const {
  getEnrolledPremiumCourses,
  getEnrolledFreeCourses,
  getEnrolledCourseFullDetails,
  getCourseAccessDetails,
  appGetMyCourses,
  appGetEnrollmentStatus,
  appGetCertificateStatus,
  appRequestCertificate,
  appVerifyCertificate,
} = require("../controllers/enrolledCoursesController");

const {
  appGetUserCourseSubjectTopic,
} = require("../controllers/appMobileController");

router.get(
  "/free-courses",
  authMiddleware,
  userMiddleware,
  getEnrolledFreeCourses,
);

router.get(
  "/premium-courses",
  authMiddleware,
  userMiddleware,
  getEnrolledPremiumCourses,
);

router.get(
  "/course-full-details/:course_id",
  authMiddleware,
  userMiddleware,
  getEnrolledCourseFullDetails,
);

// Mobile Apis=============================================================================================================================

router.get("/user/courses", authMiddleware, userMiddleware, appGetMyCourses);

router.post(
  "/check/enrolled/status",
  authMiddleware,
  userMiddleware,
  appGetEnrollmentStatus,
);

router.post("/get/certificate",authMiddleware,userMiddleware, appGetCertificateStatus);

router.post("/get_user_course_subject_topic", authMiddleware, userMiddleware, appGetUserCourseSubjectTopic);

// Certificate request & verification (Android stubs — previously missing)
router.post("/request_certificate", authMiddleware, userMiddleware, appRequestCertificate);
router.post("/verify_certificate", appVerifyCertificate);

module.exports = router;
