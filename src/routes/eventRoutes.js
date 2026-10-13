const express = require("express");
const router = express.Router();

const { eventUpload } = require("../middlewares/uploadMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");
const { authMiddleware } = require("../middlewares/authMiddleware");
const {
  addEvent,
  getAllEvents,
  updateEvent,
  deleteEvent,
  getAllEventsDropdown,
  appGetEventDetails,
  appGetAllEvents
} = require("../controllers/eventController");
const { userMiddleware } = require("../middlewares/userMiddleware");
const { getPublicEvents, getPublicEventBySlug } = require("../controllers/publicEventController");

router.post("/add-event",authMiddleware,adminMiddleware, eventUpload, addEvent);

router.get("/get-events",authMiddleware,adminMiddleware, getAllEvents);

router.put("/update-event/:id",authMiddleware,adminMiddleware, eventUpload, updateEvent);

router.delete("/delete-event/:id",authMiddleware,adminMiddleware, deleteEvent);

router.get("/get-events-dropdown",authMiddleware,adminMiddleware, getAllEventsDropdown);





router.get("/public-get-events", getPublicEvents);
router.get("/public-event/:slug", getPublicEventBySlug);


// Mobile Apis=============================================================================================================================

router.get("/all_events", authMiddleware,userMiddleware,appGetAllEvents);

router.get("/all_details", authMiddleware,userMiddleware,appGetEventDetails);


module.exports = router;
