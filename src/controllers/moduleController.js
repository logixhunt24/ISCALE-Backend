const mongoose = require("mongoose");
const Module = require("../models/course_module");
const Subject = require("../models/subject");
const Lecture = require("../models/lecture");
const Course = require("../models/course");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ADD MODULE
const addModule = async (req, res) => {
  try {
    const { m_module_title, m_module_course, m_module_desc, m_module_status, m_module_seq } =
      req.body;

    if (!m_module_title || !m_module_title.trim() || !m_module_course) {
      return res.status(400).json({
        status: false,
        message: "Module title and course are required",
      });
    }

    if (!isValidId(m_module_course) || !(await Course.exists({ _id: m_module_course }))) {
      return res.status(404).json({ status: false, message: "Course not found" });
    }

    const saved = await Module.create({
      m_module_title: m_module_title.trim(),
      m_module_course,
      m_module_desc: m_module_desc || "",
      m_module_status: m_module_status !== undefined ? Number(m_module_status) : 1,
      m_module_seq: m_module_seq !== undefined ? Number(m_module_seq) : 0,
    });

    res.status(201).json({
      status: true,
      message: "Module added successfully",
      data: saved,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// UPDATE MODULE
const updateModule = async (req, res) => {
  try {
    const { id } = req.params;
    const module = isValidId(id) ? await Module.findById(id) : null;

    if (!module) {
      return res.status(404).json({ status: false, message: "Module not found" });
    }

    const { m_module_title, m_module_desc, m_module_status, m_module_seq } = req.body;

    if (m_module_title !== undefined) {
      if (!m_module_title.trim()) {
        return res.status(400).json({ status: false, message: "Module title cannot be empty" });
      }
      module.m_module_title = m_module_title.trim();
    }
    if (m_module_desc !== undefined) module.m_module_desc = m_module_desc;
    if (m_module_status !== undefined) module.m_module_status = Number(m_module_status);
    if (m_module_seq !== undefined) module.m_module_seq = Number(m_module_seq);

    const updated = await module.save();

    res.json({
      status: true,
      message: "Module updated successfully",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// DELETE MODULE - its subjects (and their topics) are kept and simply become
// ungrouped, rather than being deleted along with the module.
const deleteModule = async (req, res) => {
  try {
    const { id } = req.params;
    const module = isValidId(id) ? await Module.findById(id) : null;

    if (!module) {
      return res.status(404).json({ status: false, message: "Module not found" });
    }

    await Subject.updateMany({ m_subject_module: id }, { $set: { m_subject_module: null } });
    await Module.findByIdAndDelete(id);

    res.json({
      status: true,
      message: "Module deleted successfully (its subjects were kept and are now ungrouped)",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ADMIN: all modules of a course (any status) with how many subjects each holds
const getModulesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!isValidId(courseId)) {
      return res.status(400).json({ status: false, message: "Invalid course ID" });
    }

    const modules = await Module.find({ m_module_course: courseId }).sort({
      m_module_seq: 1,
      _id: 1,
    });

    const counts = await Subject.aggregate([
      { $match: { m_subject_course: new mongoose.Types.ObjectId(courseId), m_subject_module: { $ne: null } } },
      { $group: { _id: "$m_subject_module", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach((c) => {
      countMap[String(c._id)] = c.count;
    });

    res.json({
      status: true,
      data: modules.map((m) => ({
        ...m.toObject(),
        total_subjects: countMap[String(m._id)] || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ADMIN: lightweight list for the subject form's Module dropdown
const getModuleDropdownByCourse = async (req, res) => {
  try {
    const { m_course_id } = req.query;

    if (!m_course_id || !isValidId(m_course_id)) {
      return res.status(400).json({ status: false, message: "Valid course id is required" });
    }

    const data = await Module.find({ m_module_course: m_course_id })
      .select("_id m_module_title m_module_status")
      .sort({ m_module_seq: 1, _id: 1 });

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// PUBLIC: the whole Module -> Subject -> Topic tree for the course page.
// Only active modules/subjects/topics are returned.
//  - Subjects with no (or an inactive/missing) module are collected under a
//    trailing "Other" module so nothing silently disappears.
//  - A course with no modules at all comes back as a single `implicit`
//    module holding every subject, so courses set up before modules existed
//    keep rendering exactly as they did.
const getCourseContent = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!isValidId(courseId)) {
      return res.status(400).json({ status: false, message: "Invalid course ID" });
    }

    const [modules, subjects] = await Promise.all([
      Module.find({ m_module_course: courseId, m_module_status: { $ne: 0 } }).sort({
        m_module_seq: 1,
        _id: 1,
      }),
      Subject.find({ m_subject_course: courseId, m_subject_status: { $ne: 0 } }).sort({
        m_subject_seq: 1,
        _id: 1,
      }),
    ]);

    const lectures = await Lecture.find({
      ml_subject: { $in: subjects.map((s) => s._id) },
      ml_status: 1,
    })
      .select("_id ml_title ml_subject")
      .sort({ ml_seq: 1 });

    const topicsBySubject = {};
    lectures.forEach((l) => {
      const key = String(l.ml_subject);
      (topicsBySubject[key] = topicsBySubject[key] || []).push({
        _id: l._id,
        title: l.ml_title,
      });
    });

    const shapeSubject = (s) => ({
      _id: s._id,
      title: s.m_subject_title,
      description: s.m_subject_desc || "",
      topics: topicsBySubject[String(s._id)] || [],
    });

    const moduleIds = new Set(modules.map((m) => String(m._id)));
    const subjectsByModule = {};
    const ungrouped = [];
    subjects.forEach((s) => {
      const key = s.m_subject_module ? String(s.m_subject_module) : null;
      if (key && moduleIds.has(key)) {
        (subjectsByModule[key] = subjectsByModule[key] || []).push(shapeSubject(s));
      } else {
        ungrouped.push(shapeSubject(s));
      }
    });

    let data;
    if (modules.length === 0) {
      data = ungrouped.length
        ? [{ _id: null, title: "", implicit: true, subjects: ungrouped }]
        : [];
    } else {
      data = modules
        .filter((m) => (subjectsByModule[String(m._id)] || []).length > 0)
        .map((m) => ({
          _id: m._id,
          title: m.m_module_title,
          description: m.m_module_desc || "",
          subjects: subjectsByModule[String(m._id)],
        }));
      if (ungrouped.length) {
        data.push({ _id: null, title: "Other", subjects: ungrouped });
      }
    }

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = {
  addModule,
  updateModule,
  deleteModule,
  getModulesByCourse,
  getModuleDropdownByCourse,
  getCourseContent,
};
