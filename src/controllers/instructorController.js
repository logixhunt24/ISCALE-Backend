const Instructor = require("../models/instructor");
const slugify = require("slugify");
const mongoose = require("mongoose");
const fs = require("fs");

// ===============================
// ADD INSTRUCTOR
// ===============================
const addInstructor = async (req, res) => {
  try {
    let {
      m_instructor_name,
      m_instructor_email,
      m_instructor_phone,
      m_linkedin_profile,
      m_instructor_bio,
      m_instructor_designation,
      m_instructor_experience,
      m_instructor_skills,
      m_instructor_status,
      m_instructor_order,
    } = req.body || {};

    // REQUIRED
    if (!m_instructor_name || !m_instructor_email) {
      return res.status(400).json({
        status: false,
        message: "Instructor name and email are required",
      });
    }

    // EMAIL FORMAT
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(m_instructor_email)) {
      return res.status(400).json({
        status: false,
        message: "Invalid email format",
      });
    }

    m_instructor_email = m_instructor_email.trim().toLowerCase();

    // DUPLICATE EMAIL CHECK
    const existingEmail = await Instructor.findOne({
      m_instructor_email,
    });

    if (existingEmail) {
      return res.status(409).json({
        status: false,
        message: "Email already exists",
      });
    }

    // SLUG
    let slug = slugify(m_instructor_name, {
      lower: true,
      strict: true,
    });

    const slugExists = await Instructor.findOne({
      m_instructor_slug: slug,
    });

    if (slugExists) slug += "-" + Date.now();

    // SKILLS (ARRAY ONLY)
    // let skills = [];
    // if (m_instructor_skills) {
    //   if (Array.isArray(m_instructor_skills)) {
    //     skills = m_instructor_skills;
    //   } else {
    //     return res.status(400).json({
    //       status: false,
    //       message: "Skills must be an array",
    //     });
    //   }
    // }

    let skills = [];
    if (m_instructor_skills) {
      try {
        // Agar skills string hai to parse karo, nahi to direct use karo
        skills =
          typeof m_instructor_skills === "string"
            ? JSON.parse(m_instructor_skills)
            : m_instructor_skills;

        if (!Array.isArray(skills)) throw new Error(); // Check karein ki result array hai ya nahi
      } catch (e) {
        return res.status(400).json({
          status: false,
          message:
            'Skills must be a valid JSON array string. e.g., \'["JS","React"]\'',
        });
      }
    }

    const imagePath = req.files?.m_instructor_profile
      ? req.files.m_instructor_profile[0].path
      : null;

    const newInstructor = new Instructor({
      m_instructor_name,
      m_instructor_slug: slug,
      m_instructor_email,
      m_instructor_phone,
      m_linkedin_profile,
      m_instructor_profile: imagePath,
      m_instructor_bio,
      m_instructor_designation,
      m_instructor_experience,
      m_instructor_skills: skills,
      m_instructor_status:
        m_instructor_status !== undefined ? Number(m_instructor_status) : 1,
      m_instructor_order: m_instructor_order
        ? Number(m_instructor_order)
        : null,
    });

    const saved = await newInstructor.save();

    res.status(201).json({
      status: true,
      message: "Instructor added successfully",
      data: saved,
    });
  } catch (err) {
    if (req.files?.m_instructor_profile) {
      fs.unlinkSync(req.files.m_instructor_profile[0].path);
    }
    res.status(500).json({
      status: false,
      message: "Error adding instructor: " + err.message,
    });
  }
};

// ===============================
// GET ALL INSTRUCTORS
// ===============================
const getAllInstructors = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", status } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    let filter = {};

    // SEARCH
    if (search) {
      filter.$or = [
        { m_instructor_name: { $regex: search, $options: "i" } },
        { m_instructor_email: { $regex: search, $options: "i" } },
      ];
    }

    // STATUS
    if (status !== undefined) {
      filter.m_instructor_status = Number(status);
    }

    const total = await Instructor.countDocuments(filter);

    const data = await Instructor.find(filter)
      .sort({ m_instructor_order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      status: true,
      message: "Instructor list fetched",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// ===============================
// UPDATE INSTRUCTOR
// ===============================
const updateInstructor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid instructor ID",
      });
    }

    const instructor = await Instructor.findById(id);

    if (!instructor) {
      return res.status(404).json({
        status: false,
        message: "Instructor not found",
      });
    }

    let {
      m_instructor_name,
      m_instructor_email,
      m_instructor_phone,
      m_instructor_bio,
      m_instructor_designation,
      m_linkedin_profile,
      m_instructor_experience,
      m_instructor_skills,
      m_instructor_status,
      m_instructor_order,
    } = req.body || {};

    // EMAIL UPDATE
    if (m_instructor_email) {
      m_instructor_email = m_instructor_email.trim().toLowerCase();

      const existingEmail = await Instructor.findOne({
        m_instructor_email,
        _id: { $ne: id },
      });

      if (existingEmail) {
        return res.status(409).json({
          status: false,
          message: "Email already exists",
        });
      }

      instructor.m_instructor_email = m_instructor_email;
    }

    if (req.files?.m_instructor_profile) {
      // Delete old image if it exists
      if (
        instructor.m_instructor_profile &&
        fs.existsSync(instructor.m_instructor_profile)
      ) {
        fs.unlinkSync(instructor.m_instructor_profile);
      }
      // Update with new image path
      instructor.m_instructor_profile = req.files.m_instructor_profile[0].path;
    }

    // NAME + SLUG UPDATE
    if (m_instructor_name) {
      instructor.m_instructor_name = m_instructor_name;

      let slug = slugify(m_instructor_name, {
        lower: true,
        strict: true,
      });

      const slugExists = await Instructor.findOne({
        m_instructor_slug: slug,
        _id: { $ne: id },
      });

      if (slugExists) slug += "-" + Date.now();

      instructor.m_instructor_slug = slug;
    }

    if (m_instructor_phone) instructor.m_instructor_phone = m_instructor_phone;

    if (m_linkedin_profile !== undefined) {
      instructor.m_linkedin_profile = m_linkedin_profile;
    }

    if (m_instructor_bio) instructor.m_instructor_bio = m_instructor_bio;

    if (m_instructor_designation !== undefined)
      instructor.m_instructor_designation = m_instructor_designation;

    if (m_instructor_experience)
      instructor.m_instructor_experience = m_instructor_experience;

    // SKILLS UPDATE
    // if (m_instructor_skills) {
    //   if (Array.isArray(m_instructor_skills)) {
    //     instructor.m_instructor_skills = m_instructor_skills;
    //   } else {
    //     return res.status(400).json({
    //       status: false,
    //       message: "Skills must be an array",
    //     });
    //   }
    // }

    if (m_instructor_skills) {
      try {
        // Agar skills string hai to parse karo, nahi to direct use karo
        const skills =
          typeof m_instructor_skills === "string"
            ? JSON.parse(m_instructor_skills)
            : m_instructor_skills;

        if (!Array.isArray(skills)) throw new Error(); // Check karein ki result array hai ya nahi

        instructor.m_instructor_skills = skills; // Database me update karein
      } catch (e) {
        return res.status(400).json({
          status: false,
          message:
            'Skills must be a valid JSON array string. e.g., \'["JS","React"]\'',
        });
      }
    }

    if (m_instructor_status !== undefined)
      instructor.m_instructor_status = Number(m_instructor_status);

    if (m_instructor_order)
      instructor.m_instructor_order = Number(m_instructor_order);

    instructor.m_instructor_modified = new Date();

    const updated = await instructor.save();

    res.json({
      status: true,
      message: "Instructor updated successfully",
      data: updated,
    });
  } catch (err) {
    if (req.files?.m_instructor_profile) {
      fs.unlinkSync(req.files.m_instructor_profile[0].path);
    }
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// ===============================
// DELETE INSTRUCTOR
// ===============================
const deleteInstructor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid instructor ID",
      });
    }

    const instructor = await Instructor.findById(id);

    if (!instructor) {
      return res.status(404).json({
        status: false,
        message: "Instructor not found",
      });
    }

    if (
      instructor.m_instructor_profile &&
      fs.existsSync(instructor.m_instructor_profile)
    ) {
      fs.unlinkSync(instructor.m_instructor_profile);
    }

    await Instructor.findByIdAndDelete(id);

    res.json({
      status: true,
      message: "Instructor deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// ===============================
// DROPDOWN
// ===============================
const getInstructorDropdown = async (req, res) => {
  try {
    const data = await Instructor.find({
      m_instructor_status: 1,
    })
      .select("_id m_instructor_name")
      .sort({ m_instructor_order: 1 });

    res.json({
      status: true,
      data: data.map((i) => ({
        _id: i._id,
        name: i.m_instructor_name,
      })),
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

module.exports = {
  addInstructor,
  getAllInstructors,
  updateInstructor,
  deleteInstructor,
  getInstructorDropdown,
};
