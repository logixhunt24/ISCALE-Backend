const express = require("express");
const router = express.Router();

const jobController = require("../controllers/compRequirementController");
const { jobUpload } = require("../middlewares/uploadMiddleware");
const {
  appInsertJobEnroll,
  appCheckJobEnrolled,
} = require("../controllers/appMobileController");

const { adminMiddleware } = require("../middlewares/adminMiddleware");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");

// ===============================
// ADMIN ROUTES
// ===============================

// Add Job
router.post(
  "/add-jobs",
  authMiddleware,
  adminMiddleware,
  jobUpload,
  jobController.addJob,
);

// Update Job
router.put(
  "/update-job/:id",
  authMiddleware,
  adminMiddleware,
  jobUpload,
  jobController.updateJob,
);

// Delete Job
router.delete(
  "/delete-job/:id",
  authMiddleware,
  adminMiddleware,
  jobController.deleteJob,
);

// Get All Jobs (admin)
router.get(
  "/get-all-jobs",
  authMiddleware,
  adminMiddleware,
  jobController.getAllJobs,
);

// Get Single Job (admin)
router.get(
  "/get-job/:id",
  authMiddleware,
  adminMiddleware,
  jobController.getJobById,
);

router.patch(
  "/status/:id",
  authMiddleware,
  adminMiddleware,
  jobController.changeJobStatus,
);

// ===============================
// USER ROUTES
// ===============================

// Get All Jobs (public)
router.get("/user-get-all-jobs", jobController.getAllJobs);

// Get Single Job (public)
router.get("/user-get-job/:id", jobController.getJobById);

// Apply Job (login required)
router.post(
  "/user-apply-job/:jobId",
  authMiddleware,
  userMiddleware,
  jobController.applyJob,
);

router.get(
  "/job-titles-dropdown",
  authMiddleware,
  adminMiddleware,
  jobController.getAllUniqueJobTitles,
);

// Mobile Apis=============================================================================================================================

router.get(
  "/jobs/list",
  authMiddleware,
  userMiddleware,
  jobController.appGetAllJobs,
);

router.post(
  "/jobs/details",
  authMiddleware,
  userMiddleware,
  jobController.appGetJobDetails,
);

router.post("/insert_job_enrollment", authMiddleware, userMiddleware, appInsertJobEnroll);
router.post("/check_job_enrolled", authMiddleware, userMiddleware, appCheckJobEnrolled);

module.exports = router;
