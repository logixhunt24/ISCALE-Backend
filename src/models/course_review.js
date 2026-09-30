const mongoose = require("mongoose");

const courseReviewSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true },
    course_id: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    remark: { type: String, default: null },
    review_for: { type: String, default: null },
    status: { type: Number, enum: [0, 1], default: 1 },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("course_review", courseReviewSchema);
