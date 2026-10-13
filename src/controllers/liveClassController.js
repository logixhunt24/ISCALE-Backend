const LiveClass = require("../models/live_class");
const Batch = require("../models/batch");
const Team = require("../models/our_teams");

// =================================
// CHECK VALID VALUE
// =================================
const isValidValue = (value) => {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    value !== "null" &&
    value !== "undefined"
  );
};

const isValidMeetingLink = (value) => {
  if (!isValidValue(value)) return false;
  try {
    const u = new URL(String(value).trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

// =================================
// ADD LIVE CLASS
// =================================
const addLiveClass = async (req, res) => {
  try {
    const {
      title,
      class_date,
      duration,
      start_time,
      meeting_link,
      batch_id,
      teacher_id,
    } = req.body;

    // ==============================
    // VALIDATION
    // ==============================
    if (!isValidValue(title)) {
      return res.status(400).json({
        status: false,
        message: "Title is required",
      });
    }

    if (!isValidValue(class_date) || Number.isNaN(new Date(class_date).getTime())) {
      return res.status(400).json({
        status: false,
        message: "A valid class date is required",
      });
    }

    if (!isValidValue(batch_id)) {
      return res.status(400).json({
        status: false,
        message: "Batch is required",
      });
    }

    if (!isValidValue(teacher_id)) {
      return res.status(400).json({
        status: false,
        message: "Teacher is required",
      });
    }

    if (!isValidMeetingLink(meeting_link)) {
      return res.status(400).json({
        status: false,
        message: "A valid meeting link (http/https) is required",
      });
    }

    // ==============================
    // CREATE OBJECT
    // ==============================
    const liveClassData = {};

    liveClassData.title = title;

    // ==============================
    // CHECK BATCH
    // ==============================
    if (isValidValue(batch_id)) {
      const batchExists = await Batch.findById(batch_id);

      if (!batchExists) {
        return res.status(400).json({
          status: false,
          message: "Invalid batch id",
        });
      }

      liveClassData.batch_id = batch_id;
    }

    // ==============================
    // CHECK TEACHER
    // ==============================
    if (isValidValue(teacher_id)) {
      const teacherExists = await Team.findOne({
        _id: teacher_id,
        member_type: 2,
      });

      if (!teacherExists) {
        return res.status(400).json({
          status: false,
          message: "Invalid teacher id",
        });
      }

      liveClassData.teacher_id = teacher_id;
    }

    // ==============================
    // OPTIONAL FIELDS
    // ==============================
    if (isValidValue(class_date)) {
      liveClassData.class_date = class_date;
    }

    if (isValidValue(duration)) {
      liveClassData.duration = Number(duration);
    }

    if (isValidValue(start_time)) {
      liveClassData.start_time = start_time;
    }

    if (isValidValue(meeting_link)) {
      liveClassData.meeting_link = meeting_link;
    }

    // ==============================
    // CREATE
    // ==============================
    const liveClass = await LiveClass.create(liveClassData);

    return res.status(201).json({
      status: true,
      message: "Live class added successfully",
      data: liveClass,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// =================================
// UPDATE LIVE CLASS
// =================================
const updateLiveClass = async (req, res) => {
  try {
    const { id } = req.params;

    // ==============================
    // FIND LIVE CLASS
    // ==============================
    const existingLiveClass = await LiveClass.findById(id);

    if (!existingLiveClass) {
      return res.status(404).json({
        status: false,
        message: "Live class not found",
      });
    }

    // ==============================
    // UPDATE OBJECT
    // ==============================
    const updateData = {};

    // ==============================
    // TITLE
    // ==============================
    if (isValidValue(req.body.title)) {
      updateData.title = req.body.title;
    }

    // ==============================
    // CLASS DATE
    // ==============================
    if (isValidValue(req.body.class_date)) {
      updateData.class_date = req.body.class_date;
    }

    // ==============================
    // DURATION
    // ==============================
    if (isValidValue(req.body.duration)) {
      updateData.duration = Number(req.body.duration);
    }

    // ==============================
    // START TIME
    // ==============================
    if (req.body.start_time !== undefined) {
      updateData.start_time = isValidValue(req.body.start_time)
        ? req.body.start_time
        : "";
    }

    // ==============================
    // MEETING LINK
    // ==============================
    if (isValidValue(req.body.meeting_link)) {
      if (!isValidMeetingLink(req.body.meeting_link)) {
        return res.status(400).json({
          status: false,
          message: "A valid meeting link (http/https) is required",
        });
      }
      updateData.meeting_link = String(req.body.meeting_link).trim();
    }

    // ==============================
    // CHECK BATCH
    // ==============================
    if (isValidValue(req.body.batch_id)) {
      const batchExists = await Batch.findById(req.body.batch_id);

      if (!batchExists) {
        return res.status(400).json({
          status: false,
          message: "Invalid batch id",
        });
      }

      updateData.batch_id = req.body.batch_id;
    }

    // ==============================
    // CHECK TEACHER
    // ==============================
    if (isValidValue(req.body.teacher_id)) {
      const teacherExists = await Team.findOne({
        _id: req.body.teacher_id,
        member_type: 2,
      });

      if (!teacherExists) {
        return res.status(400).json({
          status: false,
          message: "Invalid teacher id",
        });
      }

      updateData.teacher_id = req.body.teacher_id;
    }

    // ==============================
    // UPDATE
    // ==============================
    const updatedLiveClass = await LiveClass.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
      }
    );

    return res.status(200).json({
      status: true,
      message: "Live class updated successfully",
      data: updatedLiveClass,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

module.exports = {
  addLiveClass,
  updateLiveClass,
};


// GET ALL LIVE CLASSES

const getAllLiveClasses = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      from_date,
      to_date,
      batch,
      teacher,
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = {};


    // DATE FILTER
    if (isValidValue(from_date) || isValidValue(to_date)) {
      filter.class_date = {};

      if (isValidValue(from_date)) {
        filter.class_date.$gte = new Date(from_date);
      }

      if (isValidValue(to_date)) {
        filter.class_date.$lte = new Date(to_date);
      }
    }


    // BATCH FILTER

    if (isValidValue(batch)) {
      filter.batch_id = batch;
    }

    // TEACHER FILTER
    if (isValidValue(teacher)) {
      filter.teacher_id = teacher;
    }


    // TOTAL

    const total = await LiveClass.countDocuments(filter);

   // GET DATA
 
    const liveClasses = await LiveClass.find(filter)
      .populate("batch_id", "batch_name")
      .populate("teacher_id", "member_name")
      .select(
        "title class_date duration meeting_link start_time batch_id teacher_id",
      )
      .sort({ class_date: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      status: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      data: liveClasses,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


// GET SINGLE LIVE CLASS

const getSingleLiveClass = async (req, res) => {
  try {
    const { id } = req.params;

    const liveClass = await LiveClass.findById(id)
      .populate("batch_id")
      .populate("teacher_id");

    if (!liveClass) {
      return res.status(404).json({
        status: false,
        message: "Live class not found",
      });
    }

    return res.status(200).json({
      status: true,
      data: liveClass,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};


// DELETE LIVE CLASS

const deleteLiveClass = async (req, res) => {
  try {
    const { id } = req.params;

    const liveClass = await LiveClass.findById(id);

    if (!liveClass) {
      return res.status(404).json({
        status: false,
        message: "Live class not found",
      });
    }

    await LiveClass.findByIdAndDelete(id);

    return res.status(200).json({
      status: true,
      message: "Live class deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

module.exports = {
  addLiveClass,
  updateLiveClass,
  getAllLiveClasses,
  getSingleLiveClass,
  deleteLiveClass,
};
