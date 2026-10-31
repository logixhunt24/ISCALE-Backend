const mongoose = require("mongoose");

// Homepage "Most Popular Courses" tabs. Each tab is a category with its own
// hand-picked, hand-ordered courses (array order = display order).
const popularCategorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    status: { type: Number, enum: [0, 1], default: 1 }, // 1 = Active
    // The single 'All Programs' list (not a tab). Its courses are the exact
    // courses, in order, shown under All Programs once it has been saved.
    isAll: { type: Boolean, default: false },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "course" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("popular_category", popularCategorySchema);
