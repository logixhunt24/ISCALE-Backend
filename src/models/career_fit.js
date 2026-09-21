const mongoose = require("mongoose");

// "Career Fit" goals shown in the homepage's "Explore Your Career Fit"
// section (CareerHubSection.jsx) — a curated, admin-managed set of career
// tracks (e.g. "AI/ML Engineer"), independent of the real course category
// taxonomy. Courses shown under a goal are either explicitly picked
// (m_cf_courses) or, if none are picked, matched by keyword against each
// course's title/category (m_cf_keywords) — the original mechanism from
// when this list was hardcoded in the frontend.
const careerFitSchema = new mongoose.Schema({
  m_cf_title: {
    type: String,
    required: true,
    trim: true,
  },

  m_cf_desc: {
    type: String,
    default: "",
    trim: true,
  },

  m_cf_icon: {
    type: String,
    default: "",
  },

  m_cf_icon_public_id: {
    type: String,
    default: "",
  },

  // Comma-separated; matched (case-insensitive substring) against each
  // course's title + category to decide which courses show under this goal.
  // Only used as a fallback when m_cf_courses below is empty - explicit
  // course selection always wins once an admin has made one.
  m_cf_keywords: {
    type: String,
    default: "",
    trim: true,
  },

  // Explicit, admin-picked courses to show under this goal, in the order
  // selected. Takes priority over m_cf_keywords when non-empty.
  m_cf_courses: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "course" }],
    default: [],
  },

  m_cf_status: {
    type: Number,
    enum: [0, 1], // 0-Inactive, 1-Active
    default: 1,
  },

  m_cf_order: {
    type: Number,
    default: 0,
  },

  created_at: {
    type: Date,
    default: Date.now,
  },

  updated_at: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model("career_fit", careerFitSchema);
