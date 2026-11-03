const mongoose = require("mongoose");

const liveClassSchema = new mongoose.Schema(
  {
    // class title
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // class date
    class_date: {
      type: Date,
      default: null,
    },

    // duration in minutes
    duration: {
      type: Number,
      default: null,
    },

    // start time
    start_time: {
      type: String,
      default: "",
    },

    // google meet link
    meeting_link: {
      type: String,
      default: "",
      trim: true,
    },

    // batch
    batch_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "batch",
      default: null,
    },

    // when the last reminder email went out (stops an accidental double send)
    reminder_sent_at: {
      type: Date,
      default: null,
    },

    // teacher
    teacher_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "our_teams",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

module.exports = mongoose.model("live_class", liveClassSchema);
