const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");
const { competitionUpload } = require("../middlewares/uploadMiddleware");
const {
  addCompetition,
  getAllCompetitions,
  getSingleCompetition,
  updateCompetition,
  deleteCompetition,
  toggleCompetitionStatus,
  addCompetitionQuiz,
  removeCompetitionQuiz,
} = require("../controllers/competitionController");

router.post("/add", authMiddleware, adminMiddleware, competitionUpload, addCompetition);
router.get("/all", authMiddleware, adminMiddleware, getAllCompetitions);
router.get("/:id", authMiddleware, adminMiddleware, getSingleCompetition);
router.put("/update/:id", authMiddleware, adminMiddleware, competitionUpload, updateCompetition);
router.delete("/delete/:id", authMiddleware, adminMiddleware, deleteCompetition);
router.patch("/status/:id", authMiddleware, adminMiddleware, toggleCompetitionStatus);

router.post("/:id/quizzes", authMiddleware, adminMiddleware, addCompetitionQuiz);
router.delete("/:id/quizzes/:quiz_id", authMiddleware, adminMiddleware, removeCompetitionQuiz);

module.exports = router;
