const PrimeHiringDestination = require("../models/prime_hiring_destination");
const { extractUploadedFile, deleteFile } = require("../services/storageService");

// ===============================
// ADMIN
// ===============================

const addDestination = async (req, res) => {
  try {
    const { m_phd_name, m_phd_status, m_phd_order } = req.body;

    const logo = req.files?.m_phd_logo?.[0]
      ? extractUploadedFile(req.files.m_phd_logo[0])
      : null;

    if (!logo) {
      return res.status(400).json({
        status: false,
        message: "Logo image is required",
      });
    }

    const destination = await PrimeHiringDestination.create({
      m_phd_name: m_phd_name || "",
      m_phd_logo: logo.url,
      m_phd_logo_public_id: logo.public_id,
      m_phd_status: m_phd_status !== undefined ? Number(m_phd_status) : 1,
      m_phd_order: m_phd_order !== undefined ? Number(m_phd_order) : 0,
    });

    res.status(201).json({
      status: true,
      message: "Logo added",
      data: destination,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const updateDestination = async (req, res) => {
  try {
    const destination = await PrimeHiringDestination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({
        status: false,
        message: "Logo not found",
      });
    }

    const oldLogoPublicId = destination.m_phd_logo_public_id;

    const { m_phd_name, m_phd_status, m_phd_order } = req.body;

    if (m_phd_name !== undefined) destination.m_phd_name = m_phd_name;
    if (m_phd_status !== undefined)
      destination.m_phd_status = Number(m_phd_status);
    if (m_phd_order !== undefined)
      destination.m_phd_order = Number(m_phd_order);

    if (req.files?.m_phd_logo?.[0]) {
      const uploadedLogo = extractUploadedFile(req.files.m_phd_logo[0]);
      destination.m_phd_logo = uploadedLogo.url;
      destination.m_phd_logo_public_id = uploadedLogo.public_id;
    }

    destination.updated_at = new Date();

    const updated = await destination.save();

    if (req.files?.m_phd_logo?.[0] && oldLogoPublicId) {
      try {
        await deleteFile(oldLogoPublicId);
      } catch (err) {
        console.error("Old hiring-destination logo delete failed:", err.message);
      }
    }

    res.json({
      status: true,
      message: "Logo updated",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const deleteDestination = async (req, res) => {
  try {
    const destination = await PrimeHiringDestination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({
        status: false,
        message: "Logo not found",
      });
    }

    if (destination.m_phd_logo_public_id) {
      try {
        await deleteFile(destination.m_phd_logo_public_id);
      } catch (err) {
        console.error("Hiring-destination logo delete failed:", err.message);
      }
    }

    await PrimeHiringDestination.findByIdAndDelete(req.params.id);

    res.json({ status: true, message: "Logo deleted" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const getAllDestinations = async (req, res) => {
  try {
    let { page = 1, limit = 50 } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 50;

    const total = await PrimeHiringDestination.countDocuments({});
    const data = await PrimeHiringDestination.find({})
      .sort({ m_phd_order: 1, _id: -1 })
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

const changeDestinationStatus = async (req, res) => {
  try {
    const destination = await PrimeHiringDestination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({
        status: false,
        message: "Logo not found",
      });
    }

    destination.m_phd_status = destination.m_phd_status === 1 ? 0 : 1;
    destination.updated_at = new Date();
    await destination.save();

    res.json({
      status: true,
      message: `Status changed to ${destination.m_phd_status === 1 ? "Active" : "Inactive"}`,
      data: destination.m_phd_status,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// PUBLIC
// ===============================

const publicGetDestinations = async (req, res) => {
  try {
    const data = await PrimeHiringDestination.find({ m_phd_status: 1 }).sort({
      m_phd_order: 1,
      _id: -1,
    });

    res.json({ status: true, data });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = {
  addDestination,
  updateDestination,
  deleteDestination,
  getAllDestinations,
  changeDestinationStatus,
  publicGetDestinations,
};
