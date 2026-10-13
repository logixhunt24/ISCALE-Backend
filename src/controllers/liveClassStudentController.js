const mongoose = require("mongoose");
const Batch = require("../models/batch");
const LiveClass = require("../models/live_class");
const CourseEnrollment = require("../models/course_enrollment");

const batchCard = (b, joinedBatchId) => ({
  _id: b._id,
  batch_name: b.batch_name,
  batch_instructor: b.batch_instructor || "",
  subject: b.subject || "",
  image: b.m_batch_image || "",
  batch_date: b.batch_date,
  start_time: b.start_time || "",
  end_time: b.end_time || "",
  days: b.m_batch_days || [],
  status: b.m_batch_status,
  notice: b.m_batch_notice_desc || "",
  notice_link: b.m_batch_notice_link || "",
  joined: !!joinedBatchId && String(joinedBatchId) === String(b._id),
});

// GET /live-classes/course/:course_id/batches
const getCourseBatches = async (req, res) => {
  try {
    const { course_id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(course_id)) {
      return res.status(400).json({ status: false, message: "Invalid course id" });
    }

    const enrollments = await CourseEnrollment.find({
      user_id: req.user.id,
      course_id,
      status: 1,
      $or: [{ course_type: 1 }, { payment_status: 1 }, { batch_id: { $ne: null } }],
    })
      .select("batch_id")
      .lean();

    if (!enrollments.length) {
      return res
        .status(403)
        .json({ status: false, message: "You are not enrolled in this course" });
    }

    const joined = enrollments.find((e) => e.batch_id)?.batch_id || null;

    const batches = await Batch.find({
      batch_course: course_id,
      m_batch_status: { $in: [0, 1] },
    })
      .populate("batch_course", "m_course_title")
      .sort({ order: 1, batch_date: 1 })
      .lean();

    return res.status(200).json({
      status: true,
      course_title: batches[0]?.batch_course?.m_course_title || "",
      data: batches.map((b) => batchCard(b, joined)),
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// GET /live-classes/batch/:batch_id  (only for students assigned to that batch)
const getBatchLiveClasses = async (req, res) => {
  try {
    const { batch_id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(batch_id)) {
      return res.status(400).json({ status: false, message: "Invalid batch id" });
    }

    const assigned = await CourseEnrollment.exists({
      user_id: req.user.id,
      batch_id,
      status: 1,
    });

    if (!assigned) {
      return res.status(403).json({
        status: false,
        message: "You have not been added to this batch yet. Please contact the academy.",
      });
    }

    const batch = await Batch.findById(batch_id)
      .populate("batch_course", "m_course_title")
      .lean();

    if (!batch) {
      return res.status(404).json({ status: false, message: "Batch not found" });
    }

    const classes = await LiveClass.find({ batch_id })
      .populate("teacher_id", "member_name")
      .sort({ class_date: -1 })
      .lean();

    return res.status(200).json({
      status: true,
      batch: {
        ...batchCard(batch, batch._id),
        course_id: batch.batch_course?._id || null,
        course_title: batch.batch_course?.m_course_title || "",
      },
      data: classes.map((c) => ({
        _id: c._id,
        title: c.title,
        class_date: c.class_date,
        start_time: c.start_time || "",
        duration: c.duration || 0,
        meeting_link: c.meeting_link || "",
        teacher: c.teacher_id?.member_name || "",
      })),
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

module.exports = { getCourseBatches, getBatchLiveClasses };
