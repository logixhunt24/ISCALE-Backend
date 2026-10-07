const mongoose = require("mongoose");

// A course is organised Module -> Subject -> Topic. Modules are the top
// level (the tab bar on the course page); subjects point at their module
// via subject.m_subject_module, which stays optional so subjects created
// before modules existed keep working.
const moduleSchema = new mongoose.Schema(
  {
    m_module_course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      required: true,
    },
    m_module_title: {
      type: String,
      required: true,
      trim: true,
    },
    m_module_desc: {
      type: String,
      trim: true,
      default: "",
    },
    m_module_status: {
      type: Number,
      enum: [0, 1], // 0=inactive, 1=active
      default: 1,
    },
    m_module_seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("course_module", moduleSchema);
