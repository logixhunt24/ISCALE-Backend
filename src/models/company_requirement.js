const mongoose = require("mongoose");
const slugify = require("slugify");
const crypto = require("crypto");

const jobSchema = new mongoose.Schema({
  job_title: { type: String, required: true, trim: true },

  company_name: { type: String, required: true, trim: true },

  company_logo: { type: String, default: null, trim: true },

  last_date_to_apply: { type: Date, default: null },

  // MULTIPLE LOCATIONS
  job_locations: [
    {
      type: String,
    },
  ],

  // SALARY RANGE
  salary: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
  },

  // per month / per annum — "per_month"/"per_annum" are legacy values that
  // predate PM/PA and still exist on older documents; kept valid so editing
  // an old job doesn't fail validation just for leaving this field untouched.
  salary_type: {
    type: String,
    enum: ["PM", "PA", "per_month", "per_annum"],
    default: "PM",
  },

  // EXPERIENCE (Flexible)
  experience: {
    type: String,
    default: null,
    trim: true,
  },

  job_description: { type: String, default: null, trim: true },

  application_link: { type: String, default: null, trim: true },

  // SOCIAL LINKS (FLEXIBLE)
  company_social_links: {
    linkedin: { type: String, default: null, trim: true },
    website: { type: String, default: null, trim: true },
    twitter: { type: String, default: null, trim: true },
    instagram: { type: String, default: null, trim: true },
  },

  slug: {
    type: String,
    unique: true,
    index: true,
  },

  status: {
    type: Number,
    enum: [0, 1, 2], //0-pending 1-active 2-expired
    default: 1,
  },

  // RECRUITER DETAILS
  recruiter_mobile_no: {
    type: String,
    default: null,
    trim: true,
  },

  recruiter_whatsapp_no: {
    type: String,
    default: null,
    trim: true,
  },

  recruiter_date: {
    type: Date,
    default: null,
  },

  recruiter_expire_date: {
    type: Date,
    default: null,
  },

  order: {
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

jobSchema.pre("save", function (next) {
  if (this.job_title) {
    const random = crypto.randomBytes(3).toString("hex");

    this.slug =
      slugify(this.job_title, {
        lower: true,
        strict: true,
      }) +
      "-" +
      random;
  }

  // next();
});

module.exports = mongoose.model("company_requirement", jobSchema);
