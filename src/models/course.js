const mongoose = require("mongoose");
const slugify = require("slugify");

const courseSchema = new mongoose.Schema(
  {
    m_course_lang: {
      type: Number,
      required: true,
      enum: [1, 2, 3], //1=english, 2=hindi , 3=hinglish 
    },

    m_course_category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
    },

    m_course_cat_slug: {
      type: String,
      maxlength: 200,
    },

    m_course_title: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },

    m_course_access_type: {
      type: String,
      enum: ["lifetime", "limited"],
      default: "lifetime",
    },

    m_course_access_days: {
      type: Number,
      default: null, // e.g. 90 days
    },

    m_course_slug: {
      type: String,
      maxlength: 200,
      unique: true,
      //sparse: true, // Allows null values but enforces uniqueness when present
    },

    m_course_intro: {
      type: String,
      // required: true,
    },

    m_course_code: {
      type: String,
      // required: true,
      maxlength: 200,
      // unique: true,
    },

    // m_course_banner: {
    //   type: String,
    //   // required: true,
    //   maxlength: 200,
    // },

    m_course_banner: {
      type: String,
      default: "",
    },

    m_course_banner_public_id: {
      type: String,
      default: "",
    },

    // Separate, optional image for the nav mega-menu's small course-card
    // preview - the main banner above is designed for the course detail
    // page hero and reads poorly shrunk down. Falls back to
    // m_course_banner wherever it's unset.
    m_course_mega_banner: {
      type: String,
      default: "",
    },

    m_course_mega_banner_public_id: {
      type: String,
      default: "",
    },

    // m_course_pdf: {
    //   type: String,
    //   default: null,
    // },

    m_course_pdf: {
      type: String,
      default: "",
    },

    m_course_pdf_public_id: {
      type: String,
      default: "",
    },

    m_course_video_link: {
      type: String,
      // required: true,
      maxlength: 200,
    },

    m_course_video_id: {
      type: String,
    },

    m_course_description: {
      type: String,
      trim: true,
      // required: true,
      trim: true,
    },

    m_course_type: {
      type: Number,
      // required: true,
      enum: [1, 2], // 1-Free, 2-Paid
    },

    m_course_price: {
      type: Number,
      // required: true,
      min: 0,
    },

    m_course_offer_price: {
      type: Number,
      // required: true,
      min: 0,
    },

    // 1 = single price (m_course_price/m_course_offer_price), 2 = tiered pricing (m_course_fee_tiers)
    m_course_pricing_mode: {
      type: Number,
      enum: [1, 2],
      default: 1,
    },

    m_course_fee_tiers: {
      type: [
        {
          tier_name: { type: String, trim: true },
          price: { type: Number, min: 0 },
          offer_price: { type: Number, min: 0 },
        },
      ],
      default: [],
    },

    m_course_partner_logos: {
      type: [
        {
          url: { type: String },
          public_id: { type: String },
        },
      ],
      default: [],
    },

    m_course_modified: {
      type: Date,
      default: Date.now,
    },

    m_course_popular: {
      type: Number,
      default: 0,
      enum: [0, 1], // 0-No, 1-Yes
    },

    // Free-text ribbon shown on the nav mega-menu's course card (e.g.
    // "Popular", "New", "Bestseller", "50% Off") - independent of
    // m_course_popular above, which only drives the separate
    // popular-courses listing/filter. Empty means no ribbon shown.
    m_course_badge_text: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },

    m_course_recomended: {
      type: Number,
      default: 0,
      enum: [0, 1], // 0-No, 1-Yes
    },

    m_course_lifetime: {
      type: Number,
      default: 0,
      enum: [0, 1], // 0-No, 1-Yes
    },

    m_course_keyword: {
      type: String,
      default: null,
      maxlength: 256,
    },

    m_course_status: {
      type: Number,
      // required: true,
      enum: [1, 0],
      default: 1,
    },

    m_course_status_web: {
      type: Number,
      // required: true,
      enum: [0, 1],
      default: 1,
    },

    // Whether this course shows up in the LMS course list (the iScale
    // mobile app) that admins pick from when assigning courses to a
    // student - separate from the web/app visibility flags above.
    m_course_lms_status: {
      type: Number,
      enum: [0, 1],
      default: 0,
    },

    m_course_view: {
      type: Number,
      default: 0,
    },

    m_course_like: {
      type: Number,
      default: 0,
    },

    m_course_dislike: {
      type: Number,
      default: 0,
    },

    m_course_rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },

    m_course_reviews: {
      type: Number,
      default: 0,
    },

    // m_course_brochure: {
    //   type: String,
    //   default: null,
    // },

    m_course_brochure: {
      type: String,
      default: "",
    },

    m_course_brochure_public_id: {
      type: String,
      default: "",
    },

    m_course_duration_app: {
      type: Number,
      // required: true,
    },

    m_course_duration_web: {
      type: Number,
      // required: true,
      min: 0,
    },

    // Hero stat strip fields on the course detail page - previously the
    // frontend guessed at field names for these (commencement_date,
    // delivery_mode, etc.) that never existed here, so these 3 stats always
    // showed hardcoded placeholder text ("Batch Starts Soon"/"Live"/
    // "Included") for every course regardless of what was actually true.
    m_course_commencement_date: {
      type: String,
      default: "",
      trim: true,
    },

    m_course_delivery_mode: {
      type: String,
      default: "",
      trim: true,
    },

    m_course_job_assistance: {
      type: String,
      default: "",
      trim: true,
    },

    // m_course_trainee: {
    //   type: String,
    //   // required: true,
    // },

    m_course_trainee: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "instructor",
        },
      ],
      default: [],
    },

    // m_course_feestructure: {
    //   type: String,
    //   // required: true,
    // },

    m_course_feestructure: {
      type: String,
      default: "",
    },

    m_course_feestructure_public_id: {
      type: String,
      default: "",
    },

    m_course_certificate: {
      type: Number,
      // required: true,
      enum: [1, 2], // 1-Yes, 2-No
    },

    m_course_app_g_link: {
      type: String,
      // required: true,
    },

    m_course_web_g_link: {
      type: String,
      // required: true,
    },

    m_course_graphy_instruction: {
      type: String,
      // required: true,
    },

    m_course_share: {
      type: Number,
      default: 0,
    },

    m_course_order: {
      type: Number,
      default: null,
    },

    m_course_share_link: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: false,
  },
);

// Auto-generate slug from title
// courseSchema.pre("save", function (next) {
//   if (this.m_course_title && !this.m_course_slug) {
//     this.m_course_slug = slugify(this.m_course_title, {
//       lower: true,
//       strict: true,
//       replacement: "-",
//     });
//   }
//   // next();
// });

courseSchema.pre("save", function (next) {
  if (this.m_course_title && !this.m_course_slug) {
    this.m_course_slug = slugify(this.m_course_title, {
      lower: true,
      strict: true,
      replacement: "-",
    });
  }

  // next();
});

module.exports = mongoose.model("course", courseSchema);
