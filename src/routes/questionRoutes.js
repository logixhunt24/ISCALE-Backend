const express = require("express");
const router = express.Router();
const {
  addQuestion,
  getQuestionsByQuiz,
  updateQuestion,
  deleteQuestion,
  bulkAddQuestions,
} = require("../controllers/questionController"); // Path aache se check kar lein
const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");

// IMPORTANT: Add `app.use(express.json());` in your main server file (e.g., app.js or server.js)

router.post("/add-question", authMiddleware, adminMiddleware, addQuestion);
router.post("/bulk-add", authMiddleware, adminMiddleware, bulkAddQuestions);
router.get(
  "/questions-by-quiz/:quizId",
  authMiddleware,
  adminMiddleware,
  getQuestionsByQuiz,
);
router.put(
  "/update-question/:id",
  authMiddleware,
  adminMiddleware,
  updateQuestion,
);
router.delete(
  "/delete-question/:id",
  authMiddleware,
  adminMiddleware,
  deleteQuestion,
);

module.exports = router;
