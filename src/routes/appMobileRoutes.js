const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");

const {
  appGetBanners,
  appGetWebinarList,
  appGetUserWebinars,
  appUpdateFcm,
  appGetNotifications,
  appGetCoupons,
  appValidateCoupon,
  appGetOffers,
  appGetVideoFeed,
  appGetVideoDetails,
  appGetUserCourseCount,
  appGetInvoice,
  appGetTestPackages,
  appGetQuizList,
  appGetQuestions,
  appSaveTestResult,
  appGetTestResultDetails,
  appGetTestResults,
  appInsertCourseReview,
  appInsertWatchlist,
  appGetUserCourseProgress,
} = require("../controllers/appMobileController");

// ── Banners ──────────────────────────────────────────────────────────────────
router.get("/banner/get_banners", appGetBanners);

// ── Webinars ─────────────────────────────────────────────────────────────────
router.get("/webinar/get_webinar", appGetWebinarList);
router.get("/webinar/user_webinars", authMiddleware, userMiddleware, appGetUserWebinars);

// ── FCM / Notifications ───────────────────────────────────────────────────────
router.post("/profile/update_fcm", authMiddleware, userMiddleware, appUpdateFcm);
router.get("/profile/get_user_notification", authMiddleware, userMiddleware, appGetNotifications);

// ── Coupons ───────────────────────────────────────────────────────────────────
router.post("/coupon/get_coupons", appGetCoupons);
router.post("/coupon/coupon_validation", appValidateCoupon);

// ── Offers ────────────────────────────────────────────────────────────────────
router.get("/offers/offers_list", appGetOffers);

// ── Lecture progress ──────────────────────────────────────────────────────────
router.post("/progress/insert_watchlist", authMiddleware, userMiddleware, appInsertWatchlist);
router.post("/progress/get_user_course_progress", authMiddleware, userMiddleware, appGetUserCourseProgress);

// ── Reviews ───────────────────────────────────────────────────────────────────
router.post("/reviews/insert_students_reviews", authMiddleware, userMiddleware, appInsertCourseReview);

// ── Video feed ────────────────────────────────────────────────────────────────
router.get("/video/all_video", appGetVideoFeed);
router.post("/video/get_video_details", authMiddleware, userMiddleware, appGetVideoDetails);

// ── User stats ────────────────────────────────────────────────────────────────
router.get("/enrolled_courses/user_course_count", authMiddleware, userMiddleware, appGetUserCourseCount);
router.get("/enrolled_courses/get_invoice_link", authMiddleware, userMiddleware, appGetInvoice);

// ── Test series ───────────────────────────────────────────────────────────────
router.post("/test-series/test_series_packages", authMiddleware, userMiddleware, appGetTestPackages);
router.post("/test-series/test_series_quiz", authMiddleware, userMiddleware, appGetQuizList);
router.post("/test-series/test_series_question", authMiddleware, userMiddleware, appGetQuestions);
router.post("/test-series/save_result", authMiddleware, userMiddleware, appSaveTestResult);
router.post("/test-series/get_testseries_result_details", authMiddleware, userMiddleware, appGetTestResultDetails);
router.get("/test-series/get_testseries_all_result", authMiddleware, userMiddleware, appGetTestResults);

module.exports = router;
