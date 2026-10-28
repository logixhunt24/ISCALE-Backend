const express = require("express");
const router = express.Router();
const { adminMiddleware } = require("../middlewares/adminMiddleware");
const { authMiddleware } = require("../middlewares/authMiddleware");

const {
  getCourseRegistrations,
  deleteCourseEnrollment,
  getCoursePurchaseDetails,
  getAllTestPackageEnrollments,
  getSingleTestPackageEnrollment,
  deleteTestPackageEnrollment,
  changeTestPackageAccessStatus,
  getNotesRegistrations,
  deleteNotesEnrollment,
  getAllEventRegistrations,
  getSingleEventRegistration,
  deleteEventRegistration,
  getAllJobApplications,
  getSingleJobApplication,
  deleteJobApplication,
  toggleAppStatus,
  toggleAndroidStatus,
  toggleIosStatus,
  toggleTestSeriesStatus,
  toggleLiveClassStatus,
} = require("../controllers/adminRegistrationsSectionController");
const { downloadInvoiceAdmin, updateInvoiceAmounts } = require("../controllers/invoiceController");

router.get(
  "/course-registrations",
  authMiddleware,
  adminMiddleware,
  getCourseRegistrations,
);

router.delete(
  "/course-registration/:id",
  authMiddleware,
  adminMiddleware,
  deleteCourseEnrollment,
);

router.get(
  "/course-purchase-details/:enrollment_id",
  authMiddleware,
  adminMiddleware,
  getCoursePurchaseDetails,
);

// all enrollments
router.get(
  "/test-package-enrollments",
  authMiddleware,
  adminMiddleware,
  getAllTestPackageEnrollments,
);

// single enrollment details
router.get(
  "/single-test-package/:id",
  authMiddleware,
  adminMiddleware,
  getSingleTestPackageEnrollment,
);

router.delete(
  "/delete-test-package/:id",
  authMiddleware,
  adminMiddleware,
  deleteTestPackageEnrollment,
);

router.patch(
  "/change-access-status/:id",
  authMiddleware,
  adminMiddleware,
  changeTestPackageAccessStatus,
);

router.get(
  "/enrolled-notes",
  authMiddleware,
  adminMiddleware,
  getNotesRegistrations,
);

router.delete(
  "/delete-notes-enrollment/:id",
  authMiddleware,
  adminMiddleware,
  deleteNotesEnrollment,
);

router.get(
  "/all-events",
  authMiddleware,
  adminMiddleware,
  getAllEventRegistrations,
);

router.get(
  "/single-event/:id",
  authMiddleware,
  adminMiddleware,
  getSingleEventRegistration,
);

router.delete(
  "/delete-event/:id",
  authMiddleware,
  adminMiddleware,
  deleteEventRegistration,
);

router.get(
  "/job-applications",
  authMiddleware,
  adminMiddleware,
  getAllJobApplications,
);

router.get(
  "/single-job-application/:id",
  authMiddleware,
  adminMiddleware,
  getSingleJobApplication,
);

router.delete(
  "/delete-job-application/:id",
  authMiddleware,
  adminMiddleware,
  deleteJobApplication,
);

router.patch(
  "/toggle-app-status/:enrollment_id",
  authMiddleware,
  adminMiddleware,
  toggleAppStatus,
);

router.patch(
  "/toggle-android-status/:enrollment_id",
  authMiddleware,
  adminMiddleware,
  toggleAndroidStatus,
);

router.patch(
  "/toggle-ios-status/:enrollment_id",
  authMiddleware,
  adminMiddleware,
  toggleIosStatus,
);

router.patch(
  "/toggle-test-series-status/:enrollment_id",
  authMiddleware,
  adminMiddleware,
  toggleTestSeriesStatus,
);

router.patch(
  "/toggle-live-class-status/:enrollment_id",
  authMiddleware,
  adminMiddleware,
  toggleLiveClassStatus,
);

router.get("/invoice/:enrollment_id", authMiddleware, adminMiddleware, downloadInvoiceAdmin);

router.patch("/update-invoice/:enrollment_id", authMiddleware, adminMiddleware, updateInvoiceAmounts);

module.exports = router;
