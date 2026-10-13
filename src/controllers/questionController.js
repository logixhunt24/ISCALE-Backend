const Question = require("../models/questions"); // Make sure the path is correct
const mongoose = require("mongoose");

// ===============================
// ADD QUESTION
// ===============================
const addQuestion = async (req, res) => {
  try {
    const {
      m_ques_quiz, // The ID of the quiz this question belongs to
      m_ques_title_en, // The question text
      m_ques_op1_en,
      m_ques_op2_en,
      m_ques_op3_en,
      m_ques_op4_en,
      m_ques_ans,
      m_ques_solutions,
    } = req.body;

    // 1. VALIDATION
    // ✅ Only question title is mandatory as per your request
    if (!m_ques_title_en) {
      return res.status(400).json({
        status: false,
        message: "Question text (m_ques_title_en) is required",
      });
    }
    // A question must belong to a quiz
    if (!m_ques_quiz || !mongoose.Types.ObjectId.isValid(m_ques_quiz)) {
        return res.status(400).json({
          status: false,
          message: "A valid Quiz ID (m_ques_quiz) is required",
        });
    }
    // Validate answer if provided
    if (m_ques_ans && !["A", "B", "C", "D"].includes(m_ques_ans.toUpperCase())) {
        return res.status(400).json({
            status: false,
            message: "Answer (m_ques_ans) must be A, B, C, or D",
        });
    }

    // 2. AUTO-INCREMENT ID
    const lastQuestion = await Question.findOne().sort({ m_ques_id: -1 });
    const newId = lastQuestion ? lastQuestion.m_ques_id + 1 : 1;

    // 3. CREATE & SAVE
    const newQuestion = new Question({
      m_ques_id: newId,
      m_ques_quiz,
      m_ques_title_en,
      m_ques_op1_en: m_ques_op1_en || null,
      m_ques_op2_en: m_ques_op2_en || null,
      m_ques_op3_en: m_ques_op3_en || null,
      m_ques_op4_en: m_ques_op4_en || null,
      m_ques_ans: m_ques_ans ? m_ques_ans.toUpperCase() : null,
      m_ques_solutions: m_ques_solutions || null,
    });

    const saved = await newQuestion.save();
    res.status(201).json({ status: true, message: "Question added successfully", data: saved });

  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// BULK ADD QUESTIONS (CSV import)
// ===============================
const bulkAddQuestions = async (req, res) => {
  try {
    const { m_ques_quiz, questions } = req.body;

    if (!m_ques_quiz || !mongoose.Types.ObjectId.isValid(m_ques_quiz)) {
      return res.status(400).json({ status: false, message: "A valid Quiz ID (m_ques_quiz) is required" });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ status: false, message: "No questions to import" });
    }
    if (questions.length > 500) {
      return res.status(400).json({ status: false, message: "Import at most 500 questions at a time" });
    }

    const clean = (v) => (v === undefined || v === null ? "" : String(v).trim());
    const errors = [];
    const docs = [];

    questions.forEach((row, i) => {
      const line = i + 1;
      const title = clean(row.m_ques_title_en);
      const ops = [1, 2, 3, 4].map((n) => clean(row[`m_ques_op${n}_en`]));
      const ans = clean(row.m_ques_ans).toUpperCase();

      if (!title) return errors.push({ row: line, message: "Question text is missing" });
      if (ops.filter(Boolean).length < 2) return errors.push({ row: line, message: "At least two options are required" });
      if (!["A", "B", "C", "D"].includes(ans)) return errors.push({ row: line, message: "Correct answer must be A, B, C or D" });
      if (!ops["ABCD".indexOf(ans)]) return errors.push({ row: line, message: `Option ${ans} is empty but marked correct` });

      docs.push({
        m_ques_quiz,
        m_ques_title_en: title,
        m_ques_op1_en: ops[0] || null,
        m_ques_op2_en: ops[1] || null,
        m_ques_op3_en: ops[2] || null,
        m_ques_op4_en: ops[3] || null,
        m_ques_ans: ans,
        m_ques_solutions: clean(row.m_ques_solutions) || null,
      });
    });

    // all-or-nothing: a partial import is hard to untangle
    if (errors.length) {
      return res.status(400).json({
        status: false,
        message: `${errors.length} row(s) have problems. Nothing was imported.`,
        errors,
      });
    }

    const last = await Question.findOne().sort({ m_ques_id: -1 }).select("m_ques_id");
    let nextId = last && last.m_ques_id ? last.m_ques_id + 1 : 1;
    docs.forEach((d) => { d.m_ques_id = nextId++; });

    await Question.insertMany(docs);
    return res.status(201).json({ status: true, message: `${docs.length} question(s) imported`, imported: docs.length });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// GET QUESTIONS BY QUIZ ID
// ===============================
const getQuestionsByQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return res.status(400).json({ status: false, message: "Invalid Quiz ID" });
    }

    // Find questions and select only the required fields
    const questions = await Question.find({ m_ques_quiz: quizId })
      .select('m_ques_title_en m_ques_op1_en m_ques_op2_en m_ques_op3_en m_ques_op4_en m_ques_ans m_ques_solutions')
      .sort({ _id: 1 });

    if (questions.length === 0) {
        return res.json({ status: true, message: "No questions found for this quiz", data: [] });
    }

    res.json({ status: true, data: questions });

  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// UPDATE QUESTION
// ===============================
const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid Question ID" });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ status: false, message: "Question not found" });
    }
    
    const { 
        m_ques_title_en,
        m_ques_op1_en,
        m_ques_op2_en,
        m_ques_op3_en,
        m_ques_op4_en,
        m_ques_ans,
        m_ques_solutions 
    } = req.body;

    // Update fields if they are provided in the request body
    if (m_ques_title_en) question.m_ques_title_en = m_ques_title_en;
    if (m_ques_op1_en !== undefined) question.m_ques_op1_en = m_ques_op1_en;
    if (m_ques_op2_en !== undefined) question.m_ques_op2_en = m_ques_op2_en;
    if (m_ques_op3_en !== undefined) question.m_ques_op3_en = m_ques_op3_en;
    if (m_ques_op4_en !== undefined) question.m_ques_op4_en = m_ques_op4_en;
    if (m_ques_solutions !== undefined) question.m_ques_solutions = m_ques_solutions;

    if (m_ques_ans) {
        if (!["A", "B", "C", "D"].includes(m_ques_ans.toUpperCase())) {
            return res.status(400).json({ status: false, message: "Answer must be A, B, C, or D" });
        }
        question.m_ques_ans = m_ques_ans.toUpperCase();
    }

    const updated = await question.save();
    res.json({ status: true, message: "Question updated successfully", data: updated });

  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// DELETE QUESTION
// ===============================
const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid Question ID" });
    }
    
    const deleted = await Question.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ status: false, message: "Question not found" });
    }
    
    res.json({ status: true, message: "Question deleted successfully" });

  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = {
  addQuestion,
  getQuestionsByQuiz,
  updateQuestion,
  deleteQuestion,
  bulkAddQuestions,
};