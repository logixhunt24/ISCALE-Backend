console.log("course Controller Hit");

const Course = require("../models/course");
const slugify = require("slugify");
// const fs = require("fs");
const Category = require("../models/category");
const mongoose = require("mongoose");
const LectureProgress = require("../models/lecture_progress");
const Subject = require("../models/subject");
const Lecture = require("../models/lecture");
const CourseEnrollment = require("../models/course_enrollment");
const deleteCourseCascade = require("../services/courseCascadeDelete");

const {
  extractUploadedFile,
  deleteFile,
} = require("../services/storageService");

const rollbackUploadedFiles = async (files = []) => {
  for (const publicId of files) {
    try {
      await deleteFile(publicId);
    } catch (err) {
      console.error("Rollback failed:", err.message);
    }
  }
};

// Multipart form values arrive as strings.  Do not let an invalid numeric
// value reach Mongoose, where it would become a cast error/NaN.
const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { value: null };
  }

  const number = Number(value);
  return Number.isFinite(number) ? { value: number } : { error: true };
};

// Fee tiers arrive as a JSON string over multipart/form-data (e.g. "Basic"/"Premium"/"Pro").
const parseFeeTiers = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && t.tier_name)
      .slice(0, 3)
      .map((t) => ({
        tier_name: String(t.tier_name).trim(),
        price: Number(t.price) || 0,
        offer_price: Number(t.offer_price) || 0,
      }));
  } catch {
    return [];
  }
};

// ADD COURSE
const addCourse = async (req, res) => {
  const uploadedFiles = [];

  const banner = req.files?.m_course_banner?.[0]
    ? extractUploadedFile(req.files.m_course_banner[0])
    : null;

  if (banner?.public_id) uploadedFiles.push(banner.public_id);

  const megaBanner = req.files?.m_course_mega_banner?.[0]
    ? extractUploadedFile(req.files.m_course_mega_banner[0])
    : null;

  if (megaBanner?.public_id) uploadedFiles.push(megaBanner.public_id);

  const pdf = req.files?.m_course_pdf?.[0]
    ? extractUploadedFile(req.files.m_course_pdf[0])
    : null;

  if (pdf?.public_id) uploadedFiles.push(pdf.public_id);

  const feeStructure = req.files?.m_course_feestructure?.[0]
    ? extractUploadedFile(req.files.m_course_feestructure[0])
    : null;

  if (feeStructure?.public_id) uploadedFiles.push(feeStructure.public_id);

  const partnerLogos = (req.files?.m_course_partner_logos || [])
    .map((file) => {
      const extracted = extractUploadedFile(file);
      if (extracted?.public_id) uploadedFiles.push(extracted.public_id);
      return extracted;
    })
    .filter(Boolean);

  try {
    const {
      m_course_lang,
      m_course_category,
      m_course_cat_slug,
      m_course_title,
      m_course_intro,
      m_course_code,
      m_course_video_link,
      m_course_description,

      m_course_type,
      m_course_price,
      m_course_offer_price,
      m_course_pricing_mode,
      m_course_fee_tiers,
      m_course_access_type,
      m_course_access_days,

      m_course_popular,
      m_course_badge_text,
      m_course_recomended,
      m_course_lifetime,
      m_course_keyword,
      m_course_status,
      m_course_status_web,

      m_course_duration_app,
      m_course_duration_web,

      m_course_trainee,
      m_course_certificate,

      m_course_app_g_link,
      m_course_web_g_link,
      m_course_graphy_instruction,

      m_course_view,
      m_course_reviews,
      m_course_rating,

      m_course_order,
    } = req.body;

    // REQUIRED FIELD VALIDATION
    const requiredFields = {
      m_course_lang,
      m_course_title,
      m_course_status,
      m_course_status_web,
    };

    const missingFields = Object.entries(requiredFields)
      .filter(
        ([_, value]) => value === undefined || value === null || value === "",
      )
      .map(([key]) => key);

    if (missingFields.length > 0) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(400).json({
        status: false,
        message: "Required fields are missing",
        missing_fields: missingFields,
      });
    }

    // OBJECT ID VALIDATION
    if (
      m_course_category &&
      !mongoose.Types.ObjectId.isValid(m_course_category)
    ) {
      await rollbackUploadedFiles(uploadedFiles);

      return res
        .status(400)
        .json({ status: false, message: "Invalid category id" });
    }

    const category = await Category.findById(m_course_category);

    if (!category) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    // if (
    //   m_course_trainee &&
    //   !mongoose.Types.ObjectId.isValid(m_course_trainee)
    // ) {
    //   return res
    //     .status(400)
    //     .json({ status: false, message: "Invalid instructor id" });
    // }

    const traineeIds = m_course_trainee
      ? (Array.isArray(m_course_trainee) ? m_course_trainee : [m_course_trainee])
      : [];

    if (traineeIds.length) {
      const invalidIds = traineeIds.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id),
      );

      if (invalidIds.length > 0) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Invalid trainee ids",
        });
      }
    }

    // ENUM VALIDATIONS
    if (
      m_course_type !== undefined &&
      ![1, 2].includes(Number(m_course_type))
    ) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(400).json({
        status: false,
        message: "Invalid course type (1=Free, 2=Paid)",
      });
    }

    if (
      m_course_access_type &&
      !["lifetime", "limited"].includes(m_course_access_type)
    ) {
      await rollbackUploadedFiles(uploadedFiles);

      return res
        .status(400)
        .json({ status: false, message: "Invalid access type" });
    }

    if (m_course_access_type === "limited") {
      if (!m_course_access_days || Number(m_course_access_days) <= 0) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Access days required for limited course",
        });
      }
    }

    if (
      m_course_lang !== undefined &&
      ![1, 2, 3].includes(Number(m_course_lang))
    ) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(400).json({
        status: false,
        message: "Invalid course language",
      });
    }

    if (
      m_course_certificate !== undefined &&
      ![1, 2].includes(Number(m_course_certificate))
    ) {
      await rollbackUploadedFiles(uploadedFiles);

      return res
        .status(400)
        .json({ status: false, message: "Invalid certificate value" });
    }

    // if (![0, 1].includes(Number(m_course_status))) {
    //   return res
    //     .status(400)
    //     .json({ status: false, message: "Invalid course status" });
    // }

    if (
      m_course_status !== undefined &&
      ![0, 1, "0", "1"].includes(m_course_status)
    ) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(400).json({
        status: false,
        message: "Invalid course status. Use 0 or 1",
      });
    }

    if (![0, 1].includes(Number(m_course_status_web))) {
      await rollbackUploadedFiles(uploadedFiles);

      return res
        .status(400)
        .json({ status: false, message: "Invalid course status web" });
    }

    // PRICE VALIDATION
    // Tiered pricing (mode 2) carries its real prices in m_course_fee_tiers,
    // so the single m_course_price field is legitimately empty/0 there.
    const isTieredPricing = Number(m_course_pricing_mode) === 2;

    if (Number(m_course_type) === 2 && !isTieredPricing) {
      if (!m_course_price || Number(m_course_price) <= 0) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Price required for paid course",
        });
      }
    }

    if (Number(m_course_type) === 2 && isTieredPricing) {
      const tiers = parseFeeTiers(m_course_fee_tiers);
      const hasValidTier = tiers.some((t) => Number(t.price) > 0);

      if (!hasValidTier) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "At least one pricing tier with a price is required",
        });
      }
    }

    if (
      !isTieredPricing &&
      m_course_offer_price &&
      m_course_price &&
      Number(m_course_offer_price) > Number(m_course_price)
    ) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(400).json({
        status: false,
        message: "Offer price cannot be greater than actual price",
      });
    }

    // DUPLICATE COURSE CODE
    if (m_course_code) {
      const exists = await Course.findOne({
        m_course_code: m_course_code.trim(),
      });
      if (exists) {
        await rollbackUploadedFiles(uploadedFiles);
        return res.status(409).json({
          status: false,
          message: "Course code already exists",
        });
      }
    }

    if (
      m_course_rating !== undefined &&
      (Number(m_course_rating) < 0 || Number(m_course_rating) > 10)
    ) {
      await rollbackUploadedFiles(uploadedFiles);
      return res.status(400).json({
        status: false,
        message: "Course rating must be between 0 and 10",
      });
    }

    const numericFields = {
      m_course_duration_app,
      m_course_duration_web,
      m_course_order,
      m_course_view,
      m_course_reviews,
      m_course_rating,
    };
    const numericValues = {};

    for (const [field, value] of Object.entries(numericFields)) {
      const parsed = parseOptionalNumber(value);
      if (parsed.error || (parsed.value !== null && parsed.value < 0)) {
        await rollbackUploadedFiles(uploadedFiles);
        return res.status(400).json({
          status: false,
          message: `${field} must be a non-negative number`,
        });
      }
      numericValues[field] = parsed.value;
    }

    // FILE HANDLING (SAFE)
    // const getFile = (name) => req.files?.[name]?.[0]?.path || null;

    // const m_course_banner = getFile("m_course_banner");
    // const m_course_pdf = getFile("m_course_pdf");
    // const m_course_feestructure = getFile("m_course_feestructure");
    // const m_course_brochure = getFile("m_course_brochure");

    // const banner = req.files?.m_course_banner?.[0]
    //   ? extractUploadedFile(req.files.m_course_banner[0])
    //   : null;

    // if (banner?.public_id) {
    //   uploadedFiles.push(banner.public_id);
    // }

    // const pdf = req.files?.m_course_pdf?.[0]
    //   ? extractUploadedFile(req.files.m_course_pdf[0])
    //   : null;

    // if (pdf?.public_id) {
    //   uploadedFiles.push(pdf.public_id);
    // }

    // const feeStructure = req.files?.m_course_feestructure?.[0]
    //   ? extractUploadedFile(req.files.m_course_feestructure[0])
    //   : null;

    // if (feeStructure?.public_id) {
    //   uploadedFiles.push(feeStructure.public_id);
    // }

    // const brochure = req.files?.m_course_brochure?.[0]
    //   ? extractUploadedFile(req.files.m_course_brochure[0])
    //   : null;

    // SLUG GENERATION
    let slug = slugify(m_course_title, { lower: true, strict: true });

    const slugExists = await Course.findOne({ m_course_slug: slug });
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }

    // YOUTUBE VIDEO ID
    let videoId = null;
    if (m_course_video_link) {
      const match = m_course_video_link.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/,
      );
      if (match) videoId = match[1];
    }

    // CREATE OBJECT
    const newCourse = new Course({
      m_course_lang: Number(m_course_lang),
      m_course_category: m_course_category || null,
      m_course_cat_slug: m_course_cat_slug || null,
      m_course_title: m_course_title.trim(),
      m_course_slug: slug,
      m_course_intro: m_course_intro || null,
      m_course_code: m_course_code?.trim() || null,

      // m_course_banner,
      // m_course_pdf,
      // m_course_feestructure,
      // m_course_brochure,

      m_course_banner: banner?.url || "",
      m_course_banner_public_id: banner?.public_id || "",

      m_course_mega_banner: megaBanner?.url || "",
      m_course_mega_banner_public_id: megaBanner?.public_id || "",

      m_course_pdf: pdf?.url || "",
      m_course_pdf_public_id: pdf?.public_id || "",

      m_course_feestructure: feeStructure?.url || "",
      m_course_feestructure_public_id: feeStructure?.public_id || "",

      // m_course_brochure: brochure?.url || "",
      // m_course_brochure_public_id: brochure?.public_id || "",

      m_course_video_link: m_course_video_link || null,
      m_course_video_id: videoId,

      m_course_description: m_course_description || null,

      m_course_type: m_course_type !== undefined ? Number(m_course_type) : null,
      m_course_price: Number(m_course_price) || 0,
      m_course_offer_price: Number(m_course_offer_price) || 0,
      m_course_pricing_mode: Number(m_course_pricing_mode) === 2 ? 2 : 1,
      m_course_fee_tiers: parseFeeTiers(m_course_fee_tiers),

      m_course_partner_logos: partnerLogos.map((f) => ({
        url: f.url,
        public_id: f.public_id,
      })),

      m_course_access_type: m_course_access_type || "lifetime",
      m_course_access_days:
        m_course_access_type === "limited"
          ? Number(m_course_access_days)
          : null,

      m_course_popular: Number(m_course_popular) || 0,
      m_course_badge_text: m_course_badge_text?.trim() || "",
      m_course_recomended: Number(m_course_recomended) || 0,
      m_course_lifetime: Number(m_course_lifetime) || 0,
      m_course_keyword: m_course_keyword || null,

      m_course_status: Number(m_course_status ?? 1),
      m_course_status_web: Number(m_course_status_web),

      // m_course_view: 0,
      m_course_like: 0,
      m_course_dislike: 0,
      // m_course_rating: 0,
      // m_course_reviews: 0,
      m_course_share: 0,

      m_course_duration_app: numericValues.m_course_duration_app,
      m_course_duration_web: numericValues.m_course_duration_web,

      // m_course_trainee: m_course_trainee
      //   ? new mongoose.Types.ObjectId(m_course_trainee)
      //   : null,

      m_course_trainee: traineeIds.map((id) => new mongoose.Types.ObjectId(id)),

      m_course_certificate:
        m_course_certificate !== undefined
          ? Number(m_course_certificate)
          : null,

      m_course_app_g_link: m_course_app_g_link || null,
      m_course_web_g_link: m_course_web_g_link || null,
      m_course_graphy_instruction: m_course_graphy_instruction || null,

      m_course_order: numericValues.m_course_order,

      m_course_view: numericValues.m_course_view ?? 0,

      m_course_reviews: numericValues.m_course_reviews ?? 0,

      m_course_rating: numericValues.m_course_rating ?? 0,

      m_course_modified: new Date(),
    });

    const savedCourse = await newCourse.save();

    return res.status(201).json({
      status: true,
      message: "Course added successfully",
      data: savedCourse,
    });
  } catch (error) {
    // console.error("Add Course Error:", error);

    await rollbackUploadedFiles(uploadedFiles);

    // if (req.files) deleteUploadedFiles(req.files);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        status: false,
        message: `${field} already exists`,
      });
    }

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// HELPER - DELETE UPLOADED FILES
// const deleteUploadedFiles = (files) => {
//   if (!files) return;
//   Object.values(files).forEach((fileArray) => {
//     fileArray.forEach((file) => {
//       if (fs.existsSync(file.path)) {
//         fs.unlink(file.path, (err) => {
//           if (err) console.log(err);
//         });
//       }
//     });
//   });
// };

const getAllCourses = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 50,
      search = "",
      category,
      course_type,
      status,
    } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 50;

    let filter = {};

    // SEARCH
    if (search) {
      filter.$or = [
        { m_course_title: { $regex: search, $options: "i" } },
        { m_course_code: { $regex: search, $options: "i" } },
      ];
    }

    // CATEGORY FILTER
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.m_course_category = category;
    }

    // COURSE TYPE FILTER
    if (course_type) {
      filter.m_course_type = Number(course_type);
    }

    // STATUS FILTER
    if (status !== undefined) {
      filter.m_course_status = Number(status);
    }

    // TOTAL COUNT
    const total = await Course.countDocuments(filter);

    // FETCH ALL COURSES
    const courses = await Course.find(filter)
      .populate("m_course_category", "m_category_name")
      .sort({ m_course_order: 1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Sab course ki id ek baar nikal lo
    const courseIds = courses.map((c) => c._id);

    // Ek single query mein sab course ke saare subject le lo
    const allSubjects = await Subject.find({
      m_subject_course: { $in: courseIds },
    });

    // Ek single query mein sab course ke sirf active lectures le lo
    const allLectures = await Lecture.find({
      ml_course: { $in: courseIds },
      ml_status: 1,
    });

    // Count ko map mein group kar lo
    const subjectCountMap = {};
    const lectureCountMap = {};

    allSubjects.forEach((subject) => {
      const cid = subject.m_subject_course.toString();
      subjectCountMap[cid] = (subjectCountMap[cid] || 0) + 1;
    });

    allLectures.forEach((lecture) => {
      const cid = lecture.ml_course.toString();
      lectureCountMap[cid] = (lectureCountMap[cid] || 0) + 1;
    });

    // FINAL RESPONSE

    const finalData = courses.map((course) => {
      const cid = course._id.toString();

      return {
        _id: course._id,
        title: course.m_course_title,
        code: course.m_course_code,
        category: course.m_course_category
          ? course.m_course_category.m_category_name
          : "N/A",
        banner: course.m_course_banner,
        // Falls back to the main banner wherever a course has no dedicated
        // mega-menu image set, so existing courses don't go blank there.
        mega_banner: course.m_course_mega_banner || course.m_course_banner,
        video: course.m_course_video_link,
        course_type: course.m_course_type === 1 ? 1 : 2,
        price: course.m_course_type === 1 ? "N/A" : course.m_course_price,
        offer_price:
          course.m_course_type === 1 ? "N/A" : course.m_course_offer_price,
        pricing_mode: course.m_course_pricing_mode || 1,
        fee_tiers: course.m_course_pricing_mode === 2 ? (course.m_course_fee_tiers || []) : [],
        partner_logos: course.m_course_partner_logos || [],
        status: course.m_course_status === 1 ? 1 : 0,
        slug: course.m_course_slug,
        popular: course.m_course_popular === 1,
        badge_text: course.m_course_badge_text || "",

        // Extra Fields
        views: course.m_course_view,
        reviews: course.m_course_reviews,
        rating: course.m_course_rating,
        total_subjects: subjectCountMap[cid] || 0,
        total_lectures: lectureCountMap[cid] || 0,
        duration:
          course.m_course_duration_web || course.m_course_duration_app || "N/A",
      };
    });

    res.send({
      status: true,
      message: "Courses fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: finalData,
    });
  } catch (e) {
    console.error(e);

    res.status(500).send({
      status: false,
      message: e.message,
    });
  }
};

const getCategoryDropdown = async (req, res) => {
  try {
    const categories = await Category.find({
      m_category_status: 1,
    }).select("_id m_category_name");

    res.send({
      status: true,
      data: categories,
    });
  } catch (e) {
    res.status(500).send({
      status: false,
      message: e.message,
    });
  }
};

// UPDATE COURSE
// const updateCourse = async (req, res) => {
//   const uploadedFiles = [];

//   const banner = req.files?.m_course_banner?.[0]
//     ? extractUploadedFile(req.files.m_course_banner[0])
//     : null;

//   if (banner?.public_id) uploadedFiles.push(banner.public_id);

//   const pdf = req.files?.m_course_pdf?.[0]
//     ? extractUploadedFile(req.files.m_course_pdf[0])
//     : null;

//   if (pdf?.public_id) uploadedFiles.push(pdf.public_id);

//   const feeStructure = req.files?.m_course_feestructure?.[0]
//     ? extractUploadedFile(req.files.m_course_feestructure[0])
//     : null;

//   if (feeStructure?.public_id) uploadedFiles.push(feeStructure.public_id);

//   try {
//     const { id } = req.params;

//     // VALIDATION
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       await rollbackUploadedFiles(uploadedFiles);
//       return res.status(400).json({
//         status: false,
//         message: "Invalid course id",
//       });
//     }

//     const course = await Course.findById(id);
//     if (!course) {
//       await rollbackUploadedFiles(uploadedFiles);
//       return res.status(404).json({
//         status: false,
//         message: "Course not found",
//       });
//     }

//     const oldBanner = course.m_course_banner_public_id;

//     const oldPdf = course.m_course_pdf_public_id;

//     const oldFee = course.m_course_feestructure_public_id;

//     // const oldBrochure = course.m_course_brochure_public_id;

//     // HELPER FUNCTION
//     const isValid = (val) => {

//       return val !== undefined && val !== null && val.toString().trim() !== "";
//     };

//     const body = req.body;
//     let updateData = {};

//     // BASIC FIELDS
//     // if (isValid(body.m_course_lang))
//     //   updateData.m_course_lang = Number(body.m_course_lang);

//     if (isValid(body.m_course_lang)) {
//       const lang = Number(body.m_course_lang);

//       if (![1, 2, 3].includes(lang)) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Invalid course language",
//         });
//       }

//       updateData.m_course_lang = lang;
//     }

//     // if (isValid(body.m_course_category))
//     //   updateData.m_course_category = body.m_course_category;

//     if (isValid(body.m_course_category)) {
//       if (!mongoose.Types.ObjectId.isValid(body.m_course_category)) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Invalid category id",
//         });
//       }

//       updateData.m_course_category = body.m_course_category;
//     }

//     if (isValid(body.m_course_cat_slug))
//       updateData.m_course_cat_slug = body.m_course_cat_slug;

//     if (isValid(body.m_course_title)) {
//       updateData.m_course_title = body.m_course_title.trim();

//       // SLUG UPDATE
//       let slug = slugify(body.m_course_title, {
//         lower: true,
//         strict: true,
//       });

//       const slugExists = await Course.findOne({
//         m_course_slug: slug,
//         _id: { $ne: id },
//       });

//       if (slugExists) {
//         slug = `${slug}-${Date.now()}`;
//       }

//       updateData.m_course_slug = slug;
//     }

//     if (isValid(body.m_course_intro))
//       updateData.m_course_intro = body.m_course_intro;

//     // ACCESS TYPE ( NEW)
//     if (isValid(body.m_course_access_type)) {
//       if (!["lifetime", "limited"].includes(body.m_course_access_type)) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Invalid access type",
//         });
//       }

//       updateData.m_course_access_type = body.m_course_access_type;
//     }

//     // ACCESS DAYS ( IMPORTANT)
//     if (body.m_course_access_type === "limited") {
//       if (!isValid(body.m_course_access_days)) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Access days required for limited course",
//         });
//       }

//       updateData.m_course_access_days = Number(body.m_course_access_days);
//     }

//     // Lifetime case
//     if (body.m_course_access_type === "lifetime") {
//       updateData.m_course_access_days = null;
//     }

//     // COURSE CODE (UNIQUE)
//     if (isValid(body.m_course_code)) {
//       const existing = await Course.findOne({
//         m_course_code: body.m_course_code.trim(),
//         _id: { $ne: id },
//       });

//       if (existing) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(409).json({
//           status: false,
//           message: "Course code already exists",
//         });
//       }

//       updateData.m_course_code = body.m_course_code.trim();
//     }

//     if (isValid(body.m_course_description))
//       updateData.m_course_description = body.m_course_description;

//     // VIDEO
//     if (isValid(body.m_course_video_link)) {
//       updateData.m_course_video_link = body.m_course_video_link;

//       let videoId = null;
//       const match = body.m_course_video_link.match(
//         /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/,
//       );
//       if (match) videoId = match[1];

//       updateData.m_course_video_id = videoId;
//     }

//     // TYPE & PRICE
//     if (isValid(body.m_course_type)) {
//       if (![1, 2].includes(Number(body.m_course_type))) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Invalid course type",
//         });
//       }
//       updateData.m_course_type = Number(body.m_course_type);
//     }

//     if (Number(body.m_course_type) === 2) {
//       if (!isValid(body.m_course_price) || Number(body.m_course_price) <= 0) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Price required for paid course",
//         });
//       }
//     }

//     if (isValid(body.m_course_price))
//       updateData.m_course_price = Number(body.m_course_price);

//     // OFFER PRICE VALIDATION
//     const actualPrice = isValid(body.m_course_price)
//       ? Number(body.m_course_price)
//       : course.m_course_price;

//     const offerPrice = isValid(body.m_course_offer_price)
//       ? Number(body.m_course_offer_price)
//       : course.m_course_offer_price;

//     if (offerPrice > actualPrice) {
//       await rollbackUploadedFiles(uploadedFiles);
//       return res.status(400).json({
//         status: false,
//         message: "Offer price cannot be greater than actual price",
//       });
//     }

//     if (isValid(body.m_course_offer_price))
//       updateData.m_course_offer_price = Number(body.m_course_offer_price);

//     // SETTINGS
//     if (isValid(body.m_course_popular))
//       updateData.m_course_popular = Number(body.m_course_popular);

//     if (isValid(body.m_course_recomended))
//       updateData.m_course_recomended = Number(body.m_course_recomended);

//     if (isValid(body.m_course_keyword))
//       updateData.m_course_keyword = body.m_course_keyword;

//     if (isValid(body.m_course_status)) {
//       const status = Number(body.m_course_status);

//       if (![0, 1].includes(status)) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Invalid course status. Use 0 or 1",
//         });
//       }

//       updateData.m_course_status = status;
//     }
//     // if (isValid(body.m_course_status_web))
//     //   updateData.m_course_status_web = Number(body.m_course_status_web);

//     if (isValid(body.m_course_status_web)) {
//       const statusWeb = Number(body.m_course_status_web);

//       if (![0, 1].includes(statusWeb)) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Invalid course status web. Use 0 or 1",
//         });
//       }

//       updateData.m_course_status_web = statusWeb;
//     }

//     // DURATION
//     if (isValid(body.m_course_duration_app))
//       updateData.m_course_duration_app = body.m_course_duration_app.toString();

//     if (isValid(body.m_course_duration_web))
//       updateData.m_course_duration_web = Number(body.m_course_duration_web);

//     // INSTRUCTOR
//     // if (body.m_course_trainee === null) {
//     //   updateData.m_course_trainee = null;
//     // } else if (isValid(body.m_course_trainee)) {
//     //   if (!mongoose.Types.ObjectId.isValid(body.m_course_trainee)) {
//     //     return res.status(400).json({
//     //       status: false,
//     //       message: "Invalid instructor id",
//     //     });
//     //   }

//     //   updateData.m_course_trainee = new mongoose.Types.ObjectId(
//     //     body.m_course_trainee,
//     //   );
//     // }

//     if (body.m_course_trainee !== undefined) {
//       if (!Array.isArray(body.m_course_trainee)) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "m_course_trainee must be an array",
//         });
//       }

//       const invalidIds = body.m_course_trainee.filter(
//         (id) => !mongoose.Types.ObjectId.isValid(id),
//       );

//       if (invalidIds.length > 0) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Invalid trainee ids",
//         });
//       }

//       updateData.m_course_trainee = body.m_course_trainee.map(
//         (id) => new mongoose.Types.ObjectId(id),
//       );
//     }

//     // CERTIFICATE
//     // if (isValid(body.m_course_certificate))
//     //   updateData.m_course_certificate = Number(body.m_course_certificate);

//     if (isValid(body.m_course_certificate)) {
//       const certificate = Number(body.m_course_certificate);

//       if (![1, 2].includes(certificate)) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Invalid certificate value",
//         });
//       }

//       updateData.m_course_certificate = certificate;
//     }

//     // GRAPHY
//     if (isValid(body.m_course_app_g_link))
//       updateData.m_course_app_g_link = body.m_course_app_g_link;

//     if (isValid(body.m_course_web_g_link))
//       updateData.m_course_web_g_link = body.m_course_web_g_link;

//     if (isValid(body.m_course_graphy_instruction))
//       updateData.m_course_graphy_instruction = body.m_course_graphy_instruction;

//     // ORDER
//     if (isValid(body.m_course_order))
//       updateData.m_course_order = Number(body.m_course_order);

//     if (isValid(body.m_course_view)) {
//       updateData.m_course_view = Number(body.m_course_view);
//     }

//     if (isValid(body.m_course_reviews)) {
//       updateData.m_course_reviews = Number(body.m_course_reviews);
//     }

//     if (isValid(body.m_course_rating)) {
//       const rating = Number(body.m_course_rating);

//       if (rating < 0 || rating > 10) {
//         await rollbackUploadedFiles(uploadedFiles);
//         return res.status(400).json({
//           status: false,
//           message: "Course rating must be between 0 and 10",
//         });
//       }

//       updateData.m_course_rating = rating;
//     }

//     // FILE UPDATE
//     if (req.files) {
//       // if (req.files["m_course_banner"]) {
//       //   updateData.m_course_banner = req.files["m_course_banner"][0].path;
//       // }

//       // if (req.files["m_course_pdf"]) {
//       //   updateData.m_course_pdf = req.files["m_course_pdf"][0].path;
//       // }

//       // if (req.files["m_course_feestructure"]) {
//       //   updateData.m_course_feestructure =
//       //     req.files["m_course_feestructure"][0].path;
//       // }

//       // if (req.files["m_course_brochure"]) {
//       //   updateData.m_course_brochure = req.files["m_course_brochure"][0].path;
//       // }

//       if (req.files?.m_course_banner?.[0]) {
//         // const uploaded = extractUploadedFile(req.files.m_course_banner[0]);

//         updateData.m_course_banner = uploaded.url;

//         updateData.m_course_banner_public_id = uploaded.public_id;

//         // uploadedFiles.push(uploaded.public_id);
//       }

//       if (req.files?.m_course_pdf?.[0]) {
//         // const uploaded = extractUploadedFile(req.files.m_course_pdf[0]);

//         updateData.m_course_pdf = uploaded.url;

//         updateData.m_course_pdf_public_id = uploaded.public_id;

//         // uploadedFiles.push(uploaded.public_id);
//       }

//       if (req.files?.m_course_feestructure?.[0]) {
//         // const uploaded = extractUploadedFile(
//         //   req.files.m_course_feestructure[0],
//         // );

//         updateData.m_course_feestructure = uploaded.url;

//         updateData.m_course_feestructure_public_id = uploaded.public_id;

//         // uploadedFiles.push(uploaded.public_id);
//       }

//       // if (req.files?.m_course_brochure?.[0]) {
//       //   const uploaded = extractUploadedFile(req.files.m_course_brochure[0]);

//       //   updateData.m_course_brochure = uploaded.url;

//       //   updateData.m_course_brochure_public_id = uploaded.public_id;
//       // }

//       // MODIFIED DATE
//       updateData.m_course_modified = new Date();

//       // UPDATE
//       const updatedCourse = await Course.findByIdAndUpdate(
//         id,
//         { $set: updateData },
//         { new: true },
//       );

//       // if (req.files?.m_course_banner?.[0] && oldBanner) {
//       //   await deleteFile(oldBanner);
//       // }

//       // if (req.files?.m_course_pdf?.[0] && oldPdf) {
//       //   await deleteFile(oldPdf);
//       // }

//       // if (req.files?.m_course_feestructure?.[0] && oldFee) {
//       //   await deleteFile(oldFee);
//       // }

//       if (req.files?.m_course_banner?.[0] && oldBanner) {
//         try {
//           await deleteFile(oldBanner);
//         } catch (err) {
//           console.error("Old banner delete failed", err.message);
//         }
//       }

//       if (req.files?.m_course_pdf?.[0] && oldPdf) {
//         try {
//           await deleteFile(oldPdf);
//         } catch (err) {
//           console.error("Old pdf delete failed", err.message);
//         }
//       }

//       if (req.files?.m_course_feestructure?.[0] && oldFee) {
//         try {
//           await deleteFile(oldFee);
//         } catch (err) {
//           console.error("Old fee structure delete failed", err.message);
//         }
//       }
//     }

//     // if (req.files?.m_course_brochure?.[0] && oldBrochure) {
//     //   await deleteFile(oldBrochure);
//     // }

//     return res.status(200).json({
//       status: true,
//       message: "Course updated successfully",
//       // data: updatedCourse,
//     });
//   } catch (error) {
//     console.error("Update Course Error:", error);

//     // for (const publicId of uploadedFiles) {
//     //   try {
//     //     await deleteFile(publicId);
//     //   } catch (err) {
//     //     console.error(err.message);
//     //   }
//     // }

//     await rollbackUploadedFiles(uploadedFiles);

//     return res.status(500).json({
//       status: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

const updateCourse = async (req, res) => {
  const uploadedFiles = [];

  // =========================
  // Extract uploaded files once
  // =========================

  const banner = req.files?.m_course_banner?.[0]
    ? extractUploadedFile(req.files.m_course_banner[0])
    : null;

  if (banner?.public_id) {
    uploadedFiles.push(banner.public_id);
  }

  const megaBanner = req.files?.m_course_mega_banner?.[0]
    ? extractUploadedFile(req.files.m_course_mega_banner[0])
    : null;

  if (megaBanner?.public_id) {
    uploadedFiles.push(megaBanner.public_id);
  }

  const pdf = req.files?.m_course_pdf?.[0]
    ? extractUploadedFile(req.files.m_course_pdf[0])
    : null;

  if (pdf?.public_id) {
    uploadedFiles.push(pdf.public_id);
  }

  const feeStructure = req.files?.m_course_feestructure?.[0]
    ? extractUploadedFile(req.files.m_course_feestructure[0])
    : null;

  if (feeStructure?.public_id) {
    uploadedFiles.push(feeStructure.public_id);
  }

  const newPartnerLogos = (req.files?.m_course_partner_logos || [])
    .map((file) => {
      const extracted = extractUploadedFile(file);
      if (extracted?.public_id) uploadedFiles.push(extracted.public_id);
      return extracted;
    })
    .filter(Boolean);

  try {
    const { id } = req.params;
    const body = req.body;

    const updateData = {};

    const isValid = (value) =>
      value !== undefined && value !== null && value.toString().trim() !== "";

    // =========================
    // Course Id Validation
    // =========================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(400).json({
        status: false,
        message: "Invalid course id",
      });
    }

    // =========================
    // Find Course
    // =========================

    const course = await Course.findById(id);

    if (!course) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(404).json({
        status: false,
        message: "Course not found",
      });
    }

    // old cloudinary public ids

    const oldBanner = course.m_course_banner_public_id;
    const oldMegaBanner = course.m_course_mega_banner_public_id;
    const oldPdf = course.m_course_pdf_public_id;
    const oldFee = course.m_course_feestructure_public_id;

    // =========================
    // Language
    // =========================

    if (isValid(body.m_course_lang)) {
      const lang = Number(body.m_course_lang);

      if (![1, 2, 3].includes(lang)) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Invalid course language",
        });
      }

      updateData.m_course_lang = lang;
    }

    // =========================
    // Category
    // =========================

    if (isValid(body.m_course_category)) {
      if (!mongoose.Types.ObjectId.isValid(body.m_course_category)) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Invalid category id",
        });
      }

      const category = await Category.findById(body.m_course_category);

      if (!category) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(404).json({
          status: false,
          message: "Category not found",
        });
      }

      updateData.m_course_category = body.m_course_category;
    }

    // =========================
    // Category Slug
    // =========================

    if (isValid(body.m_course_cat_slug)) {
      updateData.m_course_cat_slug = body.m_course_cat_slug;
    }

    // =========================
    // Course Title + Slug
    // =========================

    if (isValid(body.m_course_title)) {
      updateData.m_course_title = body.m_course_title.trim();

      let slug = slugify(body.m_course_title, {
        lower: true,
        strict: true,
      });

      const slugExists = await Course.findOne({
        _id: { $ne: id },
        m_course_slug: slug,
      });

      if (slugExists) {
        slug = `${slug}-${Date.now()}`;
      }

      updateData.m_course_slug = slug;
    }

    // =========================
    // Intro
    // =========================

    if (isValid(body.m_course_intro)) {
      updateData.m_course_intro = body.m_course_intro;
    }

    // =========================
    // Course Code
    // =========================

    if (isValid(body.m_course_code)) {
      const exists = await Course.findOne({
        _id: { $ne: id },
        m_course_code: body.m_course_code.trim(),
      });

      if (exists) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(409).json({
          status: false,
          message: "Course code already exists",
        });
      }

      updateData.m_course_code = body.m_course_code.trim();
    }

    // =========================
    // Description
    // =========================

    if (isValid(body.m_course_description)) {
      updateData.m_course_description = body.m_course_description;
    }

    // =========================
    // Youtube Link
    // =========================

    if (isValid(body.m_course_video_link)) {
      updateData.m_course_video_link = body.m_course_video_link;

      let videoId = null;

      const match = body.m_course_video_link.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/,
      );

      if (match) {
        videoId = match[1];
      }

      updateData.m_course_video_id = videoId;
    }

    // =========================
    // Course Type
    // =========================

    if (isValid(body.m_course_type)) {
      const courseType = Number(body.m_course_type);

      if (![1, 2].includes(courseType)) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Invalid course type",
        });
      }

      updateData.m_course_type = courseType;
    }

    // =========================
    // Price Validation
    // =========================

    const finalCourseType = isValid(body.m_course_type)
      ? Number(body.m_course_type)
      : course.m_course_type;

    const actualPrice = isValid(body.m_course_price)
      ? Number(body.m_course_price)
      : course.m_course_price;

    const offerPrice = isValid(body.m_course_offer_price)
      ? Number(body.m_course_offer_price)
      : course.m_course_offer_price;

    // Tiered pricing (mode 2) carries its real prices in m_course_fee_tiers,
    // so the single m_course_price/offer_price fields are legitimately
    // empty/0 there - skip the single-price checks in that case.
    const finalPricingMode = isValid(body.m_course_pricing_mode)
      ? Number(body.m_course_pricing_mode)
      : course.m_course_pricing_mode || 1;
    const isTieredPricing = finalPricingMode === 2;

    if (finalCourseType === 2 && !isTieredPricing && actualPrice <= 0) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(400).json({
        status: false,
        message: "Price required for paid course",
      });
    }

    if (finalCourseType === 2 && isTieredPricing) {
      const tiers = isValid(body.m_course_fee_tiers)
        ? parseFeeTiers(body.m_course_fee_tiers)
        : course.m_course_fee_tiers || [];
      const hasValidTier = tiers.some((t) => Number(t.price) > 0);

      if (!hasValidTier) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "At least one pricing tier with a price is required",
        });
      }
    }

    if (!isTieredPricing && offerPrice > actualPrice) {
      await rollbackUploadedFiles(uploadedFiles);

      return res.status(400).json({
        status: false,
        message: "Offer price cannot be greater than actual price",
      });
    }

    if (isValid(body.m_course_price)) {
      updateData.m_course_price = actualPrice;
    }

    if (isValid(body.m_course_offer_price)) {
      updateData.m_course_offer_price = offerPrice;
    }

    if (isValid(body.m_course_pricing_mode)) {
      updateData.m_course_pricing_mode =
        Number(body.m_course_pricing_mode) === 2 ? 2 : 1;
    }

    if (body.m_course_fee_tiers !== undefined) {
      updateData.m_course_fee_tiers = parseFeeTiers(body.m_course_fee_tiers);
    }

    // =========================
    // Access Type
    // =========================

    if (isValid(body.m_course_access_type)) {
      if (!["lifetime", "limited"].includes(body.m_course_access_type)) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Invalid access type",
        });
      }

      updateData.m_course_access_type = body.m_course_access_type;
    }

    if (
      (body.m_course_access_type || course.m_course_access_type) === "limited"
    ) {
      const accessDays = isValid(body.m_course_access_days)
        ? Number(body.m_course_access_days)
        : course.m_course_access_days;

      if (!accessDays || accessDays <= 0) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Access days required",
        });
      }

      updateData.m_course_access_days = accessDays;
    }

    if (body.m_course_access_type === "lifetime") {
      updateData.m_course_access_days = null;
    }

    // =========================
    // Popular / Recommended
    // =========================

    if (isValid(body.m_course_popular)) {
      updateData.m_course_popular = Number(body.m_course_popular);
    }

    // Uses "in body" rather than isValid() - unlike the other optional text
    // fields here, clearing the badge back to empty (removing the ribbon
    // entirely) is a normal, expected admin action, not something to
    // silently ignore.
    if ("m_course_badge_text" in body) {
      updateData.m_course_badge_text = (body.m_course_badge_text || "").trim();
    }

    if (isValid(body.m_course_recomended)) {
      updateData.m_course_recomended = Number(body.m_course_recomended);
    }

    if (isValid(body.m_course_lifetime)) {
      updateData.m_course_lifetime = Number(body.m_course_lifetime);
    }

    if (isValid(body.m_course_keyword)) {
      updateData.m_course_keyword = body.m_course_keyword;
    }

    // =========================
    // Status
    // =========================

    if (isValid(body.m_course_status)) {
      const status = Number(body.m_course_status);

      if (![0, 1].includes(status)) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Invalid course status",
        });
      }

      updateData.m_course_status = status;
    }

    if (isValid(body.m_course_status_web)) {
      const statusWeb = Number(body.m_course_status_web);

      if (![0, 1].includes(statusWeb)) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Invalid course web status",
        });
      }

      updateData.m_course_status_web = statusWeb;
    }

    // =========================
    // Duration
    // =========================

    if (isValid(body.m_course_duration_app)) {
      const parsed = parseOptionalNumber(body.m_course_duration_app);
      if (parsed.error || parsed.value < 0) {
        await rollbackUploadedFiles(uploadedFiles);
        return res.status(400).json({
          status: false,
          message: "m_course_duration_app must be a non-negative number",
        });
      }
      updateData.m_course_duration_app = parsed.value;
    }

    if (isValid(body.m_course_duration_web)) {
      const parsed = parseOptionalNumber(body.m_course_duration_web);
      if (parsed.error || parsed.value < 0) {
        await rollbackUploadedFiles(uploadedFiles);
        return res.status(400).json({
          status: false,
          message: "m_course_duration_web must be a non-negative number",
        });
      }
      updateData.m_course_duration_web = parsed.value;
    }

    // =========================
    // Trainee
    // =========================

    if (body.m_course_trainee !== undefined) {
      const rawTraineeIds = Array.isArray(body.m_course_trainee)
        ? body.m_course_trainee
        : [body.m_course_trainee];

      // The edit form always resends this field, even with no instructor
      // selected (empty string) - that means "clear it", not an invalid id.
      const traineeIds = rawTraineeIds.filter(
        (id) => id !== undefined && id !== null && id !== "",
      );

      const invalidIds = traineeIds.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id),
      );

      if (invalidIds.length) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Invalid trainee ids",
        });
      }

      updateData.m_course_trainee = traineeIds.map(
        (id) => new mongoose.Types.ObjectId(id),
      );
    }

    // =========================
    // Certificate
    // =========================

    if (isValid(body.m_course_certificate)) {
      const certificate = Number(body.m_course_certificate);

      if (![1, 2].includes(certificate)) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Invalid certificate value",
        });
      }

      updateData.m_course_certificate = certificate;
    }

    // =========================
    // Graphy
    // =========================

    if (isValid(body.m_course_app_g_link))
      updateData.m_course_app_g_link = body.m_course_app_g_link;

    if (isValid(body.m_course_web_g_link))
      updateData.m_course_web_g_link = body.m_course_web_g_link;

    if (isValid(body.m_course_graphy_instruction))
      updateData.m_course_graphy_instruction = body.m_course_graphy_instruction;

    // =========================
    // Order / View / Review / Rating
    // =========================

    if (isValid(body.m_course_order))
      updateData.m_course_order = Number(body.m_course_order);

    if (isValid(body.m_course_view))
      updateData.m_course_view = Number(body.m_course_view);

    if (isValid(body.m_course_reviews))
      updateData.m_course_reviews = Number(body.m_course_reviews);

    if (isValid(body.m_course_rating)) {
      const rating = Number(body.m_course_rating);

      if (rating < 0 || rating > 10) {
        await rollbackUploadedFiles(uploadedFiles);

        return res.status(400).json({
          status: false,
          message: "Course rating must be between 0 and 10",
        });
      }

      updateData.m_course_rating = rating;
    }

    // =========================
    // FILES
    // =========================

    if (banner) {
      updateData.m_course_banner = banner.url;
      updateData.m_course_banner_public_id = banner.public_id;
    }

    if (megaBanner) {
      updateData.m_course_mega_banner = megaBanner.url;
      updateData.m_course_mega_banner_public_id = megaBanner.public_id;
    }

    if (pdf) {
      updateData.m_course_pdf = pdf.url;
      updateData.m_course_pdf_public_id = pdf.public_id;
    }

    if (feeStructure) {
      updateData.m_course_feestructure = feeStructure.url;
      updateData.m_course_feestructure_public_id = feeStructure.public_id;
    }

    // Partner/collaboration logos: keep existing ones (minus any the admin
    // removed), append newly uploaded ones.
    let removedLogoPublicIds = [];
    if (newPartnerLogos.length || body.m_course_partner_logos_remove) {
      let removeIds = [];
      if (body.m_course_partner_logos_remove) {
        try {
          removeIds = JSON.parse(body.m_course_partner_logos_remove);
          if (!Array.isArray(removeIds)) removeIds = [];
        } catch {
          removeIds = [];
        }
      }

      const existingLogos = course.m_course_partner_logos || [];
      const keptLogos = existingLogos.filter(
        (logo) => !removeIds.includes(logo.public_id),
      );
      removedLogoPublicIds = existingLogos
        .filter((logo) => removeIds.includes(logo.public_id))
        .map((logo) => logo.public_id);

      updateData.m_course_partner_logos = [
        ...keptLogos,
        ...newPartnerLogos.map((f) => ({ url: f.url, public_id: f.public_id })),
      ];
    }

    updateData.m_course_modified = new Date();

    // =========================
    // UPDATE COURSE
    // =========================

    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      {
        new: true,
      },
    );

    // =========================
    // DELETE OLD FILES
    // =========================

    if (banner && oldBanner) {
      try {
        await deleteFile(oldBanner);
      } catch (err) {
        console.error("Old banner delete failed:", err.message);
      }
    }

    if (megaBanner && oldMegaBanner) {
      try {
        await deleteFile(oldMegaBanner);
      } catch (err) {
        console.error("Old mega-banner delete failed:", err.message);
      }
    }

    if (pdf && oldPdf) {
      try {
        await deleteFile(oldPdf);
      } catch (err) {
        console.error("Old pdf delete failed:", err.message);
      }
    }

    if (feeStructure && oldFee) {
      try {
        await deleteFile(oldFee);
      } catch (err) {
        console.error("Old fee structure delete failed:", err.message);
      }
    }

    for (const publicId of removedLogoPublicIds) {
      try {
        await deleteFile(publicId);
      } catch (err) {
        console.error("Old partner logo delete failed:", err.message);
      }
    }

    return res.status(200).json({
      status: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (error) {
    console.error("Update Course Error:", error);

    // Rollback newly uploaded files
    await rollbackUploadedFiles(uploadedFiles);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// DELETE COURSE
// const deleteCourse = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // VALIDATION
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         status: false,
//         message: "Invalid course id",
//       });
//     }

//     const course = await Course.findById(id);

//     if (!course) {
//       return res.status(404).json({
//         status: false,
//         message: "Course not found",
//       });
//     }

//     // DELETE FILES (IMPORTANT)
//     // const filesToDelete = [
//     //   course.m_course_banner,
//     //   course.m_course_pdf,
//     //   course.m_course_feestructure,
//     //   course.m_course_brochure,
//     // ];

//     //     filesToDelete.forEach((filePath) => {
//     //       if (filePath && fs.existsSync(filePath)) {
//     //         // fs.unlinkSync(filePath);

//     // await Course.findByIdAndDelete(id);
//     //       }
//     //     });

//     if (course.m_course_banner_public_id) {
//       await deleteFile(course.m_course_banner_public_id);
//     }

//     if (course.m_course_pdf_public_id) {
//       await deleteFile(course.m_course_pdf_public_id);
//     }

//     if (course.m_course_feestructure_public_id) {
//       await deleteFile(course.m_course_feestructure_public_id);
//     }

//     // if (course.m_course_brochure_public_id) {
//     //   await deleteFile(course.m_course_brochure_public_id);
//     // }

//     // DELETE FROM DB
//     await Course.findByIdAndDelete(id);

//     // await deleteCourseCascade(id);

//     return res.status(200).json({
//       status: true,
//       message: "Course deleted successfully",
//     });
//   } catch (error) {
//     console.error("Delete Course Error:", error);

//     return res.status(500).json({
//       status: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid course id",
      });
    }

    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).json({
        status: false,
        message: "Course not found",
      });
    }

    await deleteCourseCascade(id);

    return res.status(200).json({
      status: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error("Delete Course Error :", error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// GET POPULAR COURSES
const getPopularCourses = async (req, res) => {
  try {
    let { page = 1, limit = 100, search = "" } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 100;

    const filter = {
      m_course_popular: 1,
      m_course_status: 1,
    };

    // Search by course title
    if (search) {
      filter.m_course_title = {
        $regex: search,
        $options: "i",
      };
    }

    const total = await Course.countDocuments(filter);

    const courses = await Course.find(filter)
      .sort({ m_course_order: 1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const finalData = courses.map((c) => ({
      _id: c._id,
      title: c.m_course_title,
      code: c.m_course_code,
      banner: c.m_course_banner,
      type: c.m_course_type === 1 ? 1 : 2,
      price: c.m_course_type === 1 ? "N/A" : c.m_course_price,
      offer_price: c.m_course_type === 1 ? "N/A" : c.m_course_offer_price,
      slug: c.m_course_slug,
    }));

    res.json({
      status: true,
      message: "Popular courses fetched",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: finalData,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// GET RECOMMENDED COURSE
const getRecommendedCourses = async (req, res) => {
  try {
    let { page = 1, limit = 100, search = "" } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 100;

    const filter = {
      m_course_recomended: 1,
      m_course_status: 1,
    };

    // Search by course title
    if (search) {
      filter.m_course_title = {
        $regex: search,
        $options: "i",
      };
    }

    const total = await Course.countDocuments(filter);

    const courses = await Course.find(filter)
      .sort({ m_course_order: 1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const finalData = courses.map((c) => ({
      _id: c._id,
      title: c.m_course_title,
      code: c.m_course_code,
      banner: c.m_course_banner,
      type: c.m_course_type === 1 ? 1 : 2,
      price: c.m_course_type === 1 ? "N/A" : c.m_course_price,
      offer_price: c.m_course_type === 1 ? "N/A" : c.m_course_offer_price,
      slug: c.m_course_slug,
    }));

    res.json({
      status: true,
      message: "Recommended courses fetched",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: finalData,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// GET SINGLE COURSE BY ID
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    // VALIDATION
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid course id",
      });
    }

    // FETCH COURSE
    // const course = await Course.findById(id);

    const course = await Course.findById(id).populate({
      path: "m_course_trainee",
      select: `
    m_instructor_name
    m_instructor_profile
    m_instructor_bio
    m_instructor_experience
    m_linkedin_profile
    m_instructor_status
  `,
    });

    if (!course) {
      return res.status(404).json({
        status: false,
        message: "Course not found",
      });
    }

    // CATEGORY NAME FETCH
    let categoryName = "N/A";

    if (course.m_course_category) {
      const category = await Category.findById(course.m_course_category);
      if (category) {
        categoryName = category.m_category_name;
      }
    }

    // FINAL RESPONSE
    const finalData = {
      _id: course._id,
      title: course.m_course_title,
      slug: course.m_course_slug,
      code: course.m_course_code,
      category: categoryName,

      banner: course.m_course_banner,
      mega_banner: course.m_course_mega_banner || "",
      pdf: course.m_course_pdf,
      fee_structure: course.m_course_feestructure,
      brochure: course.m_course_brochure,

      video_link: course.m_course_video_link,
      video_id: course.m_course_video_id,

      description: course.m_course_description,

      course_type: course.m_course_type === 1 ? 1 : 2,
      price: course.m_course_price,
      offer_price: course.m_course_offer_price,
      pricing_mode: course.m_course_pricing_mode || 1,
      fee_tiers: course.m_course_fee_tiers || [],
      partner_logos: course.m_course_partner_logos || [],

      status: course.m_course_status === 1 ? 1 : 0,
      status_web: course.m_course_status_web === 1 ? 1 : 0,

      duration_app: course.m_course_duration_app,
      duration_web: course.m_course_duration_web,

      popular: course.m_course_popular,
      badge_text: course.m_course_badge_text || "",
      recommended: course.m_course_recomended,
      lifetime: course.m_course_lifetime,

      lang: course.m_course_lang,
      order: course.m_course_order,

      trainees: (course.m_course_trainee || [])
        .filter(Boolean)
        .map((t) => ({
          trainee_id: t._id,
          name: t.m_instructor_name,
          image: t.m_instructor_profile,
          linkedin: t.m_linkedin_profile,
        })),

      view: course.m_course_view,
      views: course.m_course_view,
      reviews: course.m_course_reviews,
      rating: course.m_course_rating,

      created_at: course.createdAt,
      updated_at: course.m_course_modified,
    };

    return res.json({
      status: true,
      message: "Course fetched successfully",
      data: finalData,
    });
  } catch (error) {
    console.error("Get Course By ID Error:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// GET COURSE DROPDOWN
// WITH CATEGORY FILTER + PAGINATION
const getCourseDropdown = async (req, res) => {
  try {
    let { page = 1, limit = 10, category_id, search = "" } = req.query;

    page = Number(page) || 1;
    limit = Number(limit) || 10;

    // FILTER
    const filter = {
      m_course_status: 1,
    };

    // category filter
    if (category_id && mongoose.Types.ObjectId.isValid(category_id)) {
      filter.m_course_category = category_id;
    }

    // search filter
    if (search) {
      filter.m_course_title = {
        $regex: search,
        $options: "i",
      };
    }

    // TOTAL
    const total = await Course.countDocuments(filter);

    // GET COURSES
    const courses = await Course.find(filter)
      .select("_id m_course_title")
      .sort({ m_course_title: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // RESPONSE
    return res.status(200).json({
      status: true,
      message: "Course dropdown fetched successfully",
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: courses,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const changeCourseStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).send({
        status: false,
        message: "Course not found",
      });
    }

    course.m_course_status = course.m_course_status === 1 ? 0 : 1;

    await course.save();

    res.status(200).send({
      status: true,
      message: `Course status changed to ${course.m_course_status}`,
      data: course.m_course_status,
    });
  } catch (error) {
    res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// Toggles whether this course appears in the LMS course list (the iScale
// mobile app) that admins assign to students from.
const toggleLmsStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id);

    if (!course) {
      return res.status(404).send({
        status: false,
        message: "Course not found",
      });
    }

    course.m_course_lms_status = course.m_course_lms_status === 1 ? 0 : 1;

    await course.save();

    res.status(200).send({
      status: true,
      message: `LMS status changed to ${course.m_course_lms_status}`,
      data: course.m_course_lms_status,
    });
  } catch (error) {
    res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// Courses available for admins to assign to a student on the LMS -
// only ones toggled "Add to lifetime courses" and still active.
const getLmsCourses = async (req, res) => {
  try {
    const courses = await Course.find({
      m_course_lifetime: 1,
      m_course_status: 1,
    })
      .select("m_course_title m_course_banner m_course_type")
      .sort({ m_course_title: 1 });

    res.status(200).send({
      status: true,
      data: courses,
    });
  } catch (error) {
    res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

//===================================================================================================================

const appGetCourseTeamList = async (req, res) => {
  try {
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({
        response: "error",
        message: "course_id is required",
      });
    }

    const course = await Course.findById(course_id).populate({
      path: "m_course_trainee",
      model: "our_teams",
    });

    if (!course) {
      return res.status(404).json({
        response: "error",
        message: "Course not found",
      });
    }

    const data = course.m_course_trainee.map((member) => ({
      id: member._id,
      member_name: member.member_name || "",
      member_position: member.member_position || "",
      member_image: member.member_image || "",
      member_expertise: member.member_expertise || "",
      member_experience: String(member.member_experience || ""),
      member_linkedin: member.member_linkedin || "",
      member_bio: member.member_bio || "",
      member_type: String(member.member_type || ""),
      member_status: String(member.member_status || ""),
      member_order: String(member.member_order || ""),
    }));

    return res.status(200).json({
      response: "success",
      data,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      response: "error",
      message: error.message,
    });
  }
};

const appGetCourseDetailsById = async (req, res) => {
  try {
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({
        response: "error",
        message: "course_id is required",
      });
    }

    const course =
      await Course.findById(course_id).populate("m_course_category");

    if (!course) {
      return res.status(404).json({
        response: "error",
        message: "Course not found",
      });
    }

    // TOTAL SUBJECTS
    const totalSubjects = await Subject.countDocuments({
      m_subject_course: course._id,
    });

    // TOTAL LECTURES
    const totalLectures = await Lecture.countDocuments({
      ml_course: course._id,
    });

    // COMPLETED LECTURES
    let completedLectures = 0;

    if (req.user?.id) {
      completedLectures = await LectureProgress.countDocuments({
        user_id: req.user.id,
        course_id: course._id,
        is_completed: true,
      });
    }

    // PERCENTAGE
    let totalPercent = 0;

    if (totalLectures > 0) {
      totalPercent = Math.round((completedLectures / totalLectures) * 100);
    }

    return res.status(200).json({
      response: "success",
      course_details: [
        {
          course_id: course._id,

          course_name: course.m_course_title || "",

          m_course_slung: course.m_course_slug || "",

          course_pdf: course.m_course_pdf || "",

          category_id: course.m_course_category?._id || "",

          category_name: course.m_course_category?.m_category_name || "",

          course_image: course.m_course_banner || "",

          course_intro: course.m_course_intro || "",

          course_desc: course.m_course_description || "",

          course_price: String(course.m_course_price || 0),

          course_offerprice: String(course.m_course_offer_price || 0),

          video_link: course.m_course_video_link || "",

          course_views: String(course.m_course_view || 0),

          course_rating: String(course.m_course_rating || 0),

          course_reviews: String(course.m_course_reviews || 0),

          course_duration: String(course.m_course_duration_web || 0),

          // ObjectId Array
          course_trainee: course.m_course_trainee || [],

          course_updated_on: course.m_course_modified,

          total_subjects: String(totalSubjects),

          course_share_link: course.m_course_share_link || "",

          totalPercent,
        },
      ],
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      response: "error",
      message: error.message,
    });
  }
};

const appGetTopTrendingCourses = async (req, res) => {
  try {
    const trendingCourses = await CourseEnrollment.aggregate([
      {
        $match: {
          status: 1, // active enrollment only
        },
      },

      {
        $group: {
          _id: "$course_id",
          totalEnrollments: { $sum: 1 },
        },
      },

      {
        $sort: {
          totalEnrollments: -1,
        },
      },

      {
        $limit: 10,
      },

      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "_id",
          as: "course",
        },
      },

      {
        $unwind: "$course",
      },

      // category populate
      {
        $lookup: {
          from: "categories",
          localField: "course.m_course_category",
          foreignField: "_id",
          as: "category",
        },
      },

      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          totalEnrollments: 1,

          m_course_id: "$course._id",
          m_course_lang: "$course.m_course_lang",
          m_course_category: "$course.m_course_category",
          m_course_cat_slug: "$course.m_course_cat_slug",
          m_course_title: "$course.m_course_title",
          m_course_slug: "$course.m_course_slug",
          m_course_intro: "$course.m_course_intro",
          m_course_banner: "$course.m_course_banner",
          m_course_pdf: "$course.m_course_pdf",
          m_course_video_link: "$course.m_course_video_link",
          m_course_description: "$course.m_course_description",
          m_course_type: "$course.m_course_type",
          m_course_price: "$course.m_course_price",
          m_course_offer_price: "$course.m_course_offer_price",
          m_course_popular: "$course.m_course_popular",
          m_course_recomended: "$course.m_course_recomended",
          m_course_keyword: "$course.m_course_keyword",
          m_course_status: "$course.m_course_status",
          m_course_status_web: "$course.m_course_status_web",
          m_course_view: "$course.m_course_view",
          m_course_like: "$course.m_course_like",
          m_course_dislike: "$course.m_course_dislike",
          m_course_rating: "$course.m_course_rating",
          m_course_reviews: "$course.m_course_reviews",
          m_course_brochure: "$course.m_course_brochure",
          m_course_duration_app: "$course.m_course_duration_app",
          m_course_duration_web: "$course.m_course_duration_web",
          m_course_trainee: "$course.m_course_trainee",
          m_course_feestructure: "$course.m_course_feestructure",
          m_course_certificate: "$course.m_course_certificate",
          m_course_app_g_link: "$course.m_course_app_g_link",
          m_course_web_g_link: "$course.m_course_web_g_link",
          m_course_graphy_instruction: "$course.m_course_graphy_instruction",
          m_course_share: "$course.m_course_share",
          m_course_order: "$course.m_course_order",

          m_category_id: "$category._id",
          m_category_name: "$category.m_category_name",
          m_category_slug: "$category.m_category_slug",
          m_category_desc: "$category.m_category_desc",
          m_category_icon: "$category.m_category_icon",
          m_category_banner: "$category.m_category_banner",

          trending_count: "$totalEnrollments",
        },
      },
    ]);

    return res.status(200).json({
      response: "success",
      data: trendingCourses,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      response: "error",
      message: error.message,
    });
  }
};

module.exports = {
  addCourse,
  getAllCourses,
  getCategoryDropdown,
  updateCourse,
  deleteCourse,
  getPopularCourses,
  getRecommendedCourses,
  getCourseById,
  getCourseDropdown,
  changeCourseStatus,
  toggleLmsStatus,
  getLmsCourses,

  appGetCourseTeamList,
  appGetCourseDetailsById,
  appGetTopTrendingCourses,
};
