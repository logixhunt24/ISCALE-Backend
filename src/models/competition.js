const mongoose = require("mongoose");

const competitionSchema = new mongoose.Schema(
  {
    m_competition_title: { type: String, required: true, trim: true },

    // organising company / sponsor (free text)
    m_competition_company: { type: String, default: "", trim: true },

    m_competition_des: { type: String, default: "", trim: true },

    m_competition_image: { type: String, default: null },

    m_competition_started: { type: Date, default: null },
    m_competition_ended: { type: Date, default: null },

    m_competition_priority: { type: Number, default: 0 },

    // 1 = Active, 0 = Inactive
    m_competition_status: { type: Number, enum: [0, 1], default: 1 },

    // tests (quizzes) that belong to this competition
    m_competition_quizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: "quizs" }],
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("competition", competitionSchema);
