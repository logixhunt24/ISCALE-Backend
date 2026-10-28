const Enrollment = require("../models/course_enrollment");
const Lecture = require("../models/lecture");
const LectureProgress = require("../models/lecture_progress");
const TestPackageEnrollment = require("../models/test_package_enrollment");
const TestPackage = require("../models/test_package");
const NotesEnrollment = require("../models/notes_enrollment");
const Notes = require("../models/notes");
const EventEnrollment = require("../models/event_enrollment");
const Event = require("../models/event");
const JobApplication = require("../models/company_requirement_application");
const Coupon = require("../models/coupon");
const Candidate = require("../models/candidates");
const { certificateUrlFor } = require("../utils/certificateLinks");
const Job = require("../models/company_requirement");
const mongoose = require("mongoose");

const getCourseRegistrations = async (req, res) => {
  try {
    // QUERY PARAMS

    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const course_id = req.query.course_id;

    const from_date = req.query.from_date;

    const to_date = req.query.to_date;

    const sortBy = req.query.sortBy || "createdAt";

    const order = req.query.order === "asc" ? 1 : -1;

    // FILTER
    const filter = {};

    // course filter
    if (course_id) {
      filter.course_id = course_id;
    }

    // DATE FILTER

    if (from_date || to_date) {
      filter.createdAt = {};

      // from date
      if (from_date) {
        filter.createdAt.$gte = new Date(from_date);
      }

      // to date
      if (to_date) {
        const endDate = new Date(to_date);

        endDate.setHours(23, 59, 59, 999);

        filter.createdAt.$lte = endDate;
      }
    }

    // GET ENROLLMENTS

    let enrollments = await Enrollment.find(filter)

      .populate({
        path: "user_id",
        select: `
            c_first_name
            c_last_name
            c_email
            c_contact
          `,
      })

      .populate({
        path: "course_id",
        select: `
            m_course_title
            m_course_price
            m_course_offer_price
            m_course_duration_app
            m_course_duration_web
          `,
      })

      .populate({
        path: "batch_id",
        select: `
    batch_name
    batch_instructor
    start_time
    end_time
    strength
    subject
  `,
      })

      .populate({
        path: "coupon_id",
        select: `
    _id
    coupon_code
    coupon_title
    coupon_type
    coupon_discount_type
    coupon_discount
  `,
      })

      .sort({
        [sortBy]: order,
      })

      .skip(skip)

      .limit(limit)

      .lean();

    // SEARCH FILTER

    if (search) {
      const searchText = search.toLowerCase();

      enrollments = enrollments.filter((item) => {
        const studentName =
          `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`.toLowerCase();

        const email = item.user_id?.c_email?.toLowerCase() || "";

        const phone = String(item.user_id?.c_contact || "");

        const courseName = item.course_id?.m_course_title?.toLowerCase() || "";

        return (
          studentName.includes(searchText) ||
          email.includes(searchText) ||
          phone.includes(searchText) ||
          courseName.includes(searchText)
        );
      });
    }

    // DYNAMIC PROGRESS

    const finalData = await Promise.all(
      enrollments.map(async (enrollment) => {
        // total lectures
        const totalLectures = await Lecture.countDocuments({
          ml_course: enrollment.course_id?._id,
        });

        // completed lectures
        const completedLectures = await LectureProgress.countDocuments({
          user_id: enrollment.user_id?._id,

          course_id: enrollment.course_id?._id,

          is_completed: true,
        });

        // progress %
        const progress =
          totalLectures === 0
            ? 0
            : Math.round((completedLectures / totalLectures) * 100);

        return {
          enrollment_id: enrollment._id,

          // STUDENT

          student_name: `${enrollment.user_id?.c_first_name || ""} ${enrollment.user_id?.c_last_name || ""}`,

          student_email: enrollment.user_id?.c_email || null,

          student_phone: enrollment.user_id?.c_contact || null,

          // COURSE

          course_id: enrollment.course_id?._id || null,

          course_name: enrollment.course_id?.m_course_title || null,

          registration_date: enrollment.enrolled_on,

          // PAYMENT

          course_amount:
            enrollment.original_amount ||
            enrollment.course_id?.m_course_price ||
            0,

          offer_amount:
            enrollment.offer_amount ||
            enrollment.course_id?.m_course_offer_price ||
            0,

          discount_amount: enrollment.discount_amount || 0,

          payable_amount: enrollment.payable_amount || enrollment.amount || 0,

          // PROGRESS
          total_lectures: totalLectures,

          completed_lectures: completedLectures,

          course_progress: progress,

          // BATCH
          batch_id: enrollment.batch_id?._id || null,

          batch_name: enrollment.batch_id?.batch_name || null,

          batch_instructor: enrollment.batch_id?.batch_instructor || null,

          batch_start_time: enrollment.batch_id?.start_time || null,

          batch_end_time: enrollment.batch_id?.end_time || null,

          batch_strength: enrollment.batch_id?.strength || 0,

          batch_subject: enrollment.batch_id?.subject || null,

          // CERTIFICATE
          // 0 not requested, 1 pending, 2 approved, 3 declined
          certificate_status: enrollment.certificate_status || 0,
          certificate_no: enrollment.certificate_no || "",
          certificate_pdf: certificateUrlFor(enrollment) || "",
          declined_reason: enrollment.certificate_declined_reason || "",

          // if coupon is available
          coupon: enrollment.coupon_id
            ? {
                _id: enrollment.coupon_id._id,
                coupon_code: enrollment.coupon_id.coupon_code,
                coupon_title: enrollment.coupon_id.coupon_title,
                coupon_type: enrollment.coupon_id.coupon_type,
                coupon_discount_type: enrollment.coupon_id.coupon_discount_type,
                coupon_discount: enrollment.coupon_id.coupon_discount,
              }
            : null,

          // ACCESS
          access_type: enrollment.access_type || "lifetime",

          expiry_date: enrollment.expiry_date || null,

          days_left:
            enrollment.access_type === "limited" && enrollment.expiry_date
              ? Math.max(
                  0,
                  Math.ceil(
                    (new Date(enrollment.expiry_date) - new Date()) /
                      (1000 * 60 * 60 * 24),
                  ),
                )
              : null,

          // STATUS
          enrollment_status: enrollment.status,

          createdAt: enrollment.createdAt,
        };
      }),
    );

    // TOTAL COUNT

    const total = await Enrollment.countDocuments(filter);

    return res.status(200).json({
      status: true,

      message: "Course registrations fetched successfully",

      current_page: page,

      total_pages: Math.ceil(total / limit),

      total_records: total,

      data: finalData,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const deleteCourseEnrollment = async (req, res) => {
  try {
    const enrollmentId = req.params.id;

    // Check enrollment
    const enrollment = await Enrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Course enrollment not found",
      });
    }

    // Delete enrollment
    await Enrollment.findByIdAndDelete(enrollmentId);

    return res.status(200).json({
      status: true,
      message: "Course enrollment deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const getCoursePurchaseDetails = async (req, res) => {
  try {
    const enrollmentId = req.params.enrollment_id;

    const enrollment = await Enrollment.findById(enrollmentId)
      .populate({
        path: "user_id",
        select: `
          c_first_name
          c_last_name
          c_email
          c_contact
          c_address
          c_alt_contact
          c_city
        `,
      })
      .populate({
        path: "course_id",
        select: `
          m_course_title
          m_course_code
          m_course_type
          m_course_price
          m_course_offer_price
          m_course_description
        `,
      })
      .lean();

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    const totalLectures = await Lecture.countDocuments({
      ml_course: enrollment.course_id?._id,
    });

    const completedLectures = await LectureProgress.countDocuments({
      user_id: enrollment.user_id?._id,
      course_id: enrollment.course_id?._id,
      is_completed: true,
    });

    const progress =
      totalLectures === 0
        ? 0
        : Math.round((completedLectures / totalLectures) * 100);

    return res.status(200).json({
      status: true,

      data: {
        // =====================
        // STUDENT DETAILS
        // =====================
        student: {
          name: `${enrollment.user_id?.c_first_name || ""} ${enrollment.user_id?.c_last_name || ""}`,
          email: enrollment.user_id?.c_email,
          phone: enrollment.user_id?.c_contact,
          alt_phone: enrollment.user_id?.c_alt_contact || null,
          address: `${enrollment.user_id?.c_current_address1 || ""} ${enrollment.user_id?.c_current_address2 || ""}`,
          city: enrollment.user_id?.c_current_city,
        },

        // =====================
        // COURSE DETAILS
        // =====================
        course: {
          title: enrollment.course_id?.m_course_title,
          code: enrollment.course_id?.m_course_code,
          type: enrollment.course_id?.m_course_type,
          price: enrollment.course_id?.m_course_price,
          offer_price: enrollment.course_id?.m_course_offer_price,
          description: enrollment.course_id?.m_course_description,
        },

        // =====================
        // REGISTRATION DETAILS
        // =====================
        registration: {
          registration_date: enrollment.enrolled_on,
          access_type: enrollment.access_type,
          expiry_date: enrollment.expiry_date,
          progress: progress,
        },

        // =====================
        // PAYMENT DETAILS
        // =====================
        payment: {
          purchased_price: enrollment.amount,
          original_price: enrollment.original_amount,
          discount: enrollment.discount_amount,
          coupon: enrollment.coupon_code,
          payment_status: enrollment.payment_status,
          payment_mode: enrollment.payment_mode || "online",
          transaction_id: enrollment.transaction_id || null,
          remark: enrollment.remark || null,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const getAllTestPackageEnrollments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const payment_status = req.query.payment_status;

    const package_id = req.query.package_id;

    const filter = {};

    // =========================
    // FILTERS
    // =========================

    if (payment_status) {
      filter.payment_status = Number(payment_status);
    }

    if (package_id) {
      filter.test_package_id = package_id;
    }

    let data = await TestPackageEnrollment.find(filter)
      .populate({
        path: "user_id",
        select: `
            c_first_name
            c_last_name
            c_email
            c_contact
          `,
      })
      .populate({
        path: "test_package_id",
        select: `
            m_package_title
            m_package_type
          `,
      })
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean();

    // =========================
    // SEARCH
    // =========================

    if (search) {
      const text = search.toLowerCase();

      data = data.filter((item) => {
        const userName =
          `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`.toLowerCase();

        const email = item.user_id?.c_email?.toLowerCase() || "";

        const packageName =
          item.test_package_id?.m_package_title?.toLowerCase() || "";

        return (
          userName.includes(text) ||
          email.includes(text) ||
          packageName.includes(text)
        );
      });
    }

    const totalRecords = await TestPackageEnrollment.countDocuments(filter);

    return res.status(200).json({
      status: true,

      current_page: page,

      total_records: totalRecords,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const getSingleTestPackageEnrollment = async (req, res) => {
  try {
    const enrollmentId = req.params.id;

    const data = await TestPackageEnrollment.findById(enrollmentId)
      .populate({
        path: "user_id",
        select: `
              c_first_name
              c_last_name
              c_email
              c_contact
              c_alt_contact
              c_current_city
              c_current_address1
            `,
      })
      .populate({
        path: "test_package_id",
        populate: [
          {
            path: "m_package_course",
            select: `
                  m_course_title
                `,
          },
          {
            path: "m_package_test_category",
            select: `
                  test_categoryName
                `,
          },
        ],
      });

    if (!data) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    return res.status(200).json({
      status: true,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const deleteTestPackageEnrollment = async (req, res) => {
  try {
    const enrollmentId = req.params.id;

    const enrollment = await TestPackageEnrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({
        status: false,

        message: "Enrollment not found",
      });
    }

    await TestPackageEnrollment.findByIdAndDelete(enrollmentId);

    return res.status(200).json({
      status: true,

      message: "Test package enrollment deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const changeTestPackageAccessStatus = async (req, res) => {
  try {
    const enrollmentId = req.params.id;

    // =========================
    // FIND ENROLLMENT
    // =========================

    const enrollment = await TestPackageEnrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    // =========================
    // TOGGLE STATUS
    // =========================

    enrollment.access_status = enrollment.access_status === 1 ? 0 : 1;

    await enrollment.save();

    return res.status(200).json({
      status: true,

      message: `Access status changed to ${enrollment.access_status}`,

      data: {
        _id: enrollment._id,

        access_status: enrollment.access_status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const getNotesRegistrations = async (req, res) => {
  try {
    // ======================================================
    // QUERY PARAMS
    // ======================================================

    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const notes_id = req.query.notes_id || "";

    const enrollment_status = req.query.enrollment_status || "";

    const from_date = req.query.from_date;

    const to_date = req.query.to_date;

    const sortBy = req.query.sortBy || "createdAt";

    const order = req.query.order === "asc" ? 1 : -1;

    // ======================================================
    // FILTER
    // ======================================================

    let filter = {};

    // =========================
    // NOTES FILTER
    // =========================

    if (notes_id) {
      filter.notes_id = notes_id;
    }

    // =========================
    // STATUS FILTER
    // =========================

    if (enrollment_status) {
      filter.enrollment_status = Number(enrollment_status);
    }

    // =========================
    // DATE FILTER
    // =========================

    if (from_date || to_date) {
      filter.createdAt = {};

      // from date
      if (from_date) {
        filter.createdAt.$gte = new Date(from_date);
      }

      // to date
      if (to_date) {
        const endDate = new Date(to_date);

        endDate.setHours(23, 59, 59, 999);

        filter.createdAt.$lte = endDate;
      }
    }

    // ======================================================
    // GET ENROLLMENTS
    // ======================================================

    let enrollments = await NotesEnrollment.find(filter)

      .populate({
        path: "user_id",
        select: `
        c_first_name
        c_last_name
        c_email
        c_contact
        c_alt_contact
        c_current_city
        c_current_address1
      `,
      })

      .populate({
        path: "notes_id",
        populate: [
          {
            path: "notes_category_id",
            select: `
            nc_name
          `,
          },
          {
            path: "notes_subcategory_id",
            select: `
            notes_subcategory_name
          `,
          },
        ],
      })

      .sort({
        [sortBy]: order,
      })

      .skip(skip)

      .limit(limit)

      .lean();

    // ======================================================
    // SEARCH FILTER
    // ======================================================

    if (search) {
      const text = search.toLowerCase();

      enrollments = enrollments.filter((item) => {
        const studentName =
          `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`.toLowerCase();

        const email = item.user_id?.c_email?.toLowerCase() || "";

        const phone = String(item.user_id?.c_contact || "");

        const notesName = item.notes_id?.notes_name?.toLowerCase() || "";

        const category =
          item.notes_id?.notes_category_id?.nc_name?.toLowerCase() || "";

        const subCategory =
          item.notes_id?.notes_subcategory_id?.notes_subcategory_name?.toLowerCase() ||
          "";

        return (
          studentName.includes(text) ||
          email.includes(text) ||
          phone.includes(text) ||
          notesName.includes(text) ||
          category.includes(text) ||
          subCategory.includes(text)
        );
      });
    }

    // ======================================================
    // FINAL RESPONSE DATA
    // ======================================================

    const finalData = enrollments.map((item) => {
      return {
        enrollment_id: item._id,

        // =========================
        // USER DETAILS
        // =========================

        user: {
          _id: item.user_id?._id || null,

          name: `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`,

          email: item.user_id?.c_email || null,

          phone: item.user_id?.c_contact || null,

          alt_phone: item.user_id?.c_alt_contact || null,

          city: item.user_id?.c_current_city || null,

          address: item.user_id?.c_current_address1 || null,
        },

        // =========================
        // NOTES DETAILS
        // =========================

        notes: {
          _id: item.notes_id?._id || null,

          notes_name: item.notes_id?.notes_name || null,

          notes_image: item.notes_id?.notes_image || null,

          notes_pdf: item.notes_id?.notes_pdf || null,

          notes_price: item.notes_id?.notes_price || 0,

          notes_offer_price: item.notes_id?.notes_offer_price || 0,

          category: item.notes_id?.notes_category_id?.nc_name || null,

          subcategory:
            item.notes_id?.notes_subcategory_id?.notes_subcategory_name || null,
        },

        // =========================
        // ENROLLMENT DETAILS
        // =========================

        enrollment_status: item.enrollment_status || 1,

        enrolled_at: item.enrolled_at || item.createdAt,

        createdAt: item.createdAt,
      };
    });

    // ======================================================
    // TOTAL RECORDS
    // ======================================================

    const totalRecords = await NotesEnrollment.countDocuments(filter);

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).json({
      status: true,

      message: "Notes registrations fetched successfully",

      current_page: page,

      total_pages: Math.ceil(totalRecords / limit),

      total_records: totalRecords,

      data: finalData,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const deleteNotesEnrollment = async (req, res) => {
  try {
    const enrollmentId = req.params.id;

    // =========================
    // FIND ENROLLMENT
    // =========================

    const enrollment = await NotesEnrollment.findById(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({
        status: false,

        message: "Notes enrollment not found",
      });
    }

    // =========================
    // DELETE
    // =========================

    await NotesEnrollment.findByIdAndDelete(enrollmentId);

    return res.status(200).json({
      status: true,

      message: "Notes enrollment deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const getAllEventRegistrations = async (req, res) => {
  try {
    // ======================================================
    // QUERY PARAMS
    // ======================================================

    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const event_id = req.query.event_id;

    const status = req.query.status;

    const from_date = req.query.from_date;

    const to_date = req.query.to_date;

    const sortBy = req.query.sortBy || "createdAt";

    const order = req.query.order === "asc" ? 1 : -1;

    // ======================================================
    // FILTER
    // ======================================================

    const filter = {};

    // ======================================================
    // EVENT FILTER
    // ======================================================

    if (event_id) {
      filter.event_id = event_id;
    }

    // ======================================================
    // STATUS FILTER
    // ======================================================

    if (status) {
      filter.status = status;
    }

    // ======================================================
    // DATE FILTER
    // ======================================================

    if (from_date || to_date) {
      filter.createdAt = {};

      // FROM DATE
      if (from_date) {
        filter.createdAt.$gte = new Date(from_date);
      }

      // TO DATE
      if (to_date) {
        const endDate = new Date(to_date);

        endDate.setHours(23, 59, 59, 999);

        filter.createdAt.$lte = endDate;
      }
    }

    // ======================================================
    // GET REGISTRATIONS
    // ======================================================

    let data = await EventEnrollment.find(filter)

      .populate({
        path: "user_id",

        select: `
          c_first_name
          c_last_name
          c_email
          c_contact
          c_alt_contact
          c_current_city
          c_current_address1
          c_current_address2
        `,
      })

      .populate({
        path: "event_id",

        select: `
          m_event_title
          m_event_banner
          m_event_date_start
          m_event_date_end
          m_event_time_start
          m_event_time_end
          m_event_skill_level
          m_event_certificate
          m_event_lang
          m_event_host
          m_event_status
        `,
      })

      .sort({
        [sortBy]: order,
      })

      .skip(skip)

      .limit(limit)

      .lean();

    // ======================================================
    // SEARCH
    // ======================================================

    if (search) {
      const text = search.toLowerCase();

      data = data.filter((item) => {
        const userName =
          `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`.toLowerCase();

        const email = item.user_id?.c_email?.toLowerCase() || "";

        const phone = String(item.user_id?.c_contact || "");

        const eventTitle = item.event_id?.m_event_title?.toLowerCase() || "";

        return (
          userName.includes(text) ||
          email.includes(text) ||
          phone.includes(text) ||
          eventTitle.includes(text)
        );
      });
    }

    // ======================================================
    // FINAL DATA
    // ======================================================

    const finalData = data.map((item) => {
      return {
        registration_id: item._id,

        // =====================================
        // USER DETAILS
        // =====================================

        user: {
          user_id: item.user_id?._id || null,

          full_name: `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`,

          email: item.user_id?.c_email || null,

          mobile: item.user_id?.c_contact || null,
        },

        // =====================================
        // EVENT DETAILS
        // =====================================

        event: {
          event_id: item.event_id?._id || null,

          title: item.event_id?.m_event_title || null,

          banner: item.event_id?.m_event_banner || null,

          start_date: item.event_id?.m_event_date_start || null,

          end_date: item.event_id?.m_event_date_end || null,

          start_time: item.event_id?.m_event_time_start || null,

          end_time: item.event_id?.m_event_time_end || null,

          host: item.event_id?.m_event_host || null,

          language: item.event_id?.m_event_lang || null,

          skill_level: item.event_id?.m_event_skill_level || null,

          certificate: item.event_id?.m_event_certificate || null,

          event_status: item.event_id?.m_event_status || null,
        },

        // =====================================
        // REGISTRATION
        // =====================================

        enrollment_date: item.enrolled_on,

        registration_status: item.status,

        createdAt: item.createdAt,
      };
    });

    // ======================================================
    // TOTAL
    // ======================================================

    const totalRecords = await EventEnrollment.countDocuments(filter);

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).json({
      status: true,

      message: "Event registrations fetched successfully",

      current_page: page,

      total_pages: Math.ceil(totalRecords / limit),

      total_records: totalRecords,

      data: finalData,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const getSingleEventRegistration = async (req, res) => {
  try {
    const registrationId = req.params.id;

    const data = await EventEnrollment.findById(registrationId)

      .populate({
        path: "user_id",

        select: `
          c_first_name
          c_last_name
          c_email
          c_contact
          c_alt_contact
          c_current_city
          c_current_address1
          c_current_address2
        `,
      })

      .populate({
        path: "event_id",
      })

      .lean();

    if (!data) {
      return res.status(404).json({
        status: false,

        message: "Event registration not found",
      });
    }

    return res.status(200).json({
      status: true,

      data: {
        registration_id: data._id,

        // =====================================
        // USER
        // =====================================

        user: {
          user_id: data.user_id?._id || null,

          first_name: data.user_id?.c_first_name || null,

          last_name: data.user_id?.c_last_name || null,

          full_name: `${data.user_id?.c_first_name || ""} ${data.user_id?.c_last_name || ""}`,

          email: data.user_id?.c_email || null,

          mobile: data.user_id?.c_contact || null,

          alternate_mobile: data.user_id?.c_alt_contact || null,

          city: data.user_id?.c_current_city || null,

          address: `
            ${data.user_id?.c_current_address1 || ""}
            ${data.user_id?.c_current_address2 || ""}
          `,
        },

        // =====================================
        // EVENT
        // =====================================

        event: data.event_id,

        // =====================================
        // REGISTRATION
        // =====================================

        enrolled_on: data.enrolled_on,

        registration_status: data.status,

        createdAt: data.createdAt,

        updatedAt: data.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const deleteEventRegistration = async (req, res) => {
  try {
    const registrationId = req.params.id;

    const registration = await EventEnrollment.findById(registrationId);

    if (!registration) {
      return res.status(404).json({
        status: false,

        message: "Event registration not found",
      });
    }

    // ======================================================
    // OPTIONAL:
    // EVENT ENROLL COUNT DECREASE
    // ======================================================

    await Event.findByIdAndUpdate(registration.event_id, {
      $inc: {
        m_event_no_of_enroll: -1,
      },
    });

    // ======================================================
    // DELETE
    // ======================================================

    await EventEnrollment.findByIdAndDelete(registrationId);

    return res.status(200).json({
      status: true,

      message: "Event registration deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const getAllJobApplications = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      job_id,
      company_name,
      from_date,
      to_date,
    } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {};

    // JOB FILTER
    if (job_id) {
      filter.job_id = job_id;
    }

    // DATE FILTER
    if (from_date || to_date) {
      filter.applied_at = {};

      if (from_date) {
        filter.applied_at.$gte = new Date(from_date);
      }

      if (to_date) {
        const endDate = new Date(to_date);
        endDate.setHours(23, 59, 59, 999);
        filter.applied_at.$lte = endDate;
      }
    }

    // DB SEARCH
    if (search) {
      const regex = new RegExp(search, "i");

      const candidateIds = await Candidate.find({
        $or: [
          { c_first_name: regex },
          { c_last_name: regex },
          { c_email: regex },
          // { c_contact: regex },
        ],
      }).distinct("_id");

      const jobIds = await Job.find({
        $or: [{ job_title: regex }, { company_name: regex }],
      }).distinct("_id");

      filter.$or = [
        { user_id: { $in: candidateIds } },
        { job_id: { $in: jobIds } },
      ];
    }

    // COMPANY FILTER
    if (company_name) {
      const companyJobIds = await Job.find({
        company_name: {
          $regex: company_name,
          $options: "i",
        },
      }).distinct("_id");

      filter.job_id = {
        $in: companyJobIds,
      };
    }

    // TOTAL RECORDS
    const totalRecords = await JobApplication.countDocuments(filter);

    // DATA
    const data = await JobApplication.find(filter)
      .populate({
        path: "user_id",
        select: `
          c_first_name
          c_last_name
          c_email
          c_contact
          c_current_city
        `,
      })
      .populate({
        path: "job_id",
        select: `
          job_title
          company_name
          job_locations
          salary
          experience
        `,
      })
      .sort({
        applied_at: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      status: true,
      current_page: page,
      total_pages: Math.ceil(totalRecords / limit),
      total_records: totalRecords,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const getSingleJobApplication = async (req, res) => {
  try {
    const applicationId = req.params.id;

    const data = await JobApplication.findById(applicationId)

      .populate({
        path: "user_id",

        select: `
            c_first_name
            c_last_name
            c_email
            c_contact
            c_alt_contact
            c_current_city
            c_current_address1
            c_current_address2
          `,
      })

      .populate({
        path: "job_id",
      });

    if (!data) {
      return res.status(404).json({
        status: false,

        message: "Job application not found",
      });
    }

    return res.status(200).json({
      status: true,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const deleteJobApplication = async (req, res) => {
  try {
    const applicationId = req.params.id;

    const application = await JobApplication.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        status: false,

        message: "Job application not found",
      });
    }

    await JobApplication.findByIdAndDelete(applicationId);

    return res.status(200).json({
      status: true,

      message: "Job application deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const toggleAppStatus = async (req, res) => {
  try {
    const { enrollment_id } = req.params;

    const enrollment = await Enrollment.findById(enrollment_id);

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    enrollment.app_status = enrollment.app_status === 1 ? 0 : 1;

    await enrollment.save();

    return res.status(200).json({
      status: true,
      message: "App status updated successfully",
      app_status: enrollment.app_status,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const toggleAndroidStatus = async (req, res) => {
  try {
    const { enrollment_id } = req.params;

    const enrollment = await Enrollment.findById(enrollment_id);

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    enrollment.android_status = enrollment.android_status === 1 ? 0 : 1;

    await enrollment.save();

    return res.status(200).json({
      status: true,
      message: "Android status updated successfully",
      android_status: enrollment.android_status,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const toggleIosStatus = async (req, res) => {
  try {
    const { enrollment_id } = req.params;

    const enrollment = await Enrollment.findById(enrollment_id);

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    enrollment.ios_status = enrollment.ios_status === 1 ? 0 : 1;

    await enrollment.save();

    return res.status(200).json({
      status: true,
      message: "IOS status updated successfully",
      ios_status: enrollment.ios_status,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const toggleTestSeriesStatus = async (req, res) => {
  try {
    const { enrollment_id } = req.params;

    const enrollment = await Enrollment.findById(enrollment_id);

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    enrollment.test_series_status = enrollment.test_series_status === 1 ? 0 : 1;

    await enrollment.save();

    return res.status(200).json({
      status: true,
      message: "Test series status updated successfully",
      test_series_status: enrollment.test_series_status,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const toggleLiveClassStatus = async (req, res) => {
  try {
    const { enrollment_id } = req.params;

    const enrollment = await Enrollment.findById(enrollment_id);

    if (!enrollment) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    enrollment.live_class_status = enrollment.live_class_status === 1 ? 0 : 1;

    await enrollment.save();

    return res.status(200).json({
      status: true,
      message: "Live class status updated successfully",
      live_class_status: enrollment.live_class_status,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

module.exports = {
  getCourseRegistrations,
  deleteCourseEnrollment,
  getCoursePurchaseDetails,
  getAllTestPackageEnrollments,
  getSingleTestPackageEnrollment,
  deleteTestPackageEnrollment,
  changeTestPackageAccessStatus,
  getNotesRegistrations,
  deleteNotesEnrollment,
  getAllEventRegistrations,
  getSingleEventRegistration,
  deleteEventRegistration,
  getAllJobApplications,
  getSingleJobApplication,
  deleteJobApplication,
  toggleAppStatus,
  toggleAndroidStatus,
  toggleIosStatus,
  toggleTestSeriesStatus,
  toggleLiveClassStatus,
};
