const express = require("express");
const router = express.Router();

const controller = require("../controllers/primeHiringDestinationController");
const { primeHiringDestinationUpload } = require("../middlewares/uploadMiddleware");

const { adminMiddleware } = require("../middlewares/adminMiddleware");
const { authMiddleware } = require("../middlewares/authMiddleware");

// ===============================
// ADMIN ROUTES
// ===============================

router.post(
  "/add",
  authMiddleware,
  adminMiddleware,
  primeHiringDestinationUpload,
  controller.addDestination,
);

router.put(
  "/update/:id",
  authMiddleware,
  adminMiddleware,
  primeHiringDestinationUpload,
  controller.updateDestination,
);

router.delete(
  "/delete/:id",
  authMiddleware,
  adminMiddleware,
  controller.deleteDestination,
);

router.get(
  "/get-all",
  authMiddleware,
  adminMiddleware,
  controller.getAllDestinations,
);

router.patch(
  "/status/:id",
  authMiddleware,
  adminMiddleware,
  controller.changeDestinationStatus,
);

// ===============================
// PUBLIC ROUTES
// ===============================

router.get("/public-get-all", controller.publicGetDestinations);

module.exports = router;
