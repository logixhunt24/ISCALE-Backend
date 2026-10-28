const mongoose = require("mongoose");
const Enrollment = require("../models/course_enrollment");
const Course = require("../models/course");

const Lecture = require("../models/lecture");

const LectureProgress = require("../models/lecture_progress");

const {
  generateCertificatePDF,
  generateUniqueCertNo,
} = require("../utils/certificateGenerator");

// const {
//   uploadFileWithMeta,
//   deleteFile,
//   uploadBufferToCloudinary
// } = require("../services/storageService");

const { deleteCertificateFile } = require("../services/storageService");
const Candidate = require("../models/candidates");
const { verify } = require("../utils/signedLink");
const { signedCertificateUrl, certificateUrlFor } = require("../utils/certificateLinks");

const fs = require("fs");

const path = require("path");

const os = require("os");

// =======================================================
// CALCULATE COURSE PROGRESS
// =======================================================

// A certificate can be requested once this much of the course is completed.
const MIN_PROGRESS = 90;

const calculateProgress = async (userId, courseId) => {
  const totalLectures = await Lecture.countDocuments({
    ml_course: courseId,
  });

  const completedLectures = await LectureProgress.countDocuments({
    user_id: userId,
    course_id: courseId,
    is_completed: true,
  });

  const progress =
    totalLectures === 0
      ? 0
      : Math.round((completedLectures / totalLectures) * 100);

  return progress;
};

// =======================================================
// GET CERTIFICATE STATUS
// =======================================================

const getCertificateStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const courseId = req.params.course_id;

    const enrollment = await Enrollment.findOne({
      user_id: userId,
      course_id: courseId,
    });

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    const progress = await calculateProgress(userId, courseId);

    return res.status(200).json({
      status: true,

      course_progress: progress,

      certificate_eligible: progress >= MIN_PROGRESS,

      certificate_status: enrollment.certificate_status,

      certificate_no: enrollment.certificate_no,

      certificate_pdf: certificateUrlFor(enrollment),

      declined_reason: enrollment.certificate_declined_reason,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// =======================================================
// REQUEST CERTIFICATE
// =======================================================

const requestCertificate = async (req, res) => {
  try {
    const userId = req.user.id;

    const { course_id } = req.body;

    const enrollment = await Enrollment.findOne({
      user_id: userId,
      course_id,
    });

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    if (enrollment.certificate_status === 2) {
      return res.status(400).json({
        status: false,
        message: "Your certificate is already issued",
      });
    }

    const progress = await calculateProgress(userId, course_id);

    if (progress < MIN_PROGRESS) {
      return res.status(400).json({
        status: false,
        message: `Minimum ${MIN_PROGRESS}% course completion required (you are at ${progress}%)`,
      });
    }

    // already pending
    if (enrollment.certificate_status === 1) {
      return res.status(400).json({
        status: false,
        message: "Certificate request already submitted",
      });
    }

    enrollment.certificate_status = 1;

    enrollment.certificate_declined_reason = null;

    await enrollment.save();

    return res.status(200).json({
      status: true,

      message: "Certificate request submitted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// =======================================================
// GET ALL CERTIFICATE REQUESTS
// =======================================================

const getCertificateRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const status = req.query.status;

    const course_id = req.query.course_id;

    const from_date = req.query.from_date;

    const to_date = req.query.to_date;

    const filter = {
      certificate_status: {
        $ne: 0,
      },
    };

    // =========================================
    // STATUS FILTER
    // =========================================

    if (status) {
      filter.certificate_status = Number(status);
    }

    // =========================================
    // COURSE FILTER
    // =========================================

    if (course_id) {
      filter.course_id = course_id;
    }

    // =========================================
    // DATE FILTER
    // =========================================

    if (from_date || to_date) {
      filter.createdAt = {};

      // only from date
      if (from_date) {
        filter.createdAt.$gte = new Date(from_date);
      }

      // only to date
      if (to_date) {
        const endDate = new Date(to_date);

        endDate.setHours(23, 59, 59, 999);

        filter.createdAt.$lte = endDate;
      }
    }

    let enrollments = await Enrollment.find(filter)

      .populate({
        path: "user_id",
        select: `
            c_first_name
            c_last_name
            c_email
          `,
      })

      .populate({
        path: "course_id",
        select: `
            m_course_title
          `,
      })

      .sort({
        createdAt: -1,
      })

      .skip(skip)

      .limit(limit)

      .lean();

    // search
    if (search) {
      const text = search.toLowerCase();

      enrollments = enrollments.filter((item) => {
        const student =
          `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`.toLowerCase();

        const course = item.course_id?.m_course_title?.toLowerCase() || "";

        return student.includes(text) || course.includes(text);
      });
    }

    const finalData = await Promise.all(
      enrollments.map(async (item) => {
        const progress = await calculateProgress(
          item.user_id?._id,
          item.course_id?._id,
        );

        return {
          enrollment_id: item._id,

          student_name: `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`,

          student_email: item.user_id?.c_email || null,

          course_name: item.course_id?.m_course_title || null,

          registration_date: item.enrolled_on,

          course_progress: progress,

          certificate_status: item.certificate_status || 1,

          certificate_no: item.certificate_no || null,

          certificate_pdf: certificateUrlFor(item),

          declined_reason: item.certificate_declined_reason || null,
        };
      }),
    );

    return res.status(200).json({
      status: true,

      current_page: page,

      total_records: await Enrollment.countDocuments(filter),

      data: finalData,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// =======================================================
// UPDATE CERTIFICATE STATUS
// =======================================================

const updateCertificateStatus = async (req, res) => {
  try {
    const enrollmentId = req.params.enrollment_id;
    const { status, declined_reason } = req.body;

    let message = "";

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate("user_id")
      .populate({
        path: "course_id",
        populate: {
          path: "m_course_category",
          model: "category",
        },
      });

    if (!enrollment) {
      return res
        .status(404)
        .json({ status: false, message: "Enrollment not found" });
    }

    // APPROVED
    if (Number(status) === 2) {
      // keep the number when re-approving so a certificate never changes under the student
      const uniqueCertNo = enrollment.certificate_no || (await generateUniqueCertNo(Enrollment));

      const userName = [enrollment.user_id.c_first_name, enrollment.user_id.c_last_name].filter(Boolean).join(" ");
      const courseTitle = enrollment.course_id.m_course_title;
      const categoryName =
        enrollment.course_id.m_course_category?.m_category_name || "bootcamp";
      const approvedAt = new Date();

      // Generate once now so a broken template/font fails here, in front of the admin,
      // instead of when the student tries to download.
      await generateCertificatePDF(userName, courseTitle, categoryName, uniqueCertNo, approvedAt);

      // older certificates were uploaded to Cloudinary; clean those up but never block on it
      if (enrollment.certificate_public_id) {
        await deleteCertificateFile(enrollment.certificate_public_id).catch(() => {});
      }

      enrollment.certificate_status = 2;
      enrollment.certificate_no = uniqueCertNo;
      enrollment.certificate_pdf = signedCertificateUrl(enrollment._id);
      enrollment.certificate_public_id = null;
      enrollment.certificate_approved_at = approvedAt;
      enrollment.certificate_declined_reason = null;

      message = "Certificate approved successfully";
    }

        else if (Number(status) === 3) {
      if (enrollment.certificate_public_id) {
        await deleteCertificateFile(enrollment.certificate_public_id).catch(() => {});
      }

      enrollment.certificate_status = 3;

      enrollment.certificate_declined_reason =
        declined_reason || "Criteria not met";

      enrollment.certificate_no = null;

      enrollment.certificate_pdf = null;

      enrollment.certificate_public_id = null;

      message = "Certificate declined successfully";
    }

    
    else {
      if (enrollment.certificate_public_id) {
        await deleteCertificateFile(enrollment.certificate_public_id).catch(() => {});
      }

      enrollment.certificate_status = 1;

      enrollment.certificate_no = null;

      enrollment.certificate_pdf = null;

      enrollment.certificate_public_id = null;

      message = "Certificate marked as pending";
    }

    await enrollment.save();

    return res.status(200).json({
      status: true,
      message,
      data: {
        cert_no: enrollment.certificate_no,
        pdf_url: certificateUrlFor(enrollment),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: false,
      message: "Error: " + error.message,
    });
  }
};

// =======================================================
// DOWNLOAD CERTIFICATE
// =======================================================

// Builds the certificate PDF for an approved enrolment. Returns { error, code } instead of a PDF
// when it cannot be issued.
const buildCertificate = async (enrollment) => {
  if (!enrollment) return { code: 404, error: "Certificate not found" };
  if (enrollment.certificate_status !== 2 || !enrollment.certificate_no) {
    return { code: 400, error: "Certificate not approved yet" };
  }

  const [student, course] = await Promise.all([
    Candidate.findById(enrollment.user_id).select("c_first_name c_last_name c_display_name").lean(),
    Course.findById(enrollment.course_id)
      .select("m_course_title m_course_category")
      .populate({ path: "m_course_category", select: "m_category_name" })
      .lean(),
  ]);

  const name =
    [student?.c_first_name, student?.c_last_name].filter(Boolean).join(" ") || student?.c_display_name;
  if (!name || !course) return { code: 409, error: "Student or course details are missing" };

  const pdf = await generateCertificatePDF(
    name,
    course.m_course_title,
    course.m_course_category?.m_category_name || "bootcamp",
    enrollment.certificate_no,
    enrollment.certificate_approved_at || enrollment.updatedAt,
  );
  return { pdf: Buffer.from(pdf), certNo: enrollment.certificate_no };
};

const sendCertificate = (res, { pdf, certNo }) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Certificate_${certNo}.pdf"`);
  res.setHeader("Content-Length", pdf.length);
  res.setHeader("Cache-Control", "private, no-store");
  return res.end(pdf);
};

// GET /certificate/download/:course_id  — the logged-in student's own certificate
const downloadMyCertificate = async (req, res) => {
  try {
    const enrollment = await Enrollment.findOne({ user_id: req.user.id, course_id: req.params.course_id });
    if (!enrollment) return res.status(404).json({ status: false, message: "Enrollment not found" });

    const built = await buildCertificate(enrollment);
    if (built.error) return res.status(built.code).json({ status: false, message: built.error });
    return sendCertificate(res, built);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// GET /certificate/signed/:enrollment_id?sig=...  — link used by the admin panel and the mobile app
const downloadSignedCertificate = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(enrollment_id) || !verify("certificate", enrollment_id, req.query.sig)) {
      return res.status(404).json({ status: false, message: "Certificate not found" });
    }
    const built = await buildCertificate(await Enrollment.findById(enrollment_id));
    if (built.error) return res.status(built.code).json({ status: false, message: built.error });
    return sendCertificate(res, built);
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

module.exports = {
  getCertificateStatus,
  requestCertificate,
  getCertificateRequests,
  updateCertificateStatus,
  downloadMyCertificate,
  downloadSignedCertificate,
};
