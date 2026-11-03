// Ids of a course's modules the admin has set to In-Active. Subjects inside an
// inactive module must be hidden from students too (not just the module's heading).
const CourseModule = require("../models/course_module");

const inactiveModuleIds = (courseId) =>
  CourseModule.find({ m_module_course: courseId, m_module_status: 0 }).distinct("_id");

module.exports = { inactiveModuleIds };
