const CareerFit = require("../models/career_fit");
const { extractUploadedFile, deleteFile } = require("../services/storageService");

// ===============================
// ADMIN
// ===============================

const addCareerFit = async (req, res) => {
  try {
    const { m_cf_title, m_cf_desc, m_cf_keywords, m_cf_status, m_cf_order } =
      req.body;

    if (!m_cf_title) {
      return res.status(400).json({
        status: false,
        message: "Title is required",
      });
    }

    const icon = req.files?.m_cf_icon?.[0]
      ? extractUploadedFile(req.files.m_cf_icon[0])
      : null;

    const careerFit = await CareerFit.create({
      m_cf_title: m_cf_title.trim(),
      m_cf_desc: m_cf_desc || "",
      m_cf_keywords: m_cf_keywords || "",
      m_cf_icon: icon?.url || "",
      m_cf_icon_public_id: icon?.public_id || "",
      m_cf_status: m_cf_status !== undefined ? Number(m_cf_status) : 1,
      m_cf_order: m_cf_order !== undefined ? Number(m_cf_order) : 0,
    });

    res.status(201).json({
      status: true,
      message: "Career fit goal created",
      data: careerFit,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const updateCareerFit = async (req, res) => {
  try {
    const careerFit = await CareerFit.findById(req.params.id);

    if (!careerFit) {
      return res.status(404).json({
        status: false,
        message: "Career fit goal not found",
      });
    }

    const oldIconPublicId = careerFit.m_cf_icon_public_id;

    const { m_cf_title, m_cf_desc, m_cf_keywords, m_cf_status, m_cf_order } =
      req.body;

    if (m_cf_title !== undefined) careerFit.m_cf_title = m_cf_title.trim();
    if (m_cf_desc !== undefined) careerFit.m_cf_desc = m_cf_desc;
    if (m_cf_keywords !== undefined) careerFit.m_cf_keywords = m_cf_keywords;
    if (m_cf_status !== undefined) careerFit.m_cf_status = Number(m_cf_status);
    if (m_cf_order !== undefined) careerFit.m_cf_order = Number(m_cf_order);

    if (req.files?.m_cf_icon?.[0]) {
      const uploadedIcon = extractUploadedFile(req.files.m_cf_icon[0]);
      careerFit.m_cf_icon = uploadedIcon.url;
      careerFit.m_cf_icon_public_id = uploadedIcon.public_id;
    } else if (
      req.body.remove_m_cf_icon === "true" ||
      req.body.remove_m_cf_icon === true
    ) {
      careerFit.m_cf_icon = "";
      careerFit.m_cf_icon_public_id = "";
    }

    careerFit.updated_at = new Date();

    const updated = await careerFit.save();

    if (req.files?.m_cf_icon?.[0] && oldIconPublicId) {
      try {
        await deleteFile(oldIconPublicId);
      } catch (err) {
        console.error("Old career-fit icon delete failed:", err.message);
      }
    }

    res.json({
      status: true,
      message: "Career fit goal updated",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const deleteCareerFit = async (req, res) => {
  try {
    const careerFit = await CareerFit.findById(req.params.id);

    if (!careerFit) {
      return res.status(404).json({
        status: false,
        message: "Career fit goal not found",
      });
    }

    if (careerFit.m_cf_icon_public_id) {
      try {
        await deleteFile(careerFit.m_cf_icon_public_id);
      } catch (err) {
        console.error("Career-fit icon delete failed:", err.message);
      }
    }

    await CareerFit.findByIdAndDelete(req.params.id);

    res.json({ status: true, message: "Career fit goal deleted" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const getAllCareerFits = async (req, res) => {
  try {
    let { page = 1, limit = 50, search = "" } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 50;

    let filter = {};
    if (search) {
      filter.m_cf_title = { $regex: search, $options: "i" };
    }

    const total = await CareerFit.countDocuments(filter);
    const data = await CareerFit.find(filter)
      .sort({ m_cf_order: 1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      status: true,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const changeCareerFitStatus = async (req, res) => {
  try {
    const careerFit = await CareerFit.findById(req.params.id);

    if (!careerFit) {
      return res.status(404).json({
        status: false,
        message: "Career fit goal not found",
      });
    }

    careerFit.m_cf_status = careerFit.m_cf_status === 1 ? 0 : 1;
    careerFit.updated_at = new Date();
    await careerFit.save();

    res.json({
      status: true,
      message: `Status changed to ${careerFit.m_cf_status === 1 ? "Active" : "Inactive"}`,
      data: careerFit.m_cf_status,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// PUBLIC
// ===============================

const publicGetCareerFits = async (req, res) => {
  try {
    const data = await CareerFit.find({ m_cf_status: 1 }).sort({
      m_cf_order: 1,
      _id: -1,
    });

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = {
  addCareerFit,
  updateCareerFit,
  deleteCareerFit,
  getAllCareerFits,
  changeCareerFitStatus,
  publicGetCareerFits,
};
