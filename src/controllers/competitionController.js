const mongoose = require("mongoose");

const Competition = require("../models/competition");
const Quiz = require("../models/quizs");
const { deleteFromCloudinary } = require("../utils/cloudinaryHelper");

const validId = (id) => mongoose.Types.ObjectId.isValid(id);
const has = (v) => v !== undefined && v !== null && v !== "" && v !== "null" && v !== "undefined";

const removeImage = async (path) => {
  try {
    if (path && String(path).startsWith("http")) await deleteFromCloudinary(path);
  } catch (e) {
    console.log("Competition image delete error:", e.message);
  }
};

// null = empty, undefined = invalid, Date = ok
const parseDate = (v) => {
  if (!has(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------- CRUD

const addCompetition = async (req, res) => {
  const uploaded = req.files?.m_competition_image?.[0]?.path || null;
  try {
    const b = req.body;
    if (!has(b.m_competition_title)) {
      await removeImage(uploaded);
      return res.status(400).json({ status: false, message: "Competition title is required" });
    }

    const started = parseDate(b.m_competition_started);
    const ended = parseDate(b.m_competition_ended);
    if (started === undefined || ended === undefined) {
      await removeImage(uploaded);
      return res.status(400).json({ status: false, message: "Invalid date" });
    }
    if (started && ended && ended < started) {
      await removeImage(uploaded);
      return res.status(400).json({ status: false, message: "End date cannot be before the start date" });
    }

    const competition = await Competition.create({
      m_competition_title: b.m_competition_title.trim(),
      m_competition_company: has(b.m_competition_company) ? b.m_competition_company.trim() : "",
      m_competition_des: has(b.m_competition_des) ? b.m_competition_des.trim() : "",
      m_competition_image: uploaded,
      m_competition_started: started,
      m_competition_ended: ended,
      m_competition_priority: has(b.m_competition_priority) ? Number(b.m_competition_priority) || 0 : 0,
      m_competition_status: has(b.m_competition_status) ? Number(b.m_competition_status) : 1,
    });

    return res.status(201).json({ status: true, message: "Competition added successfully", data: competition });
  } catch (error) {
    await removeImage(uploaded);
    return res.status(500).json({ status: false, message: error.message });
  }
};

const getAllCompetitions = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 10));
    const filter = {};
    if (has(req.query.search)) {
      const k = escapeRegex(req.query.search);
      filter.$or = [
        { m_competition_title: { $regex: k, $options: "i" } },
        { m_competition_company: { $regex: k, $options: "i" } },
      ];
    }

    const [total, rows] = await Promise.all([
      Competition.countDocuments(filter),
      Competition.find(filter)
        .select("-m_competition_des")
        .sort({ m_competition_priority: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const data = rows.map((c) => ({ ...c, quiz_count: (c.m_competition_quizzes || []).length }));

    return res.json({
      status: true,
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalRecords: total,
        perPage: limit,
      },
      data,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

const getSingleCompetition = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ status: false, message: "Invalid competition id" });

    const competition = await Competition.findById(req.params.id)
      .populate("m_competition_quizzes", "m_quiz_title m_quiz_package m_quiz_status m_quiz_startdate m_quiz_enddate")
      .lean();
    if (!competition) return res.status(404).json({ status: false, message: "Competition not found" });

    return res.json({ status: true, data: competition });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

const updateCompetition = async (req, res) => {
  const uploaded = req.files?.m_competition_image?.[0]?.path || null;
  try {
    if (!validId(req.params.id)) {
      await removeImage(uploaded);
      return res.status(400).json({ status: false, message: "Invalid competition id" });
    }
    const competition = await Competition.findById(req.params.id);
    if (!competition) {
      await removeImage(uploaded);
      return res.status(404).json({ status: false, message: "Competition not found" });
    }

    const b = req.body;
    const oldImage = competition.m_competition_image;

    if (has(b.m_competition_title)) competition.m_competition_title = b.m_competition_title.trim();
    if (b.m_competition_company !== undefined) competition.m_competition_company = String(b.m_competition_company).trim();
    if (b.m_competition_des !== undefined) competition.m_competition_des = String(b.m_competition_des).trim();
    if (has(b.m_competition_priority)) competition.m_competition_priority = Number(b.m_competition_priority) || 0;
    if (has(b.m_competition_status)) competition.m_competition_status = Number(b.m_competition_status) === 1 ? 1 : 0;

    for (const field of ["m_competition_started", "m_competition_ended"]) {
      if (b[field] !== undefined) {
        const d = parseDate(b[field]);
        if (d === undefined) {
          await removeImage(uploaded);
          return res.status(400).json({ status: false, message: "Invalid date" });
        }
        competition[field] = d;
      }
    }
    if (
      competition.m_competition_started &&
      competition.m_competition_ended &&
      competition.m_competition_ended < competition.m_competition_started
    ) {
      await removeImage(uploaded);
      return res.status(400).json({ status: false, message: "End date cannot be before the start date" });
    }

    if (uploaded) competition.m_competition_image = uploaded;

    await competition.save();
    if (uploaded && oldImage && oldImage !== uploaded) await removeImage(oldImage);

    return res.json({ status: true, message: "Competition updated successfully", data: competition });
  } catch (error) {
    await removeImage(uploaded);
    return res.status(500).json({ status: false, message: error.message });
  }
};

const deleteCompetition = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ status: false, message: "Invalid competition id" });

    const competition = await Competition.findByIdAndDelete(req.params.id);
    if (!competition) return res.status(404).json({ status: false, message: "Competition not found" });

    await removeImage(competition.m_competition_image);
    return res.json({ status: true, message: "Competition deleted successfully" });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

const toggleCompetitionStatus = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ status: false, message: "Invalid competition id" });

    const competition = await Competition.findById(req.params.id);
    if (!competition) return res.status(404).json({ status: false, message: "Competition not found" });

    competition.m_competition_status = competition.m_competition_status === 1 ? 0 : 1;
    await competition.save();

    return res.json({
      status: true,
      message: `Competition ${competition.m_competition_status === 1 ? "activated" : "deactivated"}`,
      data: { m_competition_status: competition.m_competition_status },
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ---------------------------------------------------------------- quizzes

const addCompetitionQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { quiz_id } = req.body;
    if (!validId(id) || !validId(quiz_id)) {
      return res.status(400).json({ status: false, message: "Valid competition and quiz ids are required" });
    }
    if (!(await Quiz.exists({ _id: quiz_id }))) {
      return res.status(404).json({ status: false, message: "Quiz not found" });
    }

    const updated = await Competition.findByIdAndUpdate(
      id,
      { $addToSet: { m_competition_quizzes: quiz_id } },
      { new: true },
    );
    if (!updated) return res.status(404).json({ status: false, message: "Competition not found" });

    return res.json({ status: true, message: "Quiz added to competition" });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

const removeCompetitionQuiz = async (req, res) => {
  try {
    const { id, quiz_id } = req.params;
    if (!validId(id) || !validId(quiz_id)) {
      return res.status(400).json({ status: false, message: "Valid competition and quiz ids are required" });
    }

    const updated = await Competition.findByIdAndUpdate(id, { $pull: { m_competition_quizzes: quiz_id } }, { new: true });
    if (!updated) return res.status(404).json({ status: false, message: "Competition not found" });

    return res.json({ status: true, message: "Quiz removed from competition" });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

module.exports = {
  addCompetition,
  getAllCompetitions,
  getSingleCompetition,
  updateCompetition,
  deleteCompetition,
  toggleCompetitionStatus,
  addCompetitionQuiz,
  removeCompetitionQuiz,
};
