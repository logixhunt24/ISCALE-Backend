const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { userMiddleware } = require("../middlewares/userMiddleware");
const {
  getQuizInfo,
  startQuiz,
  submitQuiz,
  getMyResults,
  getResultDetails,
} = require("../controllers/quizAttemptController");

router.get("/results", authMiddleware, userMiddleware, getMyResults);
router.get("/result/:result_id", authMiddleware, userMiddleware, getResultDetails);

router.get("/:quiz_id/info", authMiddleware, userMiddleware, getQuizInfo);
router.post("/:quiz_id/start", authMiddleware, userMiddleware, startQuiz);
router.post("/:quiz_id/submit", authMiddleware, userMiddleware, submitQuiz);

module.exports = router;
