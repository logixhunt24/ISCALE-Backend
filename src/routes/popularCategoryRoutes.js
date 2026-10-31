const express = require("express");
const router = express.Router();

const controller = require("../controllers/popularCategoryController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");

// PUBLIC
router.get("/public", controller.publicGetAll);

// ADMIN
router.get("/", authMiddleware, adminMiddleware, controller.getAll);
router.post("/", authMiddleware, adminMiddleware, controller.create);
router.put("/all", authMiddleware, adminMiddleware, controller.saveAll);
router.put("/reorder", authMiddleware, adminMiddleware, controller.reorder);
router.put("/:id", authMiddleware, adminMiddleware, controller.update);
router.delete("/:id", authMiddleware, adminMiddleware, controller.remove);

module.exports = router;
