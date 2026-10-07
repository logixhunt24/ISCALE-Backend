const Course = require("../models/course");
const Feature = require("../models/course_feature");
const Tool = require("../models/course_tools");
const FAQ = require("../models/course_faq");
const Subject = require("../models/subject");
const CourseModule = require("../models/course_module");
const Lecture = require("../models/lecture");
const LectureProgress = require("../models/lecture_progress");
const TestPackage = require("../models/test_package");
const Navigation = require("../models/course_training");
const Enrollment = require("../models/course_enrollment");

const { deleteFile } = require("./storageService");

const deleteCourseCascade = async (courseId) => {
  // ==========================
  // COURSE
  // ==========================

  const course = await Course.findById(courseId);

  if (!course) {
    throw new Error("Course not found");
  }

  // ==========================
  // DELETE COURSE FILES
  // ==========================

  if (course.m_course_banner_public_id)
    await deleteFile(course.m_course_banner_public_id);

  if (course.m_course_pdf_public_id)
    await deleteFile(course.m_course_pdf_public_id);

  if (course.m_course_feestructure_public_id)
    await deleteFile(course.m_course_feestructure_public_id);

  // ==========================
  // SUBJECTS
  // ==========================

  const subjects = await Subject.find({
    m_subject_course: courseId,
  });

  for (const subject of subjects) {

    // subject icon

    if (subject.m_subject_icon_public_id) {
      await deleteFile(subject.m_subject_icon_public_id);
    }

    // ==========================
    // LECTURES
    // ==========================

    const lectures = await Lecture.find({
      ml_subject: subject._id,
    });

    for (const lecture of lectures) {

      if (lecture.ml_video_public_id)
        await deleteFile(lecture.ml_video_public_id);

      if (lecture.ml_notes_public_id)
        await deleteFile(lecture.ml_notes_public_id);

      if (lecture.ml_assignment_public_id)
        await deleteFile(lecture.ml_assignment_public_id);

      if (lecture.ml_thumbnail_public_id)
        await deleteFile(lecture.ml_thumbnail_public_id);

      // lecture progress

      await LectureProgress.deleteMany({
        lecture_id: lecture._id,
      });

      await Lecture.findByIdAndDelete(lecture._id);
    }

    await Subject.findByIdAndDelete(subject._id);
  }

  // Modules (their subjects were deleted above)
  await CourseModule.deleteMany({ m_module_course: courseId });

  // ==========================
  // FEATURES
  // ==========================

  await Feature.deleteMany({
    m_course_id: courseId,
  });

  // ==========================
  // TOOLS
  // ==========================

  await Tool.deleteMany({
    m_course_id: courseId,
  });

  // ==========================
  // FAQ
  // ==========================

  await FAQ.deleteMany({
    m_course_id: courseId,
  });

  // ==========================
  // TEST PACKAGE
  // ==========================

  await TestPackage.deleteMany({
    course_id: courseId,
  });

  // ==========================
  // TRAINING NAVIGATION
  // ==========================

  await Navigation.deleteMany({
    course_id: courseId,
  });

  // ==========================
  // ENROLLMENTS
  // ==========================

  await Enrollment.deleteMany({
    course_id: courseId,
  });

  // ==========================
  // DELETE COURSE
  // ==========================

  await Course.findByIdAndDelete(courseId);

  return true;
};

module.exports = deleteCourseCascade;
