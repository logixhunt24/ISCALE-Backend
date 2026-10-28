const mongoose = require("mongoose");

const UserReview = require("../models/user_reviews");
const CourseReview = require("../models/course_review");
const Course = require("../models/course");
const Candidate = require("../models/candidates");

const validId = (v) => mongoose.Types.ObjectId.isValid(v);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const studentName = (c) =>
  [c?.c_first_name, c?.c_last_name].filter(Boolean).join(" ") || c?.c_display_name || "Student";

// ---------------------------------------------------------------- public

// GET /user-reviews/course/:courseId
// Reviews the admin chose to show for this course. A course with none of its own falls
// back to the site-wide testimonials so its page is never empty.
const getCourseReviews = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!validId(courseId)) return res.status(400).json({ status: false, message: "Invalid course id" });

    const pick = (filter) =>
      UserReview.find({ ...filter, status: "active", user_review: { $nin: [null, ""] } })
        .select("user_name user_designation user_image user_review rating createdAt")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

    let scope = "course";
    let rows = await pick({ course_id: courseId });
    if (!rows.length) {
      scope = "general";
      rows = await pick({ course_id: null });
    }

    const total = rows.length;
    const average = total ? rows.reduce((sum, r) => sum + (r.rating || 0), 0) / total : 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: rows.filter((r) => Math.round(r.rating) === star).length,
    }));

    return res.json({
      status: true,
      scope,
      data: {
        average,
        total,
        distribution,
        items: rows.map((r) => ({
          id: r._id,
          name: r.user_name,
          designation: r.user_designation || "",
          image: r.user_image || "",
          text: r.user_review,
          rating: r.rating || 5,
          date: r.createdAt,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ---------------------------------------------------------------- admin: reviews sent from the mobile app

// GET /course-reviews/list?page=&limit=&course_id=&search=&published=all|yes|no
const listAppReviews = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const { course_id, search, published = "all" } = req.query;

    const filter = {};
    if (course_id && validId(course_id)) filter.course_id = String(course_id);

    // "published" = there is an active copy on the website
    const copies = await UserReview.find({ source_review_id: { $ne: null } })
      .select("source_review_id status")
      .lean();
    const copyBySource = new Map(copies.map((c) => [String(c.source_review_id), c]));
    const publishedIds = copies.filter((c) => c.status === "active").map((c) => c.source_review_id);

    if (published === "yes") filter._id = { $in: publishedIds };
    else if (published === "no") filter._id = { $nin: publishedIds };

    if (search && String(search).trim()) {
      const k = escapeRegex(String(search).trim());
      const nameMatches = await Candidate.find({
        $or: [{ c_first_name: { $regex: k, $options: "i" } }, { c_last_name: { $regex: k, $options: "i" } }],
      })
        .select("_id")
        .limit(500)
        .lean();
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ remark: { $regex: k, $options: "i" } }, { user_id: { $in: nameMatches.map((c) => String(c._id)) } }] },
      ];
    }

    const [total, rows] = await Promise.all([
      CourseReview.countDocuments(filter),
      CourseReview.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const [students, courses] = await Promise.all([
      Candidate.find({ _id: { $in: rows.map((r) => r.user_id).filter(validId) } })
        .select("c_first_name c_last_name c_display_name c_profile_image c_contact")
        .lean(),
      Course.find({ _id: { $in: rows.map((r) => r.course_id).filter(validId) } })
        .select("m_course_title")
        .lean(),
    ]);
    const studentMap = new Map(students.map((s) => [String(s._id), s]));
    const courseMap = new Map(courses.map((c) => [String(c._id), c.m_course_title]));

    return res.json({
      status: true,
      pagination: { currentPage: page, perPage: limit, totalRecords: total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      data: rows.map((r) => {
        const s = studentMap.get(String(r.user_id));
        const copy = copyBySource.get(String(r._id));
        return {
          _id: r._id,
          student_name: studentName(s),
          student_image: s?.c_profile_image || "",
          student_contact: s?.c_contact || "",
          course_id: r.course_id,
          course_title: courseMap.get(String(r.course_id)) || "",
          rating: r.rating,
          remark: r.remark || "",
          submitted_at: r.createdAt,
          published: copy?.status === "active",
          published_copy_id: copy?._id || null,
        };
      }),
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// POST /course-reviews/publish/:id — show this app review on the course page
const publishAppReview = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ status: false, message: "Invalid review id" });

    const review = await CourseReview.findById(req.params.id);
    if (!review) return res.status(404).json({ status: false, message: "Review not found" });

    if (!review.remark || !review.remark.trim()) {
      return res.status(400).json({ status: false, message: "This review has a rating but no written text, so there is nothing to show on the page." });
    }
    if (!validId(review.course_id)) {
      return res.status(400).json({ status: false, message: "This review is not linked to a course." });
    }

    const [course, student, existing] = await Promise.all([
      Course.findById(review.course_id).select("m_course_title").lean(),
      validId(review.user_id) ? Candidate.findById(review.user_id).lean() : null,
      UserReview.findOne({ source_review_id: review._id }),
    ]);
    if (!course) return res.status(400).json({ status: false, message: "The course for this review no longer exists." });

    // Re-publishing an earlier copy keeps whatever the admin edited on it.
    if (existing) {
      existing.status = "active";
      await existing.save();
      return res.json({ status: true, message: "Review is now shown on the course page", data: { published: true, published_copy_id: existing._id } });
    }

    const copy = await UserReview.create({
      user_name: studentName(student),
      user_designation: `Student, ${course.m_course_title}`,
      user_image: student?.c_profile_image || null,
      user_review: review.remark.trim(),
      rating: review.rating,
      course_id: review.course_id,
      source_review_id: review._id,
      status: "active",
    });

    return res.json({ status: true, message: "Review is now shown on the course page", data: { published: true, published_copy_id: copy._id } });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// POST /course-reviews/unpublish/:id — hide it again (the app review itself is kept)
const unpublishAppReview = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ status: false, message: "Invalid review id" });

    await UserReview.updateMany({ source_review_id: req.params.id }, { status: "inactive" });
    return res.json({ status: true, message: "Review hidden from the course page", data: { published: false } });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// DELETE /course-reviews/delete/:id — removes the app review and any website copy of it
const deleteAppReview = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ status: false, message: "Invalid review id" });

    const removed = await CourseReview.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ status: false, message: "Review not found" });

    await UserReview.deleteMany({ source_review_id: req.params.id });
    return res.json({ status: true, message: "Review deleted" });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = { getCourseReviews, listAppReviews, publishAppReview, unpublishAppReview, deleteAppReview };
