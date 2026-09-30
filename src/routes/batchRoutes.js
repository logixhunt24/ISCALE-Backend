const express = require("express");

const router = express.Router();

const {
  addBatch,
  updateBatch,
  getAllBatches,
  getSingleBatch,
  deleteBatch,
  getBatchesDropdown,
  appGetRunningBatches
} = require("../controllers/batchController");

const {
  appGetBatchLiveClasses,
  appEnrollBatch,
} = require("../controllers/appMobileController");

const { authMiddleware } = require("../middlewares/authMiddleware");

const { adminMiddleware } = require("../middlewares/adminMiddleware");

const { batchUpload } = require("../middlewares/uploadMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");

// ADD
router.post("/add", authMiddleware, adminMiddleware, batchUpload, addBatch);

// UPDATE
router.put(
  "/update/:id",
  authMiddleware,
  adminMiddleware,
  batchUpload,
  updateBatch,
);

// GET ALL
router.get("/all", authMiddleware, adminMiddleware, getAllBatches);

// GET SINGLE
router.get("/get/:id", authMiddleware, adminMiddleware, getSingleBatch);

// DELETE
router.delete("/delete/:id", authMiddleware, adminMiddleware, deleteBatch);

router.get("/dropdown", authMiddleware, adminMiddleware, getBatchesDropdown);


// Mobile Apis=============================================================================================================================

router.get("/get_batch",authMiddleware,userMiddleware,appGetRunningBatches);

router.post("/get_batch_live_class", authMiddleware, userMiddleware, appGetBatchLiveClasses);
router.post("/enroll_batch", authMiddleware, userMiddleware, appEnrollBatch);

module.exports = router;
