const mongoose = require("mongoose");

// Backs the homepage's "Who We Are" section (pill + heading + paragraph,
// plus the row of 3 press/media highlight cards). There is only ever one
// document - the controller lazily creates it on first read instead of
// requiring a separate seed step.
const whoWeAreSchema = new mongoose.Schema(
  {
    m_pill_text: { type: String, default: "Who We Are", trim: true },
    m_heading: {
      type: String,
      default: "Know About iScale Learning",
      trim: true,
    },
    m_description: {
      type: String,
      default:
        "A community-driven upskilling platform built to take learners from fundamentals to job-ready skills — live mentorship, hands-on projects, and a direct path into the careers this industry is actually hiring for.",
      trim: true,
    },

    // Exactly 3 highlight/press cards shown below the description -
    // positional (index 0/1/2), not a free list, since the homepage layout
    // is a fixed 3-card row (mirrors m_course_fee_features' positional
    // pattern on the course model).
    m_cards: {
      type: [
        {
          _id: false,
          title: { type: String, trim: true, default: "" },
          image: { type: String, default: "" },
          image_public_id: { type: String, default: "" },
          link: { type: String, trim: true, default: "" },
        },
      ],
      default: () => [{}, {}, {}],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("who_we_are", whoWeAreSchema);
