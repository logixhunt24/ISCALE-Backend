const express = require("express");

const router = express.Router();

const {
  addCourseToWishlist,
  removeCourseFromWishlist,
  getMyCourseWishlist,
  getAllCourseWishlistsAdmin,
  getSingleCourseWishlist,
  deleteCourseWishlist,

  addTestPackageToWishlist,
  getMyTestPackageWishlist,
  getAllTestPackageWishlistsAdmin,
  getSingleTestPackageWishlist,
  deleteTestPackageWishlist,

  addNotesToWishlist,
  getMyNotesWishlist,
  getAllNotesWishlistsAdmin,
  getSingleNotesWishlist,
  deleteNotesWishlist,

  appAddToWishlist,
  appGetWishlist,
} = require("../controllers/userWishlistController");

const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");

// USER

// ADD TO WISHLIST
router.post("/course/add", authMiddleware, userMiddleware, addCourseToWishlist);

// GET MY WISHLIST
router.get("/course/my", authMiddleware, userMiddleware, getMyCourseWishlist);

router.delete("/course/remove/:courseId", authMiddleware, userMiddleware, removeCourseFromWishlist);

// ADMIN

// GET ALL
router.get(
  "/course/admin/all",
  authMiddleware,
  adminMiddleware,
  getAllCourseWishlistsAdmin,
);

// GET SINGLE
router.get(
  "/course/admin/:id",
  authMiddleware,
  adminMiddleware,
  getSingleCourseWishlist,
);

// DELETE
router.delete(
  "/course/admin/:id",
  authMiddleware,
  adminMiddleware,
  deleteCourseWishlist,
);

// USER

// ADD
router.post(
  "/test-pack/add",
  authMiddleware,
  userMiddleware,
  addTestPackageToWishlist,
);

// MY WISHLIST
router.get(
  "/test-pack/my",
  authMiddleware,
  userMiddleware,
  getMyTestPackageWishlist,
);

// ADMIN

// GET ALL
router.get(
  "/test-pack/admin/all",
  authMiddleware,
  adminMiddleware,
  getAllTestPackageWishlistsAdmin,
);

// GET SINGLE
router.get(
  "/test-pack/admin/:id",
  authMiddleware,
  adminMiddleware,
  getSingleTestPackageWishlist,
);

// DELETE
router.delete(
  "/test-pack/admin/:id",
  authMiddleware,
  adminMiddleware,
  deleteTestPackageWishlist,
);

// USER

router.post("/notes/add", authMiddleware, userMiddleware, addNotesToWishlist);

router.get("/notes/my", authMiddleware, userMiddleware, getMyNotesWishlist);

// ADMIN

router.get(
  "/notes/admin/all",
  authMiddleware,
  adminMiddleware,
  getAllNotesWishlistsAdmin,
);

router.get(
  "/notes/admin/:id",
  authMiddleware,
  adminMiddleware,
  getSingleNotesWishlist,
);

router.delete(
  "/notes/admin/:id",
  authMiddleware,
  adminMiddleware,
  deleteNotesWishlist,
);

// Mobile Apis=============================================================================================================================

router.post(
  "/insert/wishlist",
  authMiddleware,
  userMiddleware,
  appAddToWishlist,
);

router.get("/user/wishlist", authMiddleware, userMiddleware, appGetWishlist);

module.exports = router;
