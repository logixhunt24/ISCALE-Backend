const mongoose = require("mongoose");

const Quiz = require("../models/quizs");
const QuizResult = require("../models/quiz_result");
const QuizAttempt = require("../models/quiz_attempt");
const Candidate = require("../models/candidates");
const { buildResultDetails } = require("./quizAttemptController");

const validId = (v) => mongoose.Types.ObjectId.isValid(v);

const studentName = (c) =>
  [c?.c_first_name, c?.c_last_name].filter(Boolean).join(" ") || c?.c_display_name || "";

// "HH:MM:SS" -> seconds, for tie-breaking on time taken
const hmsToSeconds = (t) => {
  if (!t) return Number.MAX_SAFE_INTEGER;
  const [h = 0, m = 0, s = 0] = String(t).split(":").map((x) => parseInt(x, 10) || 0);
  return h * 3600 + m * 60 + s;
};

// GET /quiz-results/list?quiz_id=&package_id=&search=&page=&limit=
// With quiz_id the rows are ranked (higher marks first, faster time breaks ties).
const listResults = async (req, res) => {
  try {
    const { quiz_id, package_id, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const filter = {};
    if (quiz_id) {
      if (!validId(quiz_id)) return res.status(400).json({ status: false, message: "Invalid quiz id" });
      filter.quiz_id = String(quiz_id);
    } else if (package_id) {
      filter.package_id = String(package_id);
    } else {
      return res.status(400).json({ status: false, message: "Select a package or a test" });
    }

    let results = await QuizResult.find(filter).lean();

    const userIds = [...new Set(results.map((r) => r.user_id).filter(validId))];
    const [candidates, quizzes] = await Promise.all([
      Candidate.find({ _id: { $in: userIds } })
        .select("c_first_name c_last_name c_display_name c_email c_contact")
        .lean(),
      Quiz.find({ _id: { $in: [...new Set(results.map((r) => r.quiz_id).filter(validId))] } })
        .select("m_quiz_title")
        .lean(),
    ]);
    const candMap = new Map(candidates.map((c) => [String(c._id), c]));
    const quizMap = new Map(quizzes.map((q) => [String(q._id), q.m_quiz_title]));

    results.sort(
      (a, b) =>
        b.marks_obtained - a.marks_obtained ||
        hmsToSeconds(a.time_taken) - hmsToSeconds(b.time_taken) ||
        new Date(a.createdAt) - new Date(b.createdAt),
    );

    let rows = results.map((r, i) => {
      const c = candMap.get(r.user_id);
      return {
        _id: r._id,
        rank: quiz_id ? i + 1 : null,
        quiz_id: r.quiz_id,
        quiz_title: quizMap.get(r.quiz_id) || "Test",
        user_id: r.user_id,
        name: studentName(c),
        email: c?.c_email || "",
        contact: c?.c_contact || "",
        total_questions: r.total_questions,
        attempted: r.attempted,
        correct: r.correct,
        wrong: r.wrong,
        skipped: r.skipped,
        marks_obtained: r.marks_obtained,
        total_marks: r.total_marks,
        percentage: r.percentage,
        time_taken: r.time_taken,
        submitted_at: r.createdAt,
      };
    });

    if (search) {
      const k = String(search).toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(k) ||
          r.email.toLowerCase().includes(k) ||
          String(r.contact).includes(k) ||
          r.quiz_title.toLowerCase().includes(k),
      );
    }

    const total = rows.length;
    const all = String(req.query.all) === "1"; // used by CSV export
    const data = all ? rows : rows.slice((page - 1) * limit, page * limit);

    return res.json({
      status: true,
      total,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      data,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// GET /quiz-results/details/:result_id — full answer review of any student's result
const getResultForAdmin = async (req, res) => {
  try {
    if (!validId(req.params.result_id)) {
      return res.status(400).json({ status: false, message: "Invalid result id" });
    }
    const result = await QuizResult.findById(req.params.result_id).lean();
    if (!result) return res.status(404).json({ status: false, message: "Result not found" });

    const [details, cand] = await Promise.all([
      buildResultDetails(result),
      validId(result.user_id)
        ? Candidate.findById(result.user_id).select("c_first_name c_last_name c_display_name c_email c_contact").lean()
        : null,
    ]);

    return res.json({
      status: true,
      data: { ...details, student: { name: studentName(cand), email: cand?.c_email || "", contact: cand?.c_contact || "" } },
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// DELETE /quiz-results/reset/:result_id — removes the result and the sitting so the student can retake
const resetAttempt = async (req, res) => {
  try {
    if (!validId(req.params.result_id)) {
      return res.status(400).json({ status: false, message: "Invalid result id" });
    }
    const result = await QuizResult.findById(req.params.result_id);
    if (!result) return res.status(404).json({ status: false, message: "Result not found" });

    await Promise.all([
      QuizResult.deleteMany({ user_id: result.user_id, quiz_id: result.quiz_id }),
      QuizAttempt.deleteMany({ user_id: result.user_id, quiz_id: result.quiz_id }),
    ]);

    return res.json({ status: true, message: "Attempt reset. The student can take this test again." });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

module.exports = { listResults, getResultForAdmin, resetAttempt };
