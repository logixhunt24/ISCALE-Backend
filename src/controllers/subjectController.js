const Subject = require("../models/subject");
const Course = require("../models/course");
const Lecture = require("../models/lecture");
// const fs = require("fs");
const mongoose = require("mongoose");
const { deleteFile } = require("../services/storageService");
const CourseModule = require("../models/course_module");

// Resolves the optional parent-module field from a request body: undefined
// means "not sent", ""/"null" means "no module", anything else must be a
// module that belongs to the same course.
const resolveModule = async (raw, courseId) => {
  if (raw === undefined) return { skip: true };
  if (raw === "" || raw === null || raw === "null") return { value: null };
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    return { error: "Invalid module" };
  }
  const found = await CourseModule.findOne({ _id: raw, m_module_course: courseId });
  if (!found) return { error: "Module not found for this course" };
  return { value: found._id };
};

// ADD SUBJECT
const addSubject = async (req, res) => {
  let icon = null;
  let iconPublicId = null;

  if (req.files?.m_subject_icon) {
    icon = req.files.m_subject_icon[0].path;
    iconPublicId = req.files.m_subject_icon[0].filename;
  }
  try {
    const {
      m_subject_title,
      m_subject_course,
      m_subject_desc,
      m_subject_status,
      m_subject_seq,
      m_subject_module,
      // m_subject_for,
    } = req.body;

    // REQUIRED VALIDATION
    if (!m_subject_title || !m_subject_course) {
      if (req.files?.m_subject_icon) {
        await deleteFile(req.files.m_subject_icon[0].filename);
      }

      return res.status(400).json({
        status: false,
        message: "Subject title and course are required",
      });
    }

    // CHECK COURSE EXISTS
    const course = await Course.findById(m_subject_course);
    if (!course) {
      if (req.files?.m_subject_icon) {
        await deleteFile(req.files.m_subject_icon[0].filename);
      }
      return res.status(404).json({
        status: false,
        message: "Course not found",
      });
    }

    // IMAGE
    // let icon = null;
    // if (req.files?.m_subject_icon) {
    //   icon = req.files.m_subject_icon[0].path;
    // }

    const moduleResult = await resolveModule(m_subject_module, m_subject_course);
    if (moduleResult.error) {
      if (req.files?.m_subject_icon) {
        await deleteFile(req.files.m_subject_icon[0].filename);
      }
      return res.status(400).json({ status: false, message: moduleResult.error });
    }

    const subject = new Subject({
      m_subject_title,
      m_subject_course,
      m_subject_module: moduleResult.skip ? null : moduleResult.value,
      // m_subject_course_slug: course.slug,
      m_subject_icon: icon,
      m_subject_icon_public_id: iconPublicId,
      m_subject_desc,
      m_subject_status: m_subject_status !== undefined ? Number(m_subject_status) : 1,
      m_subject_seq: m_subject_seq !== undefined ? Number(m_subject_seq) : 0,
      // m_subject_for: m_subject_for ? Number(m_subject_for) : 1,
    });

    const saved = await subject.save();

    res.status(201).json({
      status: true,
      message: "Subject added successfully",
      data: saved,
    });
  } catch (err) {
    if (iconPublicId) {
      await deleteFile(iconPublicId);
    }

    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// GET ALL SUBJECTS
const getAllSubjects = async (req, res) => {
  try {
    const data = await Subject.find()
      .populate("m_subject_course", "title slug")
      .sort({ m_subject_seq: 1, _id: -1 });

    res.json({
      status: true,
      data,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// GET BY COURSE ID
// const getSubjectsByCourse = async (req, res) => {
//   try {
//     const { courseId } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(courseId)) {
//       return res.status(400).json({
//         status: false,
//         message: "Invalid course ID",
//       });
//     }

//     const data = await Subject.find({
//       m_subject_course: courseId,
//     }).sort({ m_subject_seq: 1 });

//     res.json({
//       status: true,
//       data,
//     });
//   } catch (err) {
//     res.status(500).json({ status: false, message: err.message });
//   }
// };

const getSubjectsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid course ID",
      });
    }

    // Subjects fetch
    const subjects = await Subject.find({
      m_subject_course: courseId,
    }).sort({ m_subject_seq: 1 });

    const subjectIds = subjects.map((subject) => subject._id);

    // Lectures fetch
    const lectures = await Lecture.find({
      ml_subject: { $in: subjectIds },
      ml_status: 1,
    })
      .select("_id ml_title ml_subject")
      .sort({ ml_seq: 1 });

    // Group lectures by subject
    const lectureMap = {};

    lectures.forEach((lecture) => {
      const subjectId = lecture.ml_subject.toString();

      if (!lectureMap[subjectId]) {
        lectureMap[subjectId] = [];
      }

      lectureMap[subjectId].push({
        _id: lecture._id,
        title: lecture.ml_title,
      });
    });

    // Final response
    const finalData = subjects.map((subject) => ({
      _id: subject._id,
      m_subject_course: subject.m_subject_course,
      m_subject_title: subject.m_subject_title,
      m_subject_desc: subject.m_subject_desc,
      m_subject_status: subject.m_subject_status,
      m_subject_seq: subject.m_subject_seq,
      code: subject.code,
      is_writing: subject.is_writing,
      created_at: subject.created_at,
      updated_at: subject.updated_at,

      m_subject_module: subject.m_subject_module || null,

      lectures: lectureMap[subject._id.toString()] || [],
    }));

    res.json({
      status: true,
      data: finalData,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// UPDATE SUBJECT
// const updateSubject = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const subject = await Subject.findById(id);
//     if (!subject) {
//       return res.status(404).json({
//         status: false,
//         message: "Subject not found",
//       });
//     }

//     const { m_subject_title, m_subject_desc, m_subject_status, m_subject_seq } =
//       req.body;

//     if (m_subject_title) subject.m_subject_title = m_subject_title;
//     if (m_subject_desc) subject.m_subject_desc = m_subject_desc;
//     if (m_subject_status !== undefined)
//       subject.m_subject_status = Number(m_subject_status);
//     if (m_subject_seq !== undefined)
//       subject.m_subject_seq = Number(m_subject_seq);

//     // IMAGE UPDATE
//     // if (req.files?.m_subject_icon) {
//     //   if (subject.m_subject_icon && fs.existsSync(subject.m_subject_icon)) {
//     //     fs.unlinkSync(subject.m_subject_icon);
//     //   }
//     //   subject.m_subject_icon = req.files.m_subject_icon[0].path;
//     // }

// //     if (req.files?.m_subject_icon) {
// //       if (subject.m_subject_icon_public_id) {
// //         await deleteFile(subject.m_subject_icon_public_id);
// //       }

// //       subject.m_subject_icon = req.files.m_subject_icon[0].path;
// //       subject.m_subject_icon_public_id = req.files.m_subject_icon[0].filename;
// //     }

// //     const updated = await subject.save();

// //     res.json({
// //       status: true,
// //       message: "Subject updated successfully",
// //       data: updated,
// //     });
// //   } catch (err) {
// //     res.status(500).json({ status: false, message: err.message });
// //   }
// // };

// const oldPublicId = subject.m_subject_icon_public_id;

// if (req.files?.m_subject_icon) {
//     subject.m_subject_icon = req.files.m_subject_icon[0].path;
//     subject.m_subject_icon_public_id =
//         req.files.m_subject_icon[0].filename;
// }

// try {
//     const updated = await subject.save();

//     if (req.files?.m_subject_icon && oldPublicId) {
//         await deleteFile(oldPublicId);
//     }

//     return res.json({
//         status: true,
//         message: "Subject updated successfully",
//         data: updated,
//     });
// } catch (err) {
//     if (req.files?.m_subject_icon) {
//         await deleteFile(req.files.m_subject_icon[0].filename);
//     }

//     return res.status(500).json({
//         status: false,
//         message: err.message,
//     });
// }};

// UPDATE SUBJECT
const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id);

    if (!subject) {
      if (req.files?.m_subject_icon) {
        await deleteFile(req.files.m_subject_icon[0].filename);
      }

      return res.status(404).json({
        status: false,
        message: "Subject not found",
      });
    }

    const { m_subject_title, m_subject_desc, m_subject_status, m_subject_seq, m_subject_module } =
      req.body;

    const moduleResult = await resolveModule(m_subject_module, subject.m_subject_course);
    if (moduleResult.error) {
      if (req.files?.m_subject_icon) {
        await deleteFile(req.files.m_subject_icon[0].filename);
      }
      return res.status(400).json({ status: false, message: moduleResult.error });
    }
    if (!moduleResult.skip) subject.m_subject_module = moduleResult.value;

    if (m_subject_title) subject.m_subject_title = m_subject_title;
    if (m_subject_desc) subject.m_subject_desc = m_subject_desc;
    if (m_subject_status !== undefined)
      subject.m_subject_status = Number(m_subject_status);
    if (m_subject_seq !== undefined)
      subject.m_subject_seq = Number(m_subject_seq);

    const oldPublicId = subject.m_subject_icon_public_id;

    if (req.files?.m_subject_icon) {
      subject.m_subject_icon = req.files.m_subject_icon[0].path;
      subject.m_subject_icon_public_id = req.files.m_subject_icon[0].filename;
    }

    const updated = await subject.save();

    if (req.files?.m_subject_icon && oldPublicId) {
      await deleteFile(oldPublicId);
    }

    return res.status(200).json({
      status: true,
      message: "Subject updated successfully",
      data: updated,
    });
  } catch (err) {
    if (req.files?.m_subject_icon) {
      await deleteFile(req.files.m_subject_icon[0].filename);
    }

    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// DELETE SUBJECT
const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({
        status: false,
        message: "Subject not found",
      });
    }

    if (subject.m_subject_icon_public_id) {
      await deleteFile(subject.m_subject_icon_public_id);
    }
    await Subject.findByIdAndDelete(id);

    res.json({
      status: true,
      message: "Subject deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// GET SUBJECT DROPDOWN BY COURSE
const getSubjectDropdownByCourse = async (req, res) => {
  try {
    const { m_course_id } = req.query;

    // validation
    if (!m_course_id) {
      return res.status(400).json({
        status: false,
        message: "course_id is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(m_course_id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid course ID",
      });
    }

    //  fetch subjects of that course
    const subjects = await Subject.find({
      m_subject_course: m_course_id,
      // m_subject_status: 1, // only active
    }).select("_id m_subject_title");

    res.status(200).json({
      status: true,
      message: "Subjects fetched successfully",
      data: subjects,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// GET ALL SUBJECTS FOR DROPDOWN
const getAllSubjectsDropdown = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    // TOTAL RECORDS
    const totalRecords = await Subject.countDocuments();

    // GET DATA
    const subjects = await Subject.find()

      .select(
        `
        _id
        m_subject_title
      `,
      )

      .sort({ m_subject_title: 1 })

      .skip((page - 1) * limit)

      .limit(limit);

    // RESPONSE
    return res.status(200).json({
      status: true,
      message: "Subjects fetched successfully",

      pagination: {
        currentPage: page,
        perPage: limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },

      data: subjects,
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

module.exports = {
  addSubject,
  getAllSubjects,
  getSubjectsByCourse,
  updateSubject,
  deleteSubject,
  getSubjectDropdownByCourse,
  getAllSubjectsDropdown,
};
