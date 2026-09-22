const Training = require("../models/course_training");
const Course = require("../models/course");
const fs = require("fs");


// ===============================
// ADD TRAINING HIGHLIGHT
// ===============================
const addTH = async (req, res) => {
  try {
    const { course_id, title, description, active } = req.body;

    if (!course_id || !title) {
      return res.status(400).json({
        status: false,
        message: "course_id and title required",
      });
    }

    const course = await Course.findById(course_id);
    if (!course) {
      return res.status(404).json({
        status: false,
        message: "Course not found",
      });
    }

    const image = req.files?.th_icon ? req.files.th_icon[0].path : null;

    const newTH = new Training({
      type: 1, // course
      course_id,
      course_slug: course.slug,

      icon: image,
      title,
      description,
      active: active ? Number(active) : 1,

      created: new Date(),
    });

    const saved = await newTH.save();

    res.status(201).json({
      status: true,
      message: "Training Highlight added",
      data: saved,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// GET ALL
// ===============================
const getAllTH = async (req, res) => {
  try {
    const data = await Training.find({ type: 1 }).sort({ _id: -1 });

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// GET BY COURSE
// ===============================
const getTHByCourse = async (req, res) => {
  try {
    const { course_id } = req.params;

    // Same admin-sees-all / public-sees-active-only split used elsewhere
    // (e.g. compRequirementController's getAllJobs) - this handler is
    // shared by both the authenticated admin route and the public one.
    const filter = req.user
      ? { course_id, type: 1 }
      : { course_id, type: 1, active: 1 };

    const data = await Training.find(filter).sort({ _id: -1 });

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// UPDATE
// ===============================
const updateTH = async (req, res) => {
  try {
    const { id } = req.params;

    const th = await Training.findById(id);
    if (!th) {
      return res.status(404).json({
        status: false,
        message: "Not found",
      });
    }

    const { title, description, active } = req.body;

    if (title) th.title = title;
    if (description) th.description = description;
    if (active !== undefined) th.active = Number(active);

    if (req.files?.th_icon) {
      if (th.icon && fs.existsSync(th.icon)) {
        fs.unlinkSync(th.icon);
      }
      th.icon = req.files.th_icon[0].path;
    }

    const updated = await th.save();

    res.json({
      status: true,
      message: "Updated successfully",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// DELETE
// ===============================
const deleteTH = async (req, res) => {
  try {
    const { id } = req.params;

    const th = await Training.findById(id);
    if (!th) {
      return res.status(404).json({
        status: false,
        message: "Not found",
      });
    }

    if (th.icon && fs.existsSync(th.icon)) {
      fs.unlinkSync(th.icon);
    }

    await Training.findByIdAndDelete(id);

    res.json({
      status: true,
      message: "Deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// Mobile Apis=============================================================================================================================


const appGetCourseHighlights = async (req, res) => {
  try {
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({
        response: "failed",
        message: "course_id is required",
      });
    }

    // Check Course Exists
    const course = await Course.findById(course_id);

    if (!course) {
      return res.status(404).json({
        response: "failed",
        message: "Course not found",
      });
    }

    // Get Highlights
    const highlightsData = await Training.find({
      course_id,
      active: 1,
    }).sort({ _id: 1 });

    const highlights = highlightsData.map((item) => ({
      highlight_id: item._id,
      course_id: item.course_id || "0",
      test_id: item.test_id || "0",
      notes_id: item.notes_id || "0",
      webinar_id: item.webinar_id || "0",
      highlight_icon: item.icon || "",
      highlight_title: item.title || "",
      highlight_desc: item.description || "",
      active: item.active,
    }));

    return res.status(200).json({
      response: "success",
      message: "Successfully Found",
      highlights,
    });
  } catch (error) {
    return res.status(500).json({
      response: "failed",
      message: error.message,
    });
  }
};

module.exports = {
  addTH,
  getAllTH,
  getTHByCourse,
  updateTH,
  deleteTH,

  appGetCourseHighlights,
};
