const Instruction = require("../models/quiz_instructions");
const Quiz = require("../models/quizs");
const mongoose = require("mongoose");

// ===============================
// ADD INSTRUCTION
// ===============================
const addInstruction = async (req, res) => {
  try {
    let { m_instruction_key, m_instruction_value, m_instruction_quiz } = req.body;

    // 1. VALIDATION
    if (!m_instruction_key) {
      return res.status(400).json({ status: false, message: "Instruction key is required" });
    }

    // 2. AUTO-INCREMENT ID
    const lastInstruction = await Instruction.findOne().sort({ m_instruction_id: -1 });
    const newId = lastInstruction ? lastInstruction.m_instruction_id + 1 : 1;

    // 3. HANDLE QUIZ ARRAY
    let quizIds = [];
    if (m_instruction_quiz) {
      // Agar string hai (e.g., "id1,id2") to array banayein
      if (typeof m_instruction_quiz === 'string') {
        quizIds = m_instruction_quiz.split(',').map(id => id.trim());
      } 
      // Agar pehle se array hai
      else if (Array.isArray(m_instruction_quiz)) {
        quizIds = m_instruction_quiz;
      }
    }

    // 4. CREATE & SAVE
    const newInstruction = new Instruction({
      m_instruction_id: newId,
      m_instruction_key,
      m_instruction_value: m_instruction_value || null,
      m_instruction_quiz: quizIds,
    });

    const saved = await newInstruction.save();
    res.status(201).json({ status: true, message: "Instruction added successfully", data: saved });

  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// GET ALL INSTRUCTIONS
// ===============================
const getAllInstructions = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    let filter = {};
    if (search) {
      filter.m_instruction_key = { $regex: search, $options: "i" };
    }

    const total = await Instruction.countDocuments(filter);
    const data = await Instruction.find(filter)
      .populate('m_instruction_quiz', '_id m_quiz_title') // ✅ Quizzes ke naam bhi dikhayega
      .sort({ m_instruction_id: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      status: true,
      pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) },
      data,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// GET INSTRUCTIONS BY QUIZ ID
// ===============================
const getInstructionsByQuizId = async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return res.status(400).json({ status: false, message: "Invalid Quiz ID format" });
    }

    // Find all instructions where the m_instruction_quiz array contains the quizId
    const instructions = await Instruction.find({ m_instruction_quiz: quizId });
    
    if (!instructions || instructions.length === 0) {
        return res.json({ status: true, message: "No instructions found for this quiz", data: [] });
    }
    
    res.json({ status: true, data: instructions });

  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// UPDATE INSTRUCTION
// ===============================
const updateInstruction = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid Instruction ID" });
    }

    const instruction = await Instruction.findById(id);
    if (!instruction) {
      return res.status(404).json({ status: false, message: "Instruction not found" });
    }
    
    const { m_instruction_key, m_instruction_value, m_instruction_quiz } = req.body;
    
    if (m_instruction_key) instruction.m_instruction_key = m_instruction_key;
    if (m_instruction_value !== undefined) instruction.m_instruction_value = m_instruction_value;
    
    // HANDLE QUIZ ARRAY UPDATE
    if (m_instruction_quiz) {
      let quizIds = [];
      if (typeof m_instruction_quiz === 'string') {
        quizIds = m_instruction_quiz.split(',').map(id => id.trim());
      } else if (Array.isArray(m_instruction_quiz)) {
        quizIds = m_instruction_quiz;
      }
      instruction.m_instruction_quiz = quizIds;
    }

    const updated = await instruction.save();
    res.json({ status: true, message: "Instruction updated successfully", data: updated });

  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// DELETE INSTRUCTION
// ===============================
const deleteInstruction = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid Instruction ID" });
    }
    
    const deleted = await Instruction.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ status: false, message: "Instruction not found" });
    }
    
    res.json({ status: true, message: "Instruction deleted successfully" });

  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};


module.exports = {
  addInstruction,
  getAllInstructions,
  getInstructionsByQuizId,
  updateInstruction,
  deleteInstruction,
};