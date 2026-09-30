const mongoose = require("mongoose");

const Enrollment = require("../models/course_enrollment");
const Course = require("../models/course");
const Subject = require("../models/subject");
const Lecture = require("../models/lecture");
const LectureProgress = require("../models/lecture_progress");
const Candidate = require("../models/candidates");

// GET ENROLLED FREE COURSES
const getEnrolledFreeCourses = async (req, res) => {
  try {
    const userId = req.user.id;

    const enrollments = await Enrollment.find({
      user_id: userId,
      course_type: 1,
      status: 1,
    })

      // FULL COURSE DETAILS
      .populate({
        path: "course_id",

        populate: [
          {
            path: "m_course_category",
            model: "category",
          },
          {
            path: "m_course_trainee",
            model: "instructor",
          },
        ],
      })

      .sort({ enrolled_on: -1 });

    // remove deleted/null courses
    const filteredCourses = enrollments.filter((item) => item.course_id);

    return res.status(200).json({
      status: true,
      message: "Free enrolled courses fetched successfully",
      total: filteredCourses.length,
      data: filteredCourses,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// GET ENROLLED PREMIUM COURSES
const getEnrolledPremiumCourses = async (req, res) => {
  try {
    const userId = req.user.id;

    const enrollments = await Enrollment.find({
      user_id: userId,
      course_type: 2,
      status: 1,
    })

      // FULL COURSE DETAILS
      .populate({
        path: "course_id",

        populate: [
          {
            path: "m_course_category",
            model: "category",
          },
          {
            path: "m_course_trainee",
            model: "instructor",
          },
        ],
      })

      .sort({ enrolled_on: -1 });

    // remove deleted/null courses
    const filteredCourses = enrollments.filter((item) => item.course_id);

    return res.status(200).json({
      status: true,
      message: "Premium enrolled courses fetched successfully",
      total: filteredCourses.length,
      data: filteredCourses,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// GET FULL ENROLLED COURSE DETAILS
const getEnrolledCourseFullDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { course_id } = req.params;

    // VALIDATION

    if (!course_id) {
      return res.status(400).json({
        status: false,
        message: "Course ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(course_id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid course ID",
      });
    }

    // CHECK ENROLLMENT
    const enrollment = await Enrollment.findOne({
      user_id: userId,
      course_id: course_id,
      status: 1,
    }).lean();

    if (!enrollment) {
      return res.status(403).json({
        status: false,
        message: "You are not enrolled in this course",
      });
    }

    // PAID COURSE PAYMENT CHECK
    if (
      enrollment.course_type === 2 &&
      enrollment.payment_status !== 1
    ) {
      return res.status(403).json({
        status: false,
        message: "Payment not completed",
      });
    }

    // EXPIRY CHECK
    if (
      enrollment.access_type === "limited" &&
      enrollment.expiry_date &&
      new Date() > new Date(enrollment.expiry_date)
    ) {
      return res.status(403).json({
        status: false,
        message: "Course access expired",
      });
    }

    // COURSE DETAILS
    const course = await Course.findById(course_id)
      .populate("m_course_category")
      .populate("m_course_trainee")
      .lean();

    if (!course) {
      return res.status(404).json({
        status: false,
        message: "Course not found",
      });
    }

    // SUBJECTS
    const subjects = await Subject.find({
      m_subject_course: course_id,
    })
      .sort({ created_at: 1 })
      .lean();

    const subjectIds = subjects.map((subject) => subject._id);

    // LECTURES
    const lectures = await Lecture.find({
      ml_subject: { $in: subjectIds },
    })
      .sort({ ml_seq: 1, _id: 1 })
      .lean();

    // COMPLETED LECTURES
    const completedLectures = await LectureProgress.find({
      user_id: userId,
      lecture_id: {
        $in: lectures.map((lecture) => lecture._id),
      },
      is_completed: true,
    }).select("lecture_id");

    // COMPLETED SET
    const completedSet = new Set(
      completedLectures.map((item) => item.lecture_id.toString()),
    );

    // SUBJECT WISE DATA
    const subjectWiseData = subjects.map((subject) => {
      const subjectLectures = lectures
        .filter(
          (lecture) => lecture.ml_subject.toString() === subject._id.toString(),
        )
        .map((lecture) => ({
          lecture_id: lecture._id,

          lecture_title: lecture.ml_title,

          lecture_code: lecture.ml_code,

          lecture_type: lecture.ml_type,

          lecture_subtype: lecture.ml_stype,

          // "1" = YouTube/link (ml_video_id), "2" = VdoCipher (fetched
          // server-side via /api/video/play_video using this lecture's id) -
          // see topicsController's create/update for how these two are kept
          // mutually exclusive.
          lecture_yt_type: lecture.ml_yt_type,

          lecture_video_id: lecture.ml_video_id,

          lecture_file: lecture.ml_file,

          lecture_pdf: lecture.ml_pdffile,

          lecture_sequence: lecture.ml_seq,

          lecture_status: lecture.ml_status,

          lecture_added_on: lecture.ml_added_on,

          is_completed: completedSet.has(lecture._id.toString()),
        }));

      return {
        subject_id: subject._id,

        subject_title: subject.m_subject_title,

        subject_description: subject.m_subject_desc,

        total_lectures: subjectLectures.length,

        lectures: subjectLectures,
      };
    });

    // COUNTS
    const totalLectures = lectures.length;

    const completedCount = completedLectures.length;

    const progress =
      totalLectures === 0
        ? 0
        : Math.round((completedCount / totalLectures) * 100);

    // RESPONSE
    return res.status(200).json({
      status: true,
      message: "Enrolled course full details fetched successfully",

      progress,

      total_subjects: subjects.length,

      total_lectures: totalLectures,

      completed_lectures: completedCount,

      course,

      enrollment: {
        enrolled_on: enrollment.enrolled_on,
        access_type: enrollment.access_type,
        expiry_date: enrollment.expiry_date,
      },

      subjects: subjectWiseData,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const getCourseAccessDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({
        status: false,
        message: "course_id is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(course_id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid course id",
      });
    }

    const enrollment = await Enrollment.findOne({
      user_id: userId,
      course_id,
    }).populate("course_id", "m_course_title");

    if (!enrollment) {
      return res.status(200).json({
        status: true,
        is_enrolled: false,
        message: "User not enrolled in this course",
      });
    }

    let remainingDays = null;

    if (enrollment.access_type === "limited" && enrollment.expiry_date) {
      const today = new Date();

      const expiry = new Date(enrollment.expiry_date);

      remainingDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      if (remainingDays < 0) {
        remainingDays = 0;
      }
    }

    return res.status(200).json({
      status: true,

      is_enrolled: true,

      course_id: enrollment.course_id?._id,

      course_name: enrollment.course_id?.m_course_title,

      access_type: enrollment.access_type,

      expiry_date: enrollment.expiry_date,

      remaining_days: remainingDays,

      test_series_status: enrollment.test_series_status,

      live_class_status: enrollment.live_class_status,

      certificate_status: enrollment.certificate_status,

      certificate_no: enrollment.certificate_no,

      certificate_pdf: enrollment.certificate_pdf,

      certificate_date: enrollment.certificate_date,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Mobile Apis=============================================================================================================================

const appGetMyCourses = async (req, res) => {
  try {
    const user_id = req.user.id;

    const enrollments = await Enrollment.find({
      user_id,
      status: 1,
    })
      .populate("course_id")
      .sort({ enrolled_on: -1 });

    const user_courses = await Promise.all(
      enrollments.map(async (enrollment) => {
        const course = enrollment.course_id;

        if (!course) return null;

        // Total Subjects
        const totalSubjects = await Subject.countDocuments({
          m_subject_course: course._id,
        });

        // Total Lectures
        const totalLectures = await Lecture.countDocuments({
          ml_course: course._id,
        });

        // Completed Lectures
        const completedLectures = await LectureProgress.countDocuments({
          user_id,
          course_id: course._id,
          is_completed: true,
        });

        // Progress %
        const progress =
          totalLectures > 0
            ? Math.round((completedLectures / totalLectures) * 100)
            : 0;

        // Remaining Days
        let remainingDays = 0;

        if (enrollment.access_type === "limited" && enrollment.expiry_date) {
          const diff = new Date(enrollment.expiry_date).getTime() - Date.now();

          remainingDays =
            diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
        }

        return {
          course_id: course._id,
          course_name: course.m_course_title || "",
          course_image: course.m_course_banner || "",
          course_price: course.m_course_price || 0,
          course_offerprice: course.m_course_offer_price || 0,
          course_views: course.m_course_view || 0,
          course_rating: course.m_course_rating || 0,
          course_reviews: course.m_course_reviews || 0,
          course_duration: course.m_course_duration_app || 0,

          registration_date: enrollment.enrolled_on
            ? enrollment.enrolled_on.toISOString().split("T")[0]
            : "",

          remaining_days: remainingDays,

          access_type: enrollment.access_type,
          expiry_date: enrollment.expiry_date,

          total_subjects: totalSubjects,
          total_lectures: totalLectures,
          completed_lectures: completedLectures,

          progress: progress,
        };
      }),
    );

    return res.status(200).json({
      response: "success",
      user_courses: user_courses.filter(Boolean),
    });
  } catch (error) {
    return res.status(500).json({
      response: "failed",
      message: error.message,
    });
  }
};

const appGetEnrollmentStatus = async (req, res) => {
  try {
    const { course_id } = req.body;
    const user_id = req.user.id;

    if (!course_id) {
      return res.status(400).json({
        response: "error",
        message: "Course ID is required",
      });
    }

    const enrollment = await Enrollment.findOne({
      user_id,
      course_id,
    })
      .populate("course_id")
      .populate("coupon_id");

    if (!enrollment) {
      return res.status(404).json({
        response: "error",
        message: "Enrollment not found",
      });
    }

    const candidate = await Candidate.findById(user_id);

    const fullName = `${candidate?.c_first_name || ""} ${
      candidate?.c_last_name || ""
    }`.trim();

    // Remaining Days
    let remainingDays = 0;

    if (enrollment.expiry_date) {
      remainingDays = Math.max(
        0,
        Math.ceil(
          (new Date(enrollment.expiry_date) - new Date()) /
            (1000 * 60 * 60 * 24),
        ),
      );
    }

    return res.status(200).json({
      response: "success",
      message: "Enrolled",
      data: {
        t_reg_id: String(enrollment._id),

        t_reg_type: String(enrollment.course_type),

        t_reg_user: String(enrollment.user_id),

        t_reg_course: String(enrollment.course_id?._id),

        t_reg_package: "0",

        t_reg_notes: "0",

        t_reg_webinar: null,

        t_reg_date: enrollment.enrolled_on
          ? enrollment.enrolled_on.toISOString().split("T")[0]
          : null,

        t_reg_price_type: "",

        t_reg_amount: String(enrollment.amount || 0),

        t_reg_payble: String(enrollment.payable_amount || 0),

        t_reg_coupon_id: enrollment.coupon_id
          ? String(enrollment.coupon_id._id)
          : "0",

        t_reg_discount: String(enrollment.discount_amount || 0),

        t_reg_coupon: enrollment.coupon_code || "",

        t_reg_pay_mode: enrollment.payment_mode || "",

        t_reg_transaction_id: enrollment.transaction_id || "",

        t_reg_remarks: String(enrollment.remarks || 1),

        t_reg_status: String(enrollment.status),

        // Agar web_status field nahi hai to filhal status use kar lo
        t_reg_status_web: String(enrollment.status),

        t_reg_status_android: String(enrollment.android_status),

        t_reg_status_live_class: String(enrollment.live_class_status),

        t_reg_status_test_series: String(enrollment.test_series_status),

        t_payment_status: String(enrollment.payment_status),

        t_reg_added_on: enrollment.createdAt,

        t_reg_register_from: String(enrollment.register_from || 0),

        batch_name: enrollment.batch_name || "",

        t_reg_durration: String(remainingDays),

        t_reg_web_durration: String(remainingDays),

        t_reg_request_certificate: String(
          enrollment.certificate_status > 0 ? 1 : 0,
        ),

        t_reg_certificate_name: fullName,

        t_reg_certificate_status: String(enrollment.certificate_status),

        t_reg_certificate_number: enrollment.certificate_no,

        t_reg_certificate_pdf: enrollment.certificate_pdf,

        t_reg_certificate_date: enrollment.certificate_approved_at
          ? enrollment.certificate_approved_at.toISOString().split("T")[0]
          : "0000-00-00",

        remaining_days: String(remainingDays),
      },
    });
  } catch (error) {
    return res.status(500).json({
      response: "error",
      message: error.message,
    });
  }
};



const appGetCertificateStatus = async (req, res) => {
  try {
    const { course_id } = req.body;

    const user_id = req.user.id; // token se

    if (!course_id) {
      return res.status(400).json({
        response: "failed",
        message: "Course id is required",
      });
    }

    const enrollment = await Enrollment.findOne({
      user_id,
      course_id,
      status: 1,
    });

    if (!enrollment) {
      return res.status(404).json({
        response: "failed",
        message: "Enrollment not found",
      });
    }

    return res.status(200).json({
      response: "success",
      message: "fetch",
      cerificate: {
        user_id: enrollment.user_id.toString(),
        course_id: enrollment.course_id.toString(),
        certificate_number: enrollment.certificate_no || "",
        certificate_file: enrollment.certificate_pdf || "",
        status: String(enrollment.certificate_status),
      },
    });
  } catch (error) {
    return res.status(500).json({
      response: "failed",
      message: error.message,
    });
  }
};


const appRequestCertificate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({ status: false, response: "failed", message: "course_id is required" });
    }

    const enrollment = await Enrollment.findOne({ user_id: userId, course_id });
    if (!enrollment) {
      return res.status(404).json({ status: false, response: "failed", message: "Enrollment not found" });
    }

    if (enrollment.certificate_status === 1) {
      return res.status(400).json({ status: false, response: "failed", message: "Certificate request already submitted" });
    }

    enrollment.certificate_status = 1;
    enrollment.certificate_declined_reason = null;
    await enrollment.save();

    return res.status(200).json({ status: true, response: "success", message: "Certificate request submitted successfully" });
  } catch (error) {
    return res.status(500).json({ status: false, response: "error", message: error.message });
  }
};

const appVerifyCertificate = async (req, res) => {
  try {
    const { course_id, certificate_number } = req.body;

    if (!certificate_number) {
      return res.status(400).json({ status: false, response: "failed", message: "certificate_number is required" });
    }

    const filter = { certificate_no: certificate_number };
    if (course_id) filter.course_id = course_id;

    const enrollment = await Enrollment.findOne(filter)
      .populate("course_id", "ml_course_name")
      .populate("user_id", "c_first_name c_display_name");

    if (!enrollment) {
      return res.status(200).json({ status: false, response: "failed", message: "Certificate not found or invalid" });
    }

    const courseName = enrollment.course_id?.ml_course_name || "";
    const studentName = enrollment.user_id?.c_display_name || enrollment.user_id?.c_first_name || "";

    return res.status(200).json({
      status: true,
      response: "success",
      message: "Certificate verified",
      certificate: {
        certificate_number,
        course_name: courseName,
        student_name: studentName,
        approved_on: enrollment.certificate_approved_at
          ? enrollment.certificate_approved_at.toISOString().split("T")[0]
          : "",
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, response: "error", message: error.message });
  }
};

module.exports = {
  getEnrolledFreeCourses,
  getEnrolledPremiumCourses,
  getEnrolledCourseFullDetails,
  getCourseAccessDetails,
  appGetMyCourses,
  appGetEnrollmentStatus,
  appGetCertificateStatus,
  appRequestCertificate,
  appVerifyCertificate,
};
