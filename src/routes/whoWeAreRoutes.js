const express = require("express");
const router = express.Router();

const {
  getWhoWeAre,
  updateWhoWeAre,
} = require("../controllers/whoWeAreController");

const { whoWeAreUpload } = require("../middlewares/uploadMiddleware");

const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");

router.put(
  "/update",
  authMiddleware,
  adminMiddleware,
  whoWeAreUpload,
  updateWhoWeAre,
);

// No auth required - this router is mounted at both /myadmin/who-we-are
// (admin panel) and /api/who-we-are (public homepage), same pattern as
// brandVideoRoutes.
router.get("/", getWhoWeAre);

module.exports = router;
