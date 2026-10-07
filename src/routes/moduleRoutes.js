const express = require("express");
const router = express.Router();

const {
  addModule,
  updateModule,
  deleteModule,
  getModulesByCourse,
  getModuleDropdownByCourse,
  getCourseContent,
} = require("../controllers/moduleController");

const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");

// ADMIN
router.post("/add-module", authMiddleware, adminMiddleware, addModule);
router.put("/update-module/:id", authMiddleware, adminMiddleware, updateModule);
router.delete("/delete-module/:id", authMiddleware, adminMiddleware, deleteModule);
router.get("/get-modules/:courseId", authMiddleware, adminMiddleware, getModulesByCourse);
router.get("/module-dropdown", authMiddleware, adminMiddleware, getModuleDropdownByCourse);

// PUBLIC - nested Module -> Subject -> Topic tree for the course page
router.get("/public-course-content/:courseId", getCourseContent);

module.exports = router;
