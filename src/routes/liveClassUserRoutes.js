const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");
const {
  getCourseBatches,
  getBatchLiveClasses,
} = require("../controllers/liveClassStudentController");

router.get("/course/:course_id/batches", authMiddleware, userMiddleware, getCourseBatches);
router.get("/batch/:batch_id", authMiddleware, userMiddleware, getBatchLiveClasses);

module.exports = router;
