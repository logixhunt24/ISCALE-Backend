const express = require("express");
const router = express.Router();

const {
  getAllUsers,
  getSingleUser,
  editUser,
  searchUsersForDropdown,
  deleteUser,
  toggleAdminVerified,
  toggleUserStatus,
  toggleLifetimeAccess,
  addUser,
  setLmsStatus,
  resetFaceData,
  getAssignedCourses,
  assignCourses,
  removeCourseAssignment,
} = require("../controllers/appUserController");
const { candidateUpload } = require("../middlewares/uploadMiddleware");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");

router.get("/all", authMiddleware, adminMiddleware, getAllUsers);

router.post("/add", authMiddleware, adminMiddleware, addUser);

router.get("/single/:id", authMiddleware, adminMiddleware, getSingleUser);

// LMS course assignment for a student
router.get(
  "/:id/courses",
  authMiddleware,
  adminMiddleware,
  getAssignedCourses,
);
router.post(
  "/:id/assign-courses",
  authMiddleware,
  adminMiddleware,
  assignCourses,
);
router.delete(
  "/:id/courses/:courseId",
  authMiddleware,
  adminMiddleware,
  removeCourseAssignment,
);

router.put(
  "/edit/:id",
  authMiddleware,
  adminMiddleware,
  candidateUpload,
  editUser,
);

router.get("/search", authMiddleware, adminMiddleware, searchUsersForDropdown);
router.delete("/delete/:id", authMiddleware, adminMiddleware, deleteUser);

// Toggles c_admin_verified - the manual override behind the "Verified"
// badge (isVerified = c_mobile_verified || c_email_verified || c_admin_verified)
router.patch("/toggle-status/:id", authMiddleware, adminMiddleware, toggleUserStatus);

router.patch(
  "/toggle-verified/:id",
  authMiddleware,
  adminMiddleware,
  toggleAdminVerified,
);

// Manual admin override for the iScale mobile app's lifetime-access flag.
router.patch(
  "/toggle-lifetime-access/:id",
  authMiddleware,
  adminMiddleware,
  toggleLifetimeAccess,
);

// Registers/deactivates an account in the LMS module (see setLmsStatus).
router.patch(
  "/lms-status/:id",
  authMiddleware,
  adminMiddleware,
  setLmsStatus,
);

// Clears a student's enrolled face-lock biometric data so they can
// re-register a new face (see resetFaceData).
router.patch(
  "/reset-face/:id",
  authMiddleware,
  adminMiddleware,
  resetFaceData,
);

module.exports = router;
