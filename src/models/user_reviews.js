const mongoose = require("mongoose");

const userReviewSchema = new mongoose.Schema(
  {
    user_name: {
      type: String,
      required: true,
      trim: true,
      default: null,
    },

    user_designation: {
      type: String,
      default: null,
      trim: true,
    },

    user_image: {
      type: String,
      default: null,
    },

    user_review: {
      type: String,
      default: null,
      trim: true,
    },

    // The public course-details page always defaulted every review to a
    // flat 5-star rating since this field never existed - meaning the
    // average rating shown on every course was fake, always exactly 5.0
    // regardless of what admins actually thought of a given testimonial.
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("user_reviews", userReviewSchema);


// using 