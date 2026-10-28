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

    // null = a site-wide testimonial shown on every course; otherwise only on that course
    course_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      default: null,
      index: true,
    },

    // set when the admin published a mobile-app review (course_review) to the website
    source_review_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course_review",
      default: null,
      index: true,
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