const mongoose = require("mongoose");

const quizResultSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    quiz_id: { type: String, required: true },
    package_id: { type: String, default: null },
    course_id: { type: String, default: null },
    total_questions: { type: Number, default: 0 },
    attempted: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    marks_obtained: { type: Number, default: 0 },
    total_marks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    time_taken: { type: String, default: null },
    answers: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("quiz_result", quizResultSchema);
