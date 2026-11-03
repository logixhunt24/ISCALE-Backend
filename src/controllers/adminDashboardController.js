const Candidate = require("../models/candidates");
const Course = require("../models/course");
const Quiz = require("../models/quizs");
const CourseEnrollment = require("../models/course_enrollment");
const TestPackageEnrollment = require("../models/test_package_enrollment");
const NotesEnrollment = require("../models/notes_enrollment");

const getDashboardStats = async (req, res) => {
  try {
    const [totalRegistrations, totalCourses, totalQuizzes, totalNotesSale] =
      await Promise.all([
        Candidate.countDocuments(),

        Course.countDocuments({
          m_course_status: 1,
        }),

        Quiz.countDocuments({
          m_quiz_status: 1,
        }),

        NotesEnrollment.countDocuments(),
      ]);

    const courseData = await CourseEnrollment.aggregate([
      {
        $match: {
          payment_status: 1,
        },
      },
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: 1,
          },
          totalRevenue: {
            $sum: "$payable_amount",
          },
        },
      },
    ]);

    const packageData = await TestPackageEnrollment.aggregate([
      {
        $match: {
          payment_status: 1,
        },
      },
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: 1,
          },
          totalRevenue: {
            $sum: "$payable_amount",
          },
        },
      },
    ]);

    const totalCourseSale =
      courseData.length > 0 ? courseData[0].totalSales : 0;

    const courseRevenue =
      courseData.length > 0 ? courseData[0].totalRevenue : 0;

    const totalPackageSale =
      packageData.length > 0 ? packageData[0].totalSales : 0;

    const packageRevenue =
      packageData.length > 0 ? packageData[0].totalRevenue : 0;

    const totalEarnings = courseRevenue + packageRevenue;

    return res.status(200).json({
      success: true,
      data: {
        totalRegistrations,
        totalCourses,
        totalQuizzes,
        totalEarnings,
        totalCourseSale,
        totalPackageSale,
        totalNotesSale,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Registrations over a chosen range, bucketed for the dashboard chart:
// 7D / 30D = per day, 90D = per week (13 weeks), 1Y = per month (12 months).
// Days are counted in India time so "today" matches the admin's calendar.
const TZ = "Asia/Kolkata";
const dayKey = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const dayLabel = (d) =>
  d.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "short" });

const getRegistrationsByRange = async (req, res, range) => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date();
  const daysBack = (n) => new Date(now.getTime() - n * DAY);

  let buckets; // [{ name, match: (dayKey) => boolean }]
  if (range === "7D" || range === "30D") {
    const n = range === "7D" ? 7 : 30;
    buckets = Array.from({ length: n }, (_, i) => {
      const d = daysBack(n - 1 - i);
      const key = dayKey(d);
      return { name: dayLabel(d), match: (k) => k === key };
    });
  } else if (range === "90D") {
    buckets = Array.from({ length: 13 }, (_, w) => {
      const keys = new Set();
      for (let i = (12 - w) * 7; i < (12 - w) * 7 + 7; i++) keys.add(dayKey(daysBack(i)));
      return { name: dayLabel(daysBack((12 - w) * 7 + 6)), match: (k) => keys.has(k) };
    });
  } else {
    const [y, m] = dayKey(now).split("-").map(Number); // current IST year / month
    buckets = Array.from({ length: 12 }, (_, i) => {
      const first = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
      const prefix = first.toISOString().slice(0, 7); // YYYY-MM
      return {
        name: first.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short", year: "2-digit" }),
        match: (k) => k.startsWith(prefix),
      };
    });
  }

  const perDay = await Candidate.aggregate([
    { $match: { c_register_date: { $gte: daysBack(range === "1Y" ? 400 : range === "90D" ? 95 : 35) } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$c_register_date", timezone: TZ } },
        count: { $sum: 1 },
      },
    },
  ]);

  const data = buckets.map((b) => {
    const count = perDay.reduce((sum, d) => (b.match(d._id) ? sum + d.count : sum), 0);
    return { name: b.name, month: b.name, count };
  });
  return res.status(200).json({ success: true, data });
};

const getMonthWiseRegistrations = async (req, res) => {
  try {
    const range = String(req.query.range || "").toUpperCase();
    if (["7D", "30D", "90D", "1Y"].includes(range)) {
      return await getRegistrationsByRange(req, res, range);
    }

    const currentYear = new Date().getFullYear();

    const registrations = await Candidate.aggregate([
      {
        $match: {
          c_register_date: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: {
            month: {
              $month: "$c_register_date",
            },
          },
          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const graphData = months.map((month, index) => {
      const found = registrations.find((item) => item._id.month === index + 1);

      return {
        month,
        count: found ? found.count : 0,
      };
    });

    return res.status(200).json({
      success: true,
      data: graphData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTopCourses = async (req, res) => {
  try {
    const topCourses = await CourseEnrollment.aggregate([
      {
        $match: {
          payment_status: 1,
        },
      },

      {
        $group: {
          _id: "$course_id",
          total_registrations: { $sum: 1 },
        },
      },

      {
        $sort: {
          total_registrations: -1,
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
          _id: 0,

          course_id: "$course._id",

          course_name: "$course.m_course_title",

          category: {
            _id: "$category._id",
            name: "$category.m_category_name",
          },

          total_registrations: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      total: topCourses.length,
      data: topCourses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getRecentActivities = async (req, res) => {
  try {
    const [latestCandidates, latestEnrollments] = await Promise.all([
      // Latest 10 Registrations
      Candidate.find()
        .select(
          "c_first_name c_last_name c_display_name c_email c_contact c_register_date",
        )
        .sort({ c_register_date: -1 })
        .limit(10),

      // Latest 10 Course Enrollments
      CourseEnrollment.find()
        .select("user_id course_id enrolled_on coupon_id")
        .populate({
          path: "user_id",
          select: "c_first_name c_last_name c_display_name c_email c_contact",
        })
        .populate({
          path: "course_id",
          select: "m_course_title",
        })
        .sort({ enrolled_on: -1 })
        .limit(10),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        latestCandidates,
        latestEnrollments,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getMonthWiseRegistrations,
  getTopCourses,
  getRecentActivities,
};
