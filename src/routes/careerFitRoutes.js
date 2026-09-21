const express = require("express");
const router = express.Router();

const careerFitController = require("../controllers/careerFitController");
const { careerFitUpload } = require("../middlewares/uploadMiddleware");

const { adminMiddleware } = require("../middlewares/adminMiddleware");
const { authMiddleware } = require("../middlewares/authMiddleware");

// ===============================
// ADMIN ROUTES
// ===============================

router.post(
  "/add",
  authMiddleware,
  adminMiddleware,
  careerFitUpload,
  careerFitController.addCareerFit,
);

router.put(
  "/update/:id",
  authMiddleware,
  adminMiddleware,
  careerFitUpload,
  careerFitController.updateCareerFit,
);

router.delete(
  "/delete/:id",
  authMiddleware,
  adminMiddleware,
  careerFitController.deleteCareerFit,
);

router.get(
  "/get-all",
  authMiddleware,
  adminMiddleware,
  careerFitController.getAllCareerFits,
);

router.patch(
  "/status/:id",
  authMiddleware,
  adminMiddleware,
  careerFitController.changeCareerFitStatus,
);

// ===============================
// PUBLIC ROUTES
// ===============================

router.get("/public-get-all", careerFitController.publicGetCareerFits);

module.exports = router;
