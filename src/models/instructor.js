const mongoose = require("mongoose");
const slugify = require("slugify");

const instructorSchema = new mongoose.Schema(
  {
    // Basic Info
    m_instructor_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    m_instructor_slug: {
      type: String,
      unique: true,
    },

    m_instructor_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },

    m_instructor_phone: {
      type: String,
      trim: true,
    },

    // Profile
    m_instructor_profile: {
      type: String, // image path
      default: null,
    },

    m_linkedin_profile: {
      type: String,
      default: null,
    },

    m_instructor_bio: {
      type: String,
      default: null,
    },

    // Job title shown on the course detail page's instructor card (e.g.
    // "Senior Data Scientist at Google", "Lead AI Instructor") - previously
    // that card always showed a literal hardcoded "Mentor" for every
    // instructor since no field existed for this.
    m_instructor_designation: {
      type: String,
      default: null,
      trim: true,
    },

    m_instructor_experience: {
      type: String, // "5 years", "3+ years"
      default: null,
    },

    m_instructor_skills: {
      type: [String], // ["React", "Node", "Java"]
      default: [],
    },

    // Status
    m_instructor_status: {
      type: Number,
      enum: [0, 1], // 0 = Inactive, 1 = Active
      default: 1,
    },

    // Order (for sorting)
    m_instructor_order: {
      type: Number,
      default: null,
    },

    // Stats (future use)
    m_instructor_total_courses: {
      type: Number,
      default: 0,
    },

    m_instructor_rating: {
      type: Number,
      default: 0,
    },

    m_instructor_reviews: {
      type: Number,
      default: 0,
    },

    // Modified
    m_instructor_modified: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt auto
  },
);

// ===============================
// AUTO SLUG GENERATE
// ===============================
instructorSchema.pre("save", function (next) {
  if (this.m_instructor_name && !this.m_instructor_slug) {
    this.m_instructor_slug = slugify(this.m_instructor_name, {
      lower: true,
      strict: true,
    });
  }
  // next();
});

module.exports = mongoose.model("instructor", instructorSchema);
