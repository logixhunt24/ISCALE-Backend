const express = require("express");
const router = express.Router();

const {
  addLiveClass,
  updateLiveClass,
  getAllLiveClasses,
  getSingleLiveClass,
  deleteLiveClass,
  sendReminder,
} = require("../controllers/liveClassController");
const { adminMiddleware } = require("../middlewares/adminMiddleware");
const { authMiddleware } = require("../middlewares/authMiddleware");


router.post("/add",authMiddleware,adminMiddleware, addLiveClass);

router.put("/update/:id", authMiddleware, adminMiddleware, updateLiveClass);

router.get("/all", authMiddleware, adminMiddleware, getAllLiveClasses);

router.get("/single/:id",authMiddleware,adminMiddleware, getSingleLiveClass);

router.delete("/delete/:id", authMiddleware, adminMiddleware, deleteLiveClass);

router.post("/send-reminder/:id", authMiddleware, adminMiddleware, sendReminder);


module.exports = router;