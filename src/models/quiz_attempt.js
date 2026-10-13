const mongoose = require("mongoose");

// One in-progress/finished sitting of a quiz by a user. Gives the web quiz a
// server-side clock so the timer survives refreshes and can't be extended
// from the browser.
const quizAttemptSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    quiz_id: { type: String, required: true },
    started_at: { type: Date, required: true },
    expires_at: { type: Date, required: true },
    submitted: { type: Boolean, default: false },
    result_id: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

quizAttemptSchema.index({ user_id: 1, quiz_id: 1 }, { unique: true });

module.exports = mongoose.model("quiz_attempt", quizAttemptSchema);
