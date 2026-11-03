const express = require("express");
const router = express.Router();

const {
  addSubject,
  getAllSubjects,
  getSubjectsByCourse,
  getPublicSubjectsByCourse,
  updateSubject,
  deleteSubject,
  getSubjectDropdownByCourse,
  getAllSubjectsDropdown
} = require("../controllers/subjectController");

const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");
const { subjectUpload } = require("../middlewares/uploadMiddleware");



// ADD
router.post(
  "/add-subject",
  authMiddleware,
  adminMiddleware,
  subjectUpload,
  addSubject,
);

// GET ALL
router.get(
  "/get-all-subjects",
  authMiddleware,
  adminMiddleware,
  getAllSubjects,
);

// GET BY COURSE
router.get(
  "/get-subjects/:courseId",
  authMiddleware,
  adminMiddleware,
  getSubjectsByCourse,
);

// UPDATE
router.put(
  "/update-subject/:id",
  authMiddleware,
  adminMiddleware,
  subjectUpload,
  updateSubject,
);

// DELETE
router.delete(
  "/delete-subject/:id",
  authMiddleware,
  adminMiddleware,
  deleteSubject,
);

// SUBJECT DROPDOWN (COURSE BASED)
router.get(
  "/subject-dropdown",
  authMiddleware,
  adminMiddleware,
  getSubjectDropdownByCourse
);



router.get(
  "/all/dropdown",
  authMiddleware,
  adminMiddleware,
  getAllSubjectsDropdown
);













router.get(
  "/public-get-subjects/:courseId",
  getPublicSubjectsByCourse,
);

module.exports = router;
