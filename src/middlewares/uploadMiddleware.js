const multer = require("multer");
const path = require("path");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// console.log("Cloud Name:", process.env.CLOUDINARY_CLOUD_NAME);
// console.log("API Key:", process.env.CLOUDINARY_API_KEY);
// console.log("API Secret:", process.env.CLOUDINARY_API_SECRET);

// console.log(cloudinary.config());

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = "others";

    if (file.fieldname === "category_icon") {
      folder = "categories/category-icon";
    } else if (file.fieldname === "category_banner") {
      folder = "categories/category-banner";
    } else if (file.fieldname === "m_cf_icon") {
      folder = "career-fit/icon";
    } else if (file.fieldname === "m_phd_logo") {
      folder = "prime-hiring-destinations";
    } else if (file.fieldname === "m_course_banner") {
      folder = "courses/banner";
    } else if (file.fieldname === "m_course_mega_banner") {
      folder = "courses/mega-banner";
    } else if (file.fieldname === "m_course_pdf") {
      folder = "courses/pdf";
    } else if (file.fieldname === "m_course_feestructure") {
      folder = "courses/fee-structure";
    } else if (file.fieldname === "m_course_brochure") {
      folder = "courses/brochure";
    } else if (file.fieldname === "m_course_partner_logos") {
      folder = "courses/partner-logos";
    } else if (file.fieldname === "m_feature_image") {
      folder = "features";
    } else if (file.fieldname === "c_tool_img") {
      folder = "tools";
    } else if (file.fieldname === "m_subject_icon") {
      folder = "subjects/icon";
    } else if (file.fieldname === "ml_file") {
      folder = "topics/video";
    } else if (file.fieldname === "ml_pdffile") {
      folder = "topics/pdf";
    } else if (file.fieldname === "m_package_image") {
      folder = "test-packages";
    } else if (file.fieldname === "th_icon") {
      folder = "training-highlights";
    } else if (file.fieldname === "m_quiz_icon") {
      folder = "quiz/icon";
    } else if (file.fieldname === "m_quiz_banner") {
      folder = "quiz/banner";
    } else if (file.fieldname === "m_instructor_profile") {
      folder = "instructors";
    } else if (file.fieldname === "m_st_video") {
      folder = "testimonials/video";
    } else if (file.fieldname === "company_logo") {
      folder = "jobs/company-logo";
    } else if (file.fieldname === "m_ec_icon") {
      folder = "event-category/icon";
    } else if (file.fieldname === "m_ec_banner") {
      folder = "event-category/banner";
    } else if (file.fieldname === "m_event_banner") {
      folder = "events/banner";
    } else if (file.fieldname === "m_event_file") {
      folder = "events/files";
    } else if (file.fieldname === "m_pre_image") {
      folder = "ppt/person";
    } else if (file.fieldname === "m_pre_company_img") {
      folder = "ppt/company";
    } else if (file.fieldname === "m_client_logo") {
      folder = "clients/logo";
    } else if (file.fieldname === "m_allied_image") {
      folder = "allied";
    } else if (file.fieldname === "m_news_image") {
      // Cloudinary rejects "&" in a public_id (folder + filename), so this
      // can't be "news&updates" - that broke every image upload/update on
      // the News & Updates form with "public_id (...) is invalid".
      folder = "news-updates";
    } else if (file.fieldname === "m_snews_image") {
      folder = "news";
    } else if (file.fieldname === "certificate_pdf") {
      folder = "certificates";
    } else if (file.fieldname === "test_category_icon") {
      folder = "test-category/icon";
    } else if (file.fieldname === "test_category_banner") {
      folder = "test-category/banner";
    } else if (file.fieldname === "nc_icon") {
      folder = "notes-category/icon";
    } else if (file.fieldname === "nc_banner") {
      folder = "notes-category/banner";
    } else if (file.fieldname === "notes_subcategory_icon") {
      folder = "notes-subcategory/icon";
    } else if (file.fieldname === "notes_subcategory_banner") {
      folder = "notes-subcategory/banner";
    } else if (file.fieldname === "notes_image") {
      folder = "notes/notesimage";
    } else if (file.fieldname === "notes_pdf") {
      folder = "notes/pdf";
    } else if (file.fieldname === "m_batch_image") {
      folder = "batches";
    } else if (file.fieldname === "member_image") {
      folder = "team";
    } else if (file.fieldname === "c_profile_image") {
      folder = "candidates/profile";
    } else if (file.fieldname === "m_offer_image") {
      folder = "offers";
    } else if (file.fieldname === "partner_image") {
      folder = "partners";
    } else if (file.fieldname === "user_image") {
      folder = "user-reviews";
    } else if (file.fieldname === "banner_image") {
      folder = "banners";
    } else if (file.fieldname === "m_ss_image") {
      folder = "success-story";
    } else if (file.fieldname === "kh_pic") {
      folder = "admins";
    } else if (file.fieldname === "video_file") {
      folder = "brand-videos";
    } else if (file.fieldname === "setting_file") {
      folder = "settings";
    } else if (file.fieldname === "phone_image") {
      folder = "phone-images";
    }

    // Cloudinary rejects public_ids with leading/trailing whitespace (and
    // is happier without other special characters), which a raw filename
    // like "AI Engineering Fees .pdf" (note the trailing space before the
    // extension) or one with multiple dots would otherwise produce.
    const baseName = path
      .basename(file.originalname, path.extname(file.originalname))
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    return {
      folder: folder,
      resource_type: "auto",
      public_id: `${Date.now()}-${baseName || "file"}`,
    };
  },
});

// ==================
// FILE FILTER (Updated)
// ==================
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
  ];
  const allowedPdfTypes = ["application/pdf"];

  // Category fields - only images
  if (
    file.fieldname === "category_icon" ||
    file.fieldname === "category_banner" ||
    file.fieldname === "m_cf_icon" ||
    file.fieldname === "m_phd_logo"
  ) {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"), false);
    }
  }

  // Course banner - only images
  else if (file.fieldname === "m_course_banner") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Only JPEG, JPG, PNG images allowed for course banner"),
        false,
      );
    }
  }

  // Course mega-menu card image - only images
  else if (file.fieldname === "m_course_mega_banner") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Only JPEG, JPG, PNG images allowed for the mega-menu card image"),
        false,
      );
    }
  }

  // course partner/collaboration logos - only images
  else if (file.fieldname === "m_course_partner_logos") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed for partner logos"), false);
    }
  }

  // feature image - only images
  else if (file.fieldname === "m_feature_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed for feature"), false);
    }
  }

  // Course PDF fields - only pdf
  else if (
    file.fieldname === "m_course_pdf" ||
    file.fieldname === "m_course_feestructure" ||
    file.fieldname === "m_course_brochure"
  ) {
    if (allowedPdfTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only PDF files allowed for ${file.fieldname}`), false);
    }
  }

  // Course tools image - only images
  else if (file.fieldname === "c_tool_img") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed for tools"), false);
    }
  }

  // Subject icon - only images
  else if (file.fieldname === "m_subject_icon") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for subject icon"), false);
    }
  }

  // Topic video upload
  else if (file.fieldname === "ml_file") {
    const allowedVideoTypes = ["video/mp4", "video/mkv", "video/avi"];

    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files allowed"), false);
    }
  }

  // Topic PDF upload
  else if (file.fieldname === "ml_pdffile") {
    if (allowedPdfTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files allowed for topic"), false);
    }
  }

  // Test package image - only images
  else if (file.fieldname === "m_package_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for package"), false);
    }
  }

  // Training highlight image - only images
  else if (file.fieldname === "th_icon") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed"), false);
    }
  }

  // Quiz icon - only images
  else if (file.fieldname === "m_quiz_icon") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for quiz icon"), false);
    }
  }

  // Quiz banner - only images
  else if (file.fieldname === "m_quiz_banner") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for quiz banner"), false);
    }
  }

  // Instructor profile image - only images
  else if (file.fieldname === "m_instructor_profile") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for instructor profile"), false);
    }
  }

  // Testimonial video upload
  else if (file.fieldname === "m_st_video") {
    const allowedVideoTypes = ["video/mp4", "video/mkv", "video/avi"];

    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video allowed"), false);
    }
  }

  // Company logo - only images
  else if (file.fieldname === "company_logo") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for company logo"), false);
    }
  }

  // Event category icon/banner - only images
  else if (file.fieldname === "m_ec_icon" || file.fieldname === "m_ec_banner") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for event category"), false);
    }
  }

  // Event banner - only images
  else if (file.fieldname === "m_event_banner") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for event banner"), false);
    }
  }

  // Event file - only PDF
  else if (file.fieldname === "m_event_file") {
    if (allowedPdfTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF allowed for event file"), false);
    }
  }

  // Pre-placement testimonial images - only images
  else if (
    file.fieldname === "m_pre_image" ||
    file.fieldname === "m_pre_company_img"
  ) {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for PPT"), false);
    }
  }

  // Our Client logo - only images
  else if (file.fieldname === "m_client_logo") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for client logo"), false);
    }
  }

  // Allied image - only images
  else if (file.fieldname === "m_allied_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for allied"), false);
    }
  }

  // news & update images-only images
  else if (file.fieldname === "m_news_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for news & updates"), false);
    }
  }

  // news images-only images
  else if (file.fieldname === "m_snews_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for news"), false);
    }
  }

  // Certificate PDF upload
  else if (file.fieldname === "certificate_pdf") {
    if (allowedPdfTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF allowed for certificate"), false);
    }
  }

  // Test category icon/banner - only images
  else if (
    file.fieldname === "test_category_icon" ||
    file.fieldname === "test_category_banner"
  ) {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for test category"), false);
    }
  }

  // Notes category icon/banner - only images
  else if (file.fieldname === "nc_icon" || file.fieldname === "nc_banner") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for notes category"), false);
    }
  }

  // Notes subcategory icon/banner - only images
  else if (
    file.fieldname === "notes_subcategory_icon" ||
    file.fieldname === "notes_subcategory_banner"
  ) {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for notes subcategory"), false);
    }
  }

  // Notes image - only images
  else if (file.fieldname === "notes_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for notes"), false);
    }
  }

  // Notes PDF - only pdf
  else if (file.fieldname === "notes_pdf") {
    if (allowedPdfTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF allowed for notes"), false);
    }
  }

  // Batch image - only images
  else if (file.fieldname === "m_batch_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for batch"), false);
    }
  }

  // Team member image - only images
  else if (file.fieldname === "member_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for team member"), false);
    }
  }

  // Candidate profile image
  else if (file.fieldname === "c_profile_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for profile image"), false);
    }
  }

  // Offer image - only images
  else if (file.fieldname === "m_offer_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for offer"), false);
    }
  }

  // Partner image - only images
  else if (file.fieldname === "partner_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for partner"), false);
    }
  }

  // User review image - only images
  else if (file.fieldname === "user_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for user review"), false);
    }
  }

  // Banner image - only images
  else if (file.fieldname === "banner_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for banner"), false);
    }
  }

  // Success story image - only images
  else if (file.fieldname === "m_ss_image") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for success story"), false);
    }
  }

  // brand video upload - only videos
  else if (file.fieldname === "video_file") {
    const allowedVideoTypes = [
      "video/mp4",
      "video/mpeg",
      "video/mp3",
      "video/webm",
      "video/mov",
      "video/quicktime",
    ];

    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files allowed"), false);
    }
  }

  // Admin profile image - only images
  else if (file.fieldname === "kh_pic") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed for admin profile"), false);
    }
  }

  // Admin app settings upload - only images
  else if (file.fieldname === "setting_file") {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image allowed"), false);
    }
  }


  // Phone image upload - only images
  else if (file.fieldname === "phone_image") {
  if (allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files allowed"), false);
  }
}

  // Other fields
  else {
    cb(new Error("Unknown file field"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
});

const brandVideoMulter = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
});

// ==================
// COURSE UPLOAD (Multiple Fields)
// ==================
const courseUpload = upload.fields([
  { name: "m_course_banner", maxCount: 1 }, // Course Image (Required)
  { name: "m_course_mega_banner", maxCount: 1 }, // Nav mega-menu card image (Optional, falls back to m_course_banner)
  { name: "m_course_pdf", maxCount: 1 }, // Course PDF (Optional)
  { name: "m_course_feestructure", maxCount: 1 }, // Fee Structure (Optional)
  { name: "m_course_brochure", maxCount: 1 }, // Brochure (Optional)
  { name: "m_course_partner_logos", maxCount: 10 }, // Collaboration/Certification partner logos (Optional)
]);

// const featureUpload = upload.fields([{ name: "m_feature_image", maxCount: 1 }]);
const featureUpload = upload.single("m_feature_image");

const toolUpload = upload.fields([{ name: "c_tool_img", maxCount: 1 }]);

const subjectUpload = upload.fields([{ name: "m_subject_icon", maxCount: 1 }]);

const topicUpload = upload.fields([
  { name: "ml_file", maxCount: 1 }, // video
  { name: "ml_pdffile", maxCount: 1 }, // pdf
]);

const packageUpload = upload.fields([{ name: "m_package_image", maxCount: 1 }]);

const careerFitUpload = upload.fields([{ name: "m_cf_icon", maxCount: 1 }]);

const primeHiringDestinationUpload = upload.fields([
  { name: "m_phd_logo", maxCount: 1 },
]);

const thUpload = upload.fields([{ name: "th_icon", maxCount: 1 }]);

const quizUpload = upload.fields([
  { name: "m_quiz_icon", maxCount: 1 },
  { name: "m_quiz_banner", maxCount: 1 },
]);

const instructorUpload = upload.fields([
  { name: "m_instructor_profile", maxCount: 1 },
]);

// maxCount has to be a finite number for multer, so this is a generously high
// stand-in for "no limit" on how many videos can be added in one batch.
const testimonialUpload = upload.fields([{ name: "m_st_video", maxCount: 50 }]);

const jobUpload = upload.fields([{ name: "company_logo", maxCount: 1 }]);

const eventCategoryUpload = upload.fields([
  { name: "m_ec_icon", maxCount: 1 },
  { name: "m_ec_banner", maxCount: 1 },
]);

const eventUpload = upload.fields([
  { name: "m_event_banner", maxCount: 1 },
  { name: "m_event_file", maxCount: 1 },
]);

const pptUpload = upload.fields([
  { name: "m_pre_image", maxCount: 1 },
  { name: "m_pre_company_img", maxCount: 1 },
]);

const clientUpload = upload.fields([{ name: "m_client_logo", maxCount: 1 }]);

const alliedUpload = upload.fields([{ name: "m_allied_image", maxCount: 1 }]);

const newsupdatesUpload = upload.fields([
  { name: "m_news_image", maxCount: 1 },
]);

const newsUpload = upload.fields([{ name: "m_snews_image", maxCount: 1 }]);

const certificateUpload = upload.fields([
  { name: "certificate_pdf", maxCount: 1 },
]);

const testCategoryUpload = upload.fields([
  { name: "test_category_icon", maxCount: 1 },
  { name: "test_category_banner", maxCount: 1 },
]);

const notesCategoryUpload = upload.fields([
  { name: "nc_icon", maxCount: 1 },

  { name: "nc_banner", maxCount: 1 },
]);

const notesSubCategoryUpload = upload.fields([
  { name: "notes_subcategory_icon", maxCount: 1 },

  { name: "notes_subcategory_banner", maxCount: 1 },
]);

const notesUpload = upload.fields([
  { name: "notes_image", maxCount: 1 },

  { name: "notes_pdf", maxCount: 1 },
]);

const batchUpload = upload.fields([
  {
    name: "m_batch_image",
    maxCount: 1,
  },
]);

const teamUpload = upload.fields([
  {
    name: "member_image",
    maxCount: 1,
  },
]);

const candidateUpload = upload.fields([
  {
    name: "c_profile_image",
    maxCount: 1,
  },
]);

const offerUpload = upload.fields([
  {
    name: "m_offer_image",
    maxCount: 1,
  },
]);

const partnerUpload = upload.fields([
  {
    name: "partner_image",
    maxCount: 1,
  },
]);

const userReviewUpload = upload.fields([
  {
    name: "user_image",
    maxCount: 1,
  },
]);

const bannerUpload = upload.fields([
  {
    name: "banner_image",
    maxCount: 1,
  },
]);

const successStoryUpload = upload.fields([
  {
    name: "m_ss_image",
    maxCount: 1,
  },
]);

const adminUpload = upload.fields([
  {
    name: "kh_pic",
    maxCount: 1,
  },
]);

const brandVideoUpload = brandVideoMulter.fields([
  {
    name: "video_file",
    maxCount: 1,
  },
]);

const settingUpload = upload.fields([
  {
    name: "setting_file",
    maxCount: 1,
  },
]);


const phoneImageUpload = upload.single("phone_image");

module.exports = {
  upload,
  courseUpload,
  featureUpload,
  toolUpload,
  subjectUpload,
  topicUpload,
  packageUpload,
  careerFitUpload,
  primeHiringDestinationUpload,
  thUpload,
  quizUpload,
  instructorUpload,
  testimonialUpload,
  jobUpload,
  eventCategoryUpload,
  eventUpload,
  pptUpload,
  clientUpload,
  alliedUpload,
  newsupdatesUpload,
  newsUpload,
  certificateUpload,
  testCategoryUpload,
  notesCategoryUpload,
  notesSubCategoryUpload,
  notesUpload,
  batchUpload,
  teamUpload,
  candidateUpload,
  offerUpload,
  partnerUpload,
  userReviewUpload,
  bannerUpload,
  successStoryUpload,
  adminUpload,
  brandVideoUpload,
  settingUpload,
  phoneImageUpload
};
