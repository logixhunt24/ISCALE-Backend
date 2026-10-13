const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");

const {
  enrollEvent,
  getMyEnrolledEvents,
} = require("../controllers/enrolledEventController");
const { getEventEnrollmentStatus } = require("../controllers/publicEventController");

// ENROLL EVENT
router.post(
  "/enroll-event",
  authMiddleware,
  enrollEvent
);

// MY ENROLLED EVENTS
router.get(
  "/my-enrolled-events",
  authMiddleware,
  getMyEnrolledEvents
);

// ENROLLMENT STATUS (+ meeting link for enrolled students)
router.get(
  "/status/:event_id",
  authMiddleware,
  getEventEnrollmentStatus
);

module.exports = router;