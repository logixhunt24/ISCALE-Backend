console.log("course feature Controller Hit");

const Feature = require("../models/course_feature");
const Course = require("../models/course");
// const fs = require("fs");
const mongoose = require("mongoose");
const {
  extractUploadedFile,
  deleteFile,
} = require("../services/storageService");

// ===============================
// ADD FEATURE
// ===============================
const addFeature = async (req, res) => {
  // console.log("req.file =>", req.file);
  // console.log("req.body =>", req.body);

  let uploaded = req.file ? extractUploadedFile(req.file) : null;
  try {
    const { m_course_id, m_feature_title, m_feature_desc, m_feature_status } =
      req.body;

    // VALIDATION
    if (
      !m_course_id ||
      !m_feature_title ||
      !m_feature_desc ||
      m_feature_status === undefined
    ) {
      if (uploaded?.public_id) {
        await deleteFile(uploaded.public_id);
      }

      return res.status(400).json({
        status: false,
        message: "course_id, title, description and status are required",
      });
    }

    // CHECK COURSE
    const course = await Course.findById(m_course_id);
    // if (!course) {
    //   await deleteFile(uploaded.public_id);
    //   return res.status(404).json({
    //     status: false,
    //     message: "Course not found",
    //   });
    // }

    if (!course) {
      if (uploaded?.public_id) {
        await deleteFile(uploaded.public_id);
      }

      return res.status(404).json({
        status: false,
        message: "Course not found",
      });
    }

    // IMAGE OPTIONAL
    // let image = null;
    // if (req.files?.["m_feature_image"]) {
    //   image = req.files["m_feature_image"][0].path;
    // }

    let image = null;
    let public_id = null;

    if (req.file) {
      image = uploaded.url;
      public_id = uploaded.public_id;
    }

    const newFeature = new Feature({
      m_feature_course: m_course_id,
      m_feature_course_slug: course.m_course_slug,
      m_feature_title,
      m_feature_desc,
      m_feature_image: image,
      m_feature_image_public_id: public_id,
      m_feature_status: Number(m_feature_status),
    });

    const saved = await newFeature.save();

    // SUCCESS
    // uploaded = null;

    res.status(201).json({
      status: true,
      message: "Feature added successfully",
      data: saved,
    });
  } catch (err) {
    if (uploaded?.public_id) {
      await deleteFile(uploaded.public_id);
    }
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// GET FEATURES BY COURSE
// ===============================
const getFeaturesByCourse = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid course ID",
      });
    }

    // Same admin-sees-everything / public-sees-active-only split used by
    // compRequirementController's getAllJobs - this handler is shared by
    // both the authenticated admin route and the public one.
    const filter = req.user
      ? { m_feature_course: id }
      : { m_feature_course: id, m_feature_status: 1 };

    const data = await Feature.find(filter).sort({ _id: -1 });

    res.json({
      status: true,
      data,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// UPDATE FEATURE
// ===============================
const updateFeature = async (req, res) => {
  let uploaded = null;
  try {
    const { id } = req.params;

    const feature = await Feature.findById(id);
    if (!feature) {
      return res.status(404).json({
        status: false,
        message: "Feature not found",
      });
    }

    const { m_feature_title, m_feature_desc, m_feature_status, } = req.body;

    if (m_feature_title) feature.m_feature_title = m_feature_title;
    if (m_feature_desc) feature.m_feature_desc = m_feature_desc;
    if (m_feature_status !== undefined)
      feature.m_feature_status = Number(m_feature_status);

    // IMAGE UPDATE
    // if (req.files?.["m_feature_image"]) {
    //   if (feature.m_feature_image && fs.existsSync(feature.m_feature_image)) {
    //     fs.unlinkSync(feature.m_feature_image);
    //   }

    //   feature.m_feature_image = req.files["m_feature_image"][0].path;
    // }

    // if (req.file?.["m_feature_image"]) {
    //   uploaded = extractUploadedFile(req.file["m_feature_image"][0]);

    //   if (feature.m_feature_image_public_id) {
    //     await deleteFile(feature.m_feature_image_public_id);
    //   }

    //   feature.m_feature_image = uploaded.url;
    //   feature.m_feature_image_public_id = uploaded.public_id;
    // }

    const oldPublicId = feature.m_feature_image_public_id;

    if (req.file) {
      uploaded = extractUploadedFile(req.file);

      feature.m_feature_image = uploaded.url;
      feature.m_feature_image_public_id = uploaded.public_id;
    }

    const updated = await feature.save();

    try {
      if (oldPublicId) {
        await deleteFile(oldPublicId);
      }
    } catch (err) {
      console.error("Old image delete failed:", err.message);
    }

    res.json({
      status: true,
      message: "Feature updated successfully",
      data: updated,
    });
  } catch (err) {
    if (uploaded?.public_id) {
      await deleteFile(uploaded.public_id);
    }
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// DELETE FEATURE
// ===============================
const deleteFeature = async (req, res) => {
  try {
    const { id } = req.params;

    const feature = await Feature.findById(id);
    if (!feature) {
      return res.status(404).json({
        status: false,
        message: "Feature not found",
      });
    }

    if (feature.m_feature_image_public_id) {
      await deleteFile(feature.m_feature_image_public_id);
    }

    await Feature.findByIdAndDelete(id);

    res.json({
      status: true,
      message: "Feature deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = {
  addFeature,
  getFeaturesByCourse,
  updateFeature,
  deleteFeature,
};
