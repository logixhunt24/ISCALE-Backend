const mongoose = require("mongoose");
const { toPublicUrl } = require("../utils/imageUrl");

const Banner = require("../models/banners");
const Webinar = require("../models/webinar");
const Candidate = require("../models/candidates");
const LmsNotification = require("../models/lms_notification");
const Coupon = require("../models/coupon");
const Offer = require("../models/offers");
const Enrollment = require("../models/course_enrollment");
const Subject = require("../models/subject");
const Lecture = require("../models/lecture");
const LectureProgress = require("../models/lecture_progress");
const JobEnroll = require("../models/job_enroll");
const Job = require("../models/job");
const LiveClass = require("../models/live_class");
const Batch = require("../models/batch");
const Video = require("../models/video");
const QuizResult = require("../models/quiz_result");
const CourseReview = require("../models/course_review");
const Package = require("../models/test_package");
const Quiz = require("../models/quizs");
const Question = require("../models/questions");
const CourseFAQ = require("../models/course_faq");
const Feature = require("../models/course_feature");

// ───────────────────────────────────────────────────────────────────────────
// BANNERS
// ───────────────────────────────────────────────────────────────────────────

const appGetBanners = async (req, res) => {
  try {
    const docs = await Banner.find({ m_banner_status: "running" }).sort({ createdAt: -1 });
    const data = docs.map((b) => ({
      banner_id: String(b._id),
      banner_name: b.m_banner_title || "",
      banner_image: toPublicUrl(b.m_banner_image),
      banner_link: b.m_banner_link || "",
      banner_status: b.m_banner_status || "",
    }));
    return res.json({ status: true, response: "success", banner: data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// WEBINARS
// ───────────────────────────────────────────────────────────────────────────

const appGetWebinarList = async (req, res) => {
  try {
    const docs = await Webinar.find({ m_webinar_status: 1 }).sort({ m_webinar_date: -1 });
    const data = docs.map((w) => ({
      ...w.toObject(),
      m_webinar_id: String(w._id),
      m_webinar_banner: toPublicUrl(w.m_webinar_banner),
      m_webinar_speaker_image: toPublicUrl(w.m_webinar_speaker_image),
    }));
    return res.json({ status: true, response: "success", data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// User webinars — no enrollment model exists yet; return empty list gracefully
const appGetUserWebinars = async (req, res) => {
  return res.json({ status: true, data: [] });
};

// ───────────────────────────────────────────────────────────────────────────
// FCM
// ───────────────────────────────────────────────────────────────────────────

const appUpdateFcm = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fcm_code } = req.body;

    if (!fcm_code) {
      return res.status(400).json({ status: false, message: "fcm_code is required" });
    }

    await Candidate.findByIdAndUpdate(userId, { c_fcm_id: fcm_code });

    return res.json({ status: true, message: "FCM token updated" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ───────────────────────────────────────────────────────────────────────────

const appGetNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    // type 1 = all users; also include user-specific notifications
    const data = await LmsNotification.find({
      $or: [
        { notification_type: 1 },
        { notification_userid: userId },
      ],
    })
      .sort({ nofification_date: -1 })
      .limit(50);

    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// COUPONS
// ───────────────────────────────────────────────────────────────────────────

const appGetCoupons = async (req, res) => {
  try {
    const { type, course_id } = req.body;

    const filter = { coupon_status: 1 };

    if (type) filter.coupon_type = Number(type);
    if (course_id) filter.coupon_type_id = course_id;

    const data = await Coupon.find(filter).sort({ _id: -1 });

    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

const appValidateCoupon = async (req, res) => {
  try {
    const { coupon_code, coupon_type, course_id } = req.body;

    if (!coupon_code) {
      return res.status(400).json({ status: false, message: "coupon_code is required" });
    }

    const coupon = await Coupon.findOne({
      coupon_code: coupon_code.trim().toUpperCase(),
      coupon_status: 1,
    });

    if (!coupon) {
      return res.status(404).json({ status: false, message: "Invalid or expired coupon" });
    }

    const now = new Date();
    if (coupon.coupon_end_date && now > new Date(coupon.coupon_end_date)) {
      return res.status(400).json({ status: false, message: "Coupon has expired" });
    }

    if (coupon.total_coupon > 0 && coupon.used_coupon >= coupon.total_coupon) {
      return res.status(400).json({ status: false, message: "Coupon usage limit reached" });
    }

    return res.json({
      status: true,
      message: "Coupon is valid",
      data: {
        coupon_code: coupon.coupon_code,
        coupon_title: coupon.coupon_title,
        coupon_discount: coupon.coupon_discount,
        coupon_discount_type: coupon.coupon_discount_type,
        coupon_min_amount: coupon.coupon_min_amount,
        coupon_max_amount: coupon.coupon_max_amount,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// OFFERS
// ───────────────────────────────────────────────────────────────────────────

const appGetOffers = async (req, res) => {
  try {
    const docs = await Offer.find({ m_offer_status: 1 })
      .sort({ m_offer_priority: 1, createdAt: -1 });
    const data = docs.map((o) => ({
      ...o.toObject(),
      m_offer_id: String(o._id),
      m_offer_image: toPublicUrl(o.m_offer_image),
    }));
    return res.json({ status: true, response: "success", data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// COURSE FAQ
// ───────────────────────────────────────────────────────────────────────────

const appGetCourseFaq = async (req, res) => {
  try {
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({ status: false, message: "course_id is required" });
    }

    const data = await CourseFAQ.find({ course_id, status: 1 }).sort({ createdAt: -1 });

    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// COURSE SUBJECT + TOPICS (public — for course detail before enrollment)
// ───────────────────────────────────────────────────────────────────────────

const appGetCourseSubjectTopic = async (req, res) => {
  try {
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({ status: false, message: "course_id is required" });
    }

    const subjects = await Subject.find({
      m_subject_course: course_id,
      m_subject_status: 1,
    }).sort({ m_subject_seq: 1, _id: 1 });

    const result = await Promise.all(
      subjects.map(async (sub) => {
        const topics = await Lecture.find({ ml_subject: sub._id })
          .select("_id ml_title ml_type ml_duration ml_is_demo")
          .sort({ _id: 1 });
        return { ...sub.toObject(), topics };
      }),
    );

    return res.json({ status: true, data: result });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// COURSE FEATURES
// ───────────────────────────────────────────────────────────────────────────

const appGetCourseFeatures = async (req, res) => {
  try {
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({ status: false, message: "course_id is required" });
    }

    const data = await Feature.find({ m_feature_course: course_id, m_feature_status: 1 })
      .sort({ _id: -1 });

    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// ENROLLED COURSE SUBJECT + TOPICS (with lecture progress)
// ───────────────────────────────────────────────────────────────────────────

const appGetUserCourseSubjectTopic = async (req, res) => {
  try {
    const userId = req.user.id;
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({ status: false, message: "course_id is required" });
    }

    const enrollment = await Enrollment.findOne({
      user_id: userId,
      course_id,
      status: 1,
    });

    if (!enrollment) {
      return res.status(403).json({ status: false, message: "Not enrolled in this course" });
    }

    const subjects = await Subject.find({
      m_subject_course: course_id,
      m_subject_status: 1,
    }).sort({ m_subject_seq: 1, _id: 1 });

    const result = await Promise.all(
      subjects.map(async (sub) => {
        const lectures = await Lecture.find({ ml_subject: sub._id })
          .select("_id ml_title ml_type ml_duration ml_vdocipher_id ml_yt_type ml_file")
          .sort({ _id: 1 });

        const lectureIds = lectures.map((l) => l._id);

        const completed = await LectureProgress.find({
          user_id: userId,
          lecture_id: { $in: lectureIds },
          is_completed: true,
        }).distinct("lecture_id");

        const completedSet = new Set(completed.map((id) => id.toString()));

        const topics = lectures.map((l) => ({
          ...l.toObject(),
          is_completed: completedSet.has(l._id.toString()),
        }));

        return { ...sub.toObject(), topics };
      }),
    );

    return res.json({ status: true, data: result });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// LECTURE PROGRESS (watchlist)
// ───────────────────────────────────────────────────────────────────────────

const appInsertWatchlist = async (req, res) => {
  try {
    // Android sends: watchlist_student, watchlist_course, watchlist_subject, watchlist_topic, watchlist_type
    // We map watchlist_topic → lecture_id
    const { watchlist_topic } = req.body;

    if (!watchlist_topic) {
      return res.status(400).json({ status: false, message: "watchlist_topic (lecture id) is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(watchlist_topic)) {
      return res.status(400).json({ status: false, message: "Invalid lecture id" });
    }

    const lecture = await Lecture.findById(watchlist_topic);
    if (!lecture) {
      return res.status(404).json({ status: false, message: "Lecture not found" });
    }

    const subject = await Subject.findById(lecture.ml_subject);
    if (!subject) {
      return res.status(404).json({ status: false, message: "Subject not found" });
    }

    const courseId = subject.m_subject_course;

    await LectureProgress.findOneAndUpdate(
      { user_id: req.user.id, lecture_id: watchlist_topic },
      {
        subject_id: subject._id,
        course_id: courseId,
        is_completed: true,
        completed_at: new Date(),
      },
      { upsert: true },
    );

    await Enrollment.updateOne(
      { user_id: req.user.id, course_id: courseId },
      { $set: { last_watched: new Date() } },
    );

    return res.json({ status: true, message: "Progress saved" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

const appGetUserCourseProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({ status: false, message: "course_id is required" });
    }

    const enrollment = await Enrollment.findOne({ user_id: userId, course_id, status: 1 });
    if (!enrollment) {
      return res.status(403).json({ status: false, message: "Not enrolled in this course" });
    }

    const subjects = await Subject.find({
      $expr: { $eq: [{ $toString: "$m_subject_course" }, course_id.toString()] },
    }).select("_id");

    const subjectIds = subjects.map((s) => s._id.toString());

    const lectureIds = await Lecture.find({
      ml_subject: { $in: subjectIds },
    }).distinct("_id");

    const totalLectures = lectureIds.length;

    const completedLectures = await LectureProgress.countDocuments({
      user_id: userId,
      lecture_id: { $in: lectureIds },
      is_completed: true,
    });

    const progress = totalLectures === 0
      ? 0
      : Math.round((completedLectures / totalLectures) * 100);

    return res.json({
      status: true,
      data: {
        course_id,
        total_lectures: totalLectures,
        completed_lectures: completedLectures,
        progress,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// COURSE REVIEWS
// ───────────────────────────────────────────────────────────────────────────

const appInsertCourseReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { course_id, rating, remark, review_for } = req.body;

    if (!course_id || !rating) {
      return res.status(400).json({ status: false, message: "course_id and rating are required" });
    }

    const existing = await CourseReview.findOne({ user_id: userId, course_id });
    if (existing) {
      existing.rating = Number(rating);
      existing.remark = remark || existing.remark;
      existing.review_for = review_for || existing.review_for;
      await existing.save();
      return res.json({ status: true, message: "Review updated" });
    }

    await CourseReview.create({
      user_id: userId,
      course_id,
      rating: Number(rating),
      remark: remark || null,
      review_for: review_for || null,
    });

    return res.json({ status: true, message: "Review added" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// JOB ENROLLMENT
// ───────────────────────────────────────────────────────────────────────────

const appInsertJobEnroll = async (req, res) => {
  try {
    const userId = req.user.id;
    const { m_je_job } = req.body;

    if (!m_je_job) {
      return res.status(400).json({ status: false, message: "m_je_job (job id) is required" });
    }

    const existing = await JobEnroll.findOne({ m_je_job, m_je_user: userId });
    if (existing) {
      return res.json({ status: true, message: "Already applied for this job" });
    }

    await JobEnroll.create({
      m_je_job,
      m_je_user: userId.toString(),
      m_je_status: "pending",
    });

    return res.json({ status: true, message: "Job application submitted" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

const appCheckJobEnrolled = async (req, res) => {
  try {
    const userId = req.user.id;
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({ status: false, message: "job_id is required" });
    }

    const existing = await JobEnroll.findOne({ m_je_job: job_id, m_je_user: userId.toString() });

    if (existing) {
      return res.json({ status: true, message: "Applied", data: existing });
    } else {
      return res.json({ status: false, message: "Not applied" });
    }
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// BATCH LIVE CLASSES
// ───────────────────────────────────────────────────────────────────────────

const appGetBatchLiveClasses = async (req, res) => {
  try {
    const { batch_id } = req.body;

    if (!batch_id) {
      return res.status(400).json({ status: false, message: "batch_id is required" });
    }

    const data = await LiveClass.find({ batch_id }).sort({ class_date: 1 });

    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// Batch enrollment — store as a course enrollment row tagged with batch_id
const appEnrollBatch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { batch_id, course_id } = req.body;

    if (!batch_id) {
      return res.status(400).json({ status: false, message: "batch_id is required" });
    }

    const batch = await Batch.findById(batch_id);
    if (!batch) {
      return res.status(404).json({ status: false, message: "Batch not found" });
    }

    const existing = await Enrollment.findOne({ user_id: userId, batch_id });
    if (existing) {
      return res.json({ status: true, message: "Already enrolled in this batch" });
    }

    await Enrollment.create({
      user_id: userId,
      course_id: course_id || batch.batch_course || null,
      batch_id,
      status: 1,
      course_type: 1,
      payment_status: 0,
    });

    return res.json({ status: true, message: "Batch enrollment successful" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// VIDEO FEED
// ───────────────────────────────────────────────────────────────────────────

const appGetVideoFeed = async (req, res) => {
  try {
    const data = await Video.find({ status: 1 }).sort({ createdAt: -1 });
    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// VdoCipher OTP for a lecture
const appGetVideoDetails = async (req, res) => {
  try {
    const { videoid } = req.body;

    if (!videoid) {
      return res.status(400).json({ status: false, message: "videoid is required" });
    }

    // Forward to the existing videoController.playVideo logic
    // videoid here is the lecture _id
    if (!mongoose.Types.ObjectId.isValid(videoid)) {
      return res.status(400).json({ status: false, message: "Invalid video id" });
    }

    const lecture = await Lecture.findById(videoid).populate("ml_subject", "m_subject_course");
    if (!lecture) {
      return res.status(404).json({ status: false, message: "Lecture not found" });
    }

    const userId = req.user.id;
    const courseId = lecture.ml_subject?.m_subject_course;

    if (courseId) {
      const enrollment = await Enrollment.findOne({ user_id: userId, course_id: courseId, status: 1 });
      if (!enrollment) {
        return res.status(403).json({ status: false, message: "Not enrolled in this course" });
      }
    }

    if (!lecture.ml_vdocipher_id) {
      return res.json({
        status: true,
        data: {
          yt_type: lecture.ml_yt_type || null,
          file: lecture.ml_file || null,
          otp: null,
          playbackInfo: null,
        },
      });
    }

    const axios = require("axios");
    const vdoRes = await axios.post(
      `https://dev.vdocipher.com/api/videos/${lecture.ml_vdocipher_id}/otp`,
      {},
      {
        headers: {
          Authorization: `Apisecret ${process.env.VDOCIPHER_API_KEY}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    );

    return res.json({ status: true, data: vdoRes.data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// USER COURSE COUNT
// ───────────────────────────────────────────────────────────────────────────

const appGetUserCourseCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await Enrollment.countDocuments({ user_id: userId, status: 1 });
    return res.json({ status: true, data: { count } });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// INVOICE
// ───────────────────────────────────────────────────────────────────────────

const appGetInvoice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { course_id } = req.query;

    if (!course_id) {
      return res.status(400).json({ status: false, message: "course_id is required" });
    }

    const enrollment = await Enrollment.findOne({ user_id: userId, course_id, status: 1 });

    if (!enrollment) {
      return res.status(404).json({ status: false, message: "Enrollment not found" });
    }

    return res.json({
      status: true,
      data: {
        invoice_no: enrollment.invoice_no || null,
        invoice_pdf: enrollment.invoice_pdf || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// TEST SERIES
// ───────────────────────────────────────────────────────────────────────────

const appGetTestPackages = async (req, res) => {
  try {
    const { m_course_id } = req.body;

    if (!m_course_id) {
      return res.status(400).json({ status: false, message: "m_course_id is required" });
    }

    const data = await Package.find({
      m_package_course: m_course_id,
      m_package_status: 1,
    }).sort({ m_package_order: 1, _id: 1 });

    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

const appGetQuizList = async (req, res) => {
  try {
    const { m_package_id } = req.body;

    if (!m_package_id) {
      return res.status(400).json({ status: false, message: "m_package_id is required" });
    }

    const data = await Quiz.find({
      m_quiz_package: m_package_id,
      m_quiz_status: 1,
    }).sort({ _id: 1 });

    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

const appGetQuestions = async (req, res) => {
  try {
    const { m_quiz_id } = req.body;

    if (!m_quiz_id) {
      return res.status(400).json({ status: false, message: "m_quiz_id is required" });
    }

    const data = await Question.find({ m_ques_quiz: m_quiz_id }).sort({ _id: 1 });

    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

const appSaveTestResult = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      m_quiz_id,
      m_quiz_duration,
      m_user_quiz_duration,
      ...rest
    } = req.body;

    if (!m_quiz_id) {
      return res.status(400).json({ status: false, message: "m_quiz_id is required" });
    }

    const quiz = await Quiz.findById(m_quiz_id).catch(() => null)
      || await Quiz.findOne({ m_quiz_id }).catch(() => null);

    const ques_ids = Object.entries(rest)
      .filter(([k]) => k.startsWith("m_ques_id"))
      .map(([, v]) => v);

    const given_ans = Object.entries(rest)
      .filter(([k]) => k.startsWith("m_given_ans"))
      .map(([, v]) => v);

    const total_questions = ques_ids.length;
    let correct = 0;
    let wrong = 0;

    if (total_questions > 0) {
      for (let i = 0; i < ques_ids.length; i++) {
        const q = await Question.findById(ques_ids[i]).select("m_ques_ans").catch(() => null);
        if (q && given_ans[i] && q.m_ques_ans) {
          if (q.m_ques_ans.toString() === given_ans[i].toString()) {
            correct++;
          } else {
            wrong++;
          }
        }
      }
    }

    const per_marks = quiz?.m_quiz_per_marks || 1;
    const neg_marks = quiz?.m_quiz_pernegative_marks || 0;
    const marks_obtained = correct * per_marks - wrong * neg_marks;
    const total_marks = total_questions * per_marks;
    const percentage = total_marks === 0 ? 0 : Math.round((marks_obtained / total_marks) * 100);

    const answers = ques_ids.map((qid, i) => ({ question_id: qid, given_answer: given_ans[i] }));

    await QuizResult.create({
      user_id: userId,
      quiz_id: m_quiz_id,
      package_id: quiz?.m_quiz_package || null,
      course_id: quiz?.m_quiz_course_id || null,
      total_questions,
      attempted: ques_ids.filter((_, i) => given_ans[i]).length,
      correct,
      wrong,
      skipped: total_questions - ques_ids.filter((_, i) => given_ans[i]).length,
      marks_obtained,
      total_marks,
      percentage,
      time_taken: m_user_quiz_duration || null,
      answers,
    });

    return res.json({ status: true, message: "Result saved" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

const appGetTestResultDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { m_quiz_id } = req.body;

    if (!m_quiz_id) {
      return res.status(400).json({ status: false, message: "m_quiz_id is required" });
    }

    const result = await QuizResult.findOne({ user_id: userId, quiz_id: m_quiz_id })
      .sort({ createdAt: -1 });

    if (!result) {
      return res.status(404).json({ status: false, message: "Result not found" });
    }

    return res.json({ status: true, data: result });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

const appGetTestResults = async (req, res) => {
  try {
    const userId = req.user.id;

    const data = await QuizResult.find({ user_id: userId }).sort({ createdAt: -1 });

    return res.json({ status: true, data });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = {
  appGetBanners,
  appGetWebinarList,
  appGetUserWebinars,
  appUpdateFcm,
  appGetNotifications,
  appGetCoupons,
  appValidateCoupon,
  appGetOffers,
  appGetCourseFaq,
  appGetCourseSubjectTopic,
  appGetCourseFeatures,
  appGetUserCourseSubjectTopic,
  appInsertWatchlist,
  appGetUserCourseProgress,
  appInsertCourseReview,
  appInsertJobEnroll,
  appCheckJobEnrolled,
  appGetBatchLiveClasses,
  appEnrollBatch,
  appGetVideoFeed,
  appGetVideoDetails,
  appGetUserCourseCount,
  appGetInvoice,
  appGetTestPackages,
  appGetQuizList,
  appGetQuestions,
  appSaveTestResult,
  appGetTestResultDetails,
  appGetTestResults,
};
