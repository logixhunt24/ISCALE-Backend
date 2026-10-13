const fs = require("fs");
const path = require("path");

const MasterBatch = require("../models/batch");
const CourseEnrollment = require("../models/course_enrollment");

const Instructor = require("../models/instructor");
const Course = require("../models/course");
const mongoose = require("mongoose");

const Batch = require("../models/batch");
const { deleteFromCloudinary } = require("../utils/cloudinaryHelper");

// DELETE FILE HELPER
const deleteFile = async (filePath) => {
  try {
    if (!filePath) return;
    if (filePath.startsWith("http")) {
      await deleteFromCloudinary(filePath);
    } else if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.log("File delete error:", error.message);
  }
};

// CHECK EMPTY VALUE
const isValidValue = (value) => {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    value !== "null" &&
    value !== "undefined"
  );
};

// PARSE DAYS
const parseDays = (days) => {
  let parsedDays = [];

  if (!isValidValue(days)) {
    return parsedDays;
  }

  // already array
  if (Array.isArray(days)) {
    parsedDays = days;
  }

  // string
  else if (typeof days === "string") {
    // JSON array
    if (days.startsWith("[")) {
      parsedDays = JSON.parse(days);
    }

    // comma separated
    else {
      parsedDays = days
        .split(",")
        .map((day) => day.trim().toLowerCase())
        .filter((day) => day);
    }
  }

  if (!Array.isArray(parsedDays)) {
    throw new Error("Invalid m_batch_days format");
  }

  return parsedDays;
};

// ADD BATCH
const addBatch = async (req, res) => {
  try {
    const uploadedImage = req.files?.m_batch_image?.[0]?.path || "";

    const {
      batch_name,
      batch_instructor_id,
      batch_instructor,
      batch_course,
      batch_date,
      start_time,
      end_time,
      strength,
      m_batch_notice_desc,
      m_batch_notice_link,
      order,
      subject,
      m_batch_days,
      m_batch_status,
    } = req.body;

    // VALIDATION
    if (!isValidValue(batch_name)) {
      if (uploadedImage) {
        await deleteFile(uploadedImage);
      }

      return res.status(400).json({
        status: false,
        message: "Batch name is required",
      });
    }

    // CREATE OBJECT
    const batchData = {};

    // required
    batchData.batch_name = batch_name;

    // optional fields
    if (isValidValue(batch_instructor_id)) {
      batchData.batch_instructor_id = batch_instructor_id;
    }

    if (isValidValue(batch_instructor)) {
      batchData.batch_instructor = batch_instructor;
    }

    // single course only
    if (isValidValue(batch_course)) {
      batchData.batch_course = batch_course;
    }

    if (isValidValue(batch_date)) {
      batchData.batch_date = batch_date;
    }

    if (isValidValue(start_time)) {
      batchData.start_time = start_time;
    }

    if (isValidValue(end_time)) {
      batchData.end_time = end_time;
    }

    if (isValidValue(strength)) {
      batchData.strength = Number(strength);
    }

    if (isValidValue(m_batch_notice_desc)) {
      batchData.m_batch_notice_desc = m_batch_notice_desc;
    }

    if (isValidValue(m_batch_notice_link)) {
      batchData.m_batch_notice_link = m_batch_notice_link;
    }

    if (isValidValue(order)) {
      batchData.order = Number(order);
    }

    if (isValidValue(subject)) {
      batchData.subject = subject;
    }

    if (isValidValue(m_batch_status)) {
      batchData.m_batch_status = Number(m_batch_status);
    }

    // days
    if (isValidValue(m_batch_days)) {
      batchData.m_batch_days = parseDays(m_batch_days);
    }

    // image
    if (uploadedImage) {
      batchData.m_batch_image = uploadedImage;
    }

    // ===============================
    // INSTRUCTOR VALIDATION
    // ===============================

    if (isValidValue(batch_instructor_id)) {
      if (!mongoose.Types.ObjectId.isValid(batch_instructor_id)) {
        return res.status(400).json({
          status: false,
          message: "Invalid instructor id",
        });
      }

      const instructorExists = await Instructor.findById(batch_instructor_id);

      if (!instructorExists) {
        return res.status(404).json({
          status: false,
          message: "Instructor not found",
        });
      }
    }

    // ===============================
    // COURSE VALIDATION
    // ===============================

    if (isValidValue(batch_course)) {
      if (!mongoose.Types.ObjectId.isValid(batch_course)) {
        return res.status(400).json({
          status: false,
          message: "Invalid course id",
        });
      }

      const courseExists = await Course.findById(batch_course);

      if (!courseExists) {
        return res.status(404).json({
          status: false,
          message: "Course not found",
        });
      }
    }

    // =================================
    // CREATE
    // =================================
    const batch = await MasterBatch.create(batchData);

    if (batch.batch_course) {
      await CourseEnrollment.updateMany(
        {
          course_id: batch.batch_course,
        },
        {
          $set: {
            batch_id: batch._id,
            batch_name: batch.batch_name,
          },
        },
      );
    }

    return res.status(201).json({
      status: true,
      message: "Batch added successfully",
      data: batch,
    });
  } catch (error) {
    // delete uploaded image if error
    if (req.files?.m_batch_image?.[0]?.path) {
      await deleteFile(req.files.m_batch_image[0].path);
    }

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// UPDATE BATCH
const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;

    const uploadedImage = req.files?.m_batch_image?.[0]?.path || "";


    // FIND BATCH
    const existingBatch = await MasterBatch.findById(id);

   
// INSTRUCTOR VALIDATION

if (isValidValue(req.body.batch_instructor_id)) {

  if (
    !mongoose.Types.ObjectId.isValid(
      req.body.batch_instructor_id
    )
  ) {
    return res.status(400).json({
      status: false,
      message: "Invalid instructor id",
    });
  }

  const instructorExists = await Instructor.findById(
    req.body.batch_instructor_id
  );

  if (!instructorExists) {
    return res.status(404).json({
      status: false,
      message: "Instructor not found",
    });
  }
}


// COURSE VALIDATION
if (isValidValue(req.body.batch_course)) {

  if (
    !mongoose.Types.ObjectId.isValid(
      req.body.batch_course
    )
  ) {
    return res.status(400).json({
      status: false,
      message: "Invalid course id",
    });
  }

  const courseExists = await Course.findById(
    req.body.batch_course
  );

  if (!courseExists) {
    return res.status(404).json({
      status: false,
      message: "Course not found",
    });
  }
}

    if (!existingBatch) {
      if (uploadedImage) {
        await deleteFile(uploadedImage);
      }

      return res.status(404).json({
        status: false,
        message: "Batch not found",
      });
    }


    // UPDATE OBJECT
    const updateData = {};

    // update only filled fields

    if (isValidValue(req.body.batch_name)) {
      updateData.batch_name = req.body.batch_name;
    }

    if (isValidValue(req.body.batch_instructor_id)) {
      updateData.batch_instructor_id = req.body.batch_instructor_id;
    }

    if (isValidValue(req.body.batch_instructor)) {
      updateData.batch_instructor = req.body.batch_instructor;
    }

    // single course only
    if (isValidValue(req.body.batch_course)) {
      updateData.batch_course = req.body.batch_course;
    }

    if (isValidValue(req.body.batch_date)) {
      updateData.batch_date = req.body.batch_date;
    }

    if (isValidValue(req.body.start_time)) {
      updateData.start_time = req.body.start_time;
    }

    if (isValidValue(req.body.end_time)) {
      updateData.end_time = req.body.end_time;
    }

    if (isValidValue(req.body.strength)) {
      updateData.strength = Number(req.body.strength);
    }

    if (isValidValue(req.body.m_batch_notice_desc)) {
      updateData.m_batch_notice_desc = req.body.m_batch_notice_desc;
    }

    if (isValidValue(req.body.m_batch_notice_link)) {
      updateData.m_batch_notice_link = req.body.m_batch_notice_link;
    }

    if (isValidValue(req.body.order)) {
      updateData.order = Number(req.body.order);
    }

    if (isValidValue(req.body.subject)) {
      updateData.subject = req.body.subject;
    }

    if (isValidValue(req.body.m_batch_status)) {
      updateData.m_batch_status = Number(req.body.m_batch_status);
    }

    // days
    if (isValidValue(req.body.m_batch_days)) {
      updateData.m_batch_days = parseDays(req.body.m_batch_days);
    }

    // new image
    if (uploadedImage) {
      updateData.m_batch_image = uploadedImage;
    }

    
    // UPDATE
    const updatedBatch = await MasterBatch.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    const oldCourseId = existingBatch.batch_course?.toString();

    const newCourseId = updatedBatch.batch_course?.toString();

    if (oldCourseId && newCourseId && oldCourseId !== newCourseId) {
      // Purane course ke enrollment se batch hatao

      await CourseEnrollment.updateMany(
        {
          course_id: oldCourseId,
          batch_id: updatedBatch._id,
        },
        {
          $set: {
            batch_id: null,
            batch_name: null,
          },
        },
      );
    }

    if (updatedBatch.batch_course) {
      await CourseEnrollment.updateMany(
        {
          course_id: updatedBatch.batch_course,
        },
        {
          $set: {
            batch_id: updatedBatch._id,
            batch_name: updatedBatch.batch_name,
          },
        },
      );
    }

    
    // DELETE OLD IMAGE
    if (uploadedImage && existingBatch.m_batch_image) {
      await deleteFile(existingBatch.m_batch_image);
    }

    return res.status(200).json({
      status: true,
      message: "Batch updated successfully",
      data: updatedBatch,
    });
  } catch (error) {
    // delete newly uploaded image if error
    if (req.files?.m_batch_image?.[0]?.path) {
      await deleteFile(req.files.m_batch_image[0].path);
    }

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// GET ALL BATCHES
const getAllBatches = async (req, res) => {
  try {
    let { page = 1, limit = 10, search, fromDate, toDate } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = {};

    // =================================
    // SEARCH
    // =================================
    if (isValidValue(search)) {
      filter.$or = [
        {
          batch_name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          batch_instructor: {
            $regex: search,
            $options: "i",
          },
        },
        {
          subject: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    // =================================
    // DATE FILTER
    // =================================
    if (isValidValue(fromDate) || isValidValue(toDate)) {
      filter.batch_date = {};

      if (isValidValue(fromDate)) {
        filter.batch_date.$gte = new Date(fromDate);
      }

      if (isValidValue(toDate)) {
        filter.batch_date.$lte = new Date(toDate);
      }
    }

    // =================================
    // TOTAL
    // =================================
    const total = await MasterBatch.countDocuments(filter);

    // =================================
    // GET DATA
    // =================================
    const batches = await MasterBatch.find(filter)
      .populate("batch_course", "m_course_name")
      .populate("batch_instructor_id", "m_instructor_name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      status: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: batches,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// GET SINGLE BATCH
const getSingleBatch = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await MasterBatch.findById(id)
      .populate("batch_course")
      .populate("batch_instructor_id");

    if (!batch) {
      return res.status(404).json({
        status: false,
        message: "Batch not found",
      });
    }

    return res.status(200).json({
      status: true,
      data: batch,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// DELETE BATCH
const deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await MasterBatch.findById(id);

    if (!batch) {
      return res.status(404).json({
        status: false,
        message: "Batch not found",
      });
    }

    // delete image
    if (batch.m_batch_image) {
      await deleteFile(batch.m_batch_image);
    }

    // unassign students so no enrollment points at a deleted batch
    await CourseEnrollment.updateMany(
      { batch_id: id },
      { batch_id: null, batch_name: null },
    );

    // delete batch
    await MasterBatch.findByIdAndDelete(id);

    return res.status(200).json({
      status: true,
      message: "Batch deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const getBatchesDropdown = async (req, res) => {
  try {
    let { page = 1, limit = 10, search, status } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = {};

    // =================================
    // STATUS FILTER
    // 0 => Upcoming
    // 1 => Running
    // =================================
    if (isValidValue(status)) {
      filter.m_batch_status = Number(status);
    } else {
      filter.m_batch_status = { $in: [0, 1] };
    }

    // SEARCH

    if (isValidValue(search)) {
      filter.batch_name = {
        $regex: search,
        $options: "i",
      };
    }

    const total = await MasterBatch.countDocuments(filter);

    const batches = await MasterBatch.find(filter)
      .select("_id batch_name")
      .sort({ batch_name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      status: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: batches,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Mobile Apis=============================================================================================================================




const appGetRunningBatches = async (req, res) => {
  try {
    const batches = await Batch.find({
      m_batch_status: 1,
    })
      .populate({
        path: "batch_course",
        select: "m_course_title",
      })
      .sort({ order: 1 });

    const formattedBatches = batches.map((batch) => ({
      id: String(batch._id),

      batch_name: batch.batch_name || "",

      batch_instructor: batch.batch_instructor || "",

      batch_course_id: batch.batch_course
        ? String(batch.batch_course._id)
        : "",

      batch_course_name:
        batch.batch_course?.m_course_title || "",

      m_course_title:
        batch.batch_course?.m_course_title || "",

      batch_description:
        batch.m_batch_notice_desc || "",

      batch_date: batch.batch_date
        ? batch.batch_date.toISOString().split("T")[0]
        : "",

      start_time: batch.start_time || "",

      end_time: batch.end_time || "",

      m_batch_days: batch.m_batch_days?.join(",") || "",

      topic: batch.subject || "",

      strength: String(batch.strength || 0),

      // schema me field nahi hai
      m_batch_type: "0",

      m_batch_status: String(batch.m_batch_status),

      m_batch_image: batch.m_batch_image || "",
    }));

    return res.status(200).json({
      response: "success",
      batch: formattedBatches,
    });
  } catch (error) {
    return res.status(500).json({
      response: "error",
      message: error.message,
    });
  }
};



// =================================
// BATCH STUDENTS (admin)
// =================================
const studentShape = (e) => ({
  enrollment_id: e._id,
  user_id: e.user_id?._id || null,
  name:
    [e.user_id?.c_first_name, e.user_id?.c_last_name].filter(Boolean).join(" ") ||
    e.user_id?.c_display_name ||
    "",
  email: e.user_id?.c_email || "",
  contact: e.user_id?.c_contact || "",
  gender: e.user_id?.c_gender || "",
  current_batch_id: e.batch_id?._id || e.batch_id || null,
  current_batch_name: e.batch_id?.batch_name || "",
});

// enrollments that count as "has access to the course"
const activeEnrollmentFilter = {
  status: 1,
  $or: [{ course_type: 1 }, { payment_status: 1 }],
};

const getBatchStudents = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid batch id" });
    }

    const batch = await MasterBatch.findById(id)
      .populate("batch_course", "m_course_title")
      .lean();

    if (!batch) {
      return res.status(404).json({ status: false, message: "Batch not found" });
    }

    const userSelect = "c_first_name c_last_name c_display_name c_email c_contact c_gender";

    const assigned = await CourseEnrollment.find({ batch_id: id })
      .populate("user_id", userSelect)
      .sort({ createdAt: -1 })
      .lean();

    let eligible = [];
    if (batch.batch_course) {
      eligible = await CourseEnrollment.find({
        ...activeEnrollmentFilter,
        course_id: batch.batch_course._id,
        batch_id: { $ne: id },
      })
        .populate("user_id", userSelect)
        .populate("batch_id", "batch_name")
        .sort({ createdAt: -1 })
        .lean();
    }

    return res.status(200).json({
      status: true,
      batch: {
        _id: batch._id,
        batch_name: batch.batch_name,
        batch_instructor: batch.batch_instructor,
        course_title: batch.batch_course?.m_course_title || "",
        batch_date: batch.batch_date,
        start_time: batch.start_time,
        end_time: batch.end_time,
        strength: batch.strength,
        subject: batch.subject,
      },
      assigned: assigned.map(studentShape),
      eligible: eligible.filter((e) => e.user_id).map(studentShape),
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

const assignStudentToBatch = async (req, res) => {
  try {
    const { batch_id, enrollment_id } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(batch_id) ||
      !mongoose.Types.ObjectId.isValid(enrollment_id)
    ) {
      return res
        .status(400)
        .json({ status: false, message: "batch_id and enrollment_id are required" });
    }

    const batch = await MasterBatch.findById(batch_id);
    if (!batch) {
      return res.status(404).json({ status: false, message: "Batch not found" });
    }

    const enrollment = await CourseEnrollment.findOne({
      _id: enrollment_id,
      ...activeEnrollmentFilter,
    });
    if (!enrollment) {
      return res
        .status(404)
        .json({ status: false, message: "Active enrollment not found" });
    }

    if (
      !batch.batch_course ||
      String(enrollment.course_id) !== String(batch.batch_course)
    ) {
      return res.status(400).json({
        status: false,
        message: "Student is not enrolled in this batch's course",
      });
    }

    if (String(enrollment.batch_id) === String(batch._id)) {
      return res
        .status(200)
        .json({ status: true, message: "Student is already in this batch" });
    }

    if (batch.strength > 0) {
      const count = await CourseEnrollment.countDocuments({ batch_id: batch._id });
      if (count >= batch.strength) {
        return res
          .status(400)
          .json({ status: false, message: "Batch is full" });
      }
    }

    enrollment.batch_id = batch._id;
    enrollment.batch_name = batch.batch_name;
    await enrollment.save();

    return res
      .status(200)
      .json({ status: true, message: "Student added to batch" });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

const removeStudentFromBatch = async (req, res) => {
  try {
    const { enrollment_id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(enrollment_id)) {
      return res.status(400).json({ status: false, message: "Invalid enrollment id" });
    }

    const enrollment = await CourseEnrollment.findByIdAndUpdate(
      enrollment_id,
      { batch_id: null, batch_name: null },
      { new: true },
    );

    if (!enrollment) {
      return res.status(404).json({ status: false, message: "Enrollment not found" });
    }

    return res
      .status(200)
      .json({ status: true, message: "Student removed from batch" });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};


module.exports = {
  addBatch,
  updateBatch,
  getAllBatches,
  getSingleBatch,
  deleteBatch,
  getBatchesDropdown,
  appGetRunningBatches,
  getBatchStudents,
  assignStudentToBatch,
  removeStudentFromBatch,
};
