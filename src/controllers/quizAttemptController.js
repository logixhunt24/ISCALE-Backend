const mongoose = require("mongoose");

const Quiz = require("../models/quizs");
const Question = require("../models/questions");
const QuizInstruction = require("../models/quiz_instructions");
const QuizResult = require("../models/quiz_result");
const QuizAttempt = require("../models/quiz_attempt");
const TestPackage = require("../models/test_package");
const TestPackageEnrollment = require("../models/test_package_enrollment");

// Quiz start/end times are entered in the academy's local time.
const QUIZ_TZ_OFFSET = process.env.QUIZ_TZ_OFFSET || "+05:30";
// Extra seconds accepted after the timer ends (network lag / slow clients).
const SUBMIT_GRACE_SECONDS = 300;

const OPTION_KEYS = ["A", "B", "C", "D"];

// ---------------------------------------------------------------- helpers

const toObjectId = (v) => (mongoose.Types.ObjectId.isValid(v) ? String(v) : null);

// "HH:MM[:SS]" -> seconds; a bare number is treated as minutes
const durationToSeconds = (d) => {
  if (d === undefined || d === null || d === "") return 0;
  const s = String(d).trim();
  if (s.includes(":")) {
    const [h = 0, m = 0, sec = 0] = s.split(":").map((x) => parseInt(x, 10) || 0);
    return h * 3600 + m * 60 + sec;
  }
  return (parseInt(s, 10) || 0) * 60;
};

const secondsToHms = (total) => {
  const t = Math.max(0, Math.round(total));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
};

const buildDateTime = (date, time, fallbackTime) => {
  if (!date) return null;
  const day = new Date(date).toISOString().slice(0, 10);
  let t = (time || fallbackTime || "00:00").trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) t += ":00";
  if (!/^\d{1,2}:\d{2}:\d{2}$/.test(t)) t = fallbackTime || "00:00:00";
  const [h, m, s] = t.split(":");
  const d = new Date(`${day}T${h.padStart(2, "0")}:${m}:${s}${QUIZ_TZ_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// upcoming | open | closed
const quizWindow = (quiz, now = new Date()) => {
  const start = buildDateTime(quiz.m_quiz_startdate, quiz.m_quiz_startTime, "00:00:00");
  const end = buildDateTime(quiz.m_quiz_enddate, quiz.m_quiz_endTime, "23:59:59");
  let state = "open";
  if (start && now < start) state = "upcoming";
  else if (end && now > end) state = "closed";
  return { state, start, end };
};

const hasPackageAccess = async (userId, packageId) => {
  if (!toObjectId(packageId)) return false;
  const now = new Date();
  const enrollment = await TestPackageEnrollment.exists({
    user_id: userId,
    test_package_id: packageId,
    payment_status: 1,
    access_status: 1,
    $or: [{ expiry_date: null }, { expiry_date: { $gt: now } }],
  });
  return !!enrollment;
};

// Loads an active quiz and checks the caller bought its package.
// Sends the error response itself and returns null on failure.
const loadAccessibleQuiz = async (req, res) => {
  const quizId = toObjectId(req.params.quiz_id);
  if (!quizId) {
    res.status(400).json({ status: false, message: "Invalid quiz id" });
    return null;
  }
  const quiz = await Quiz.findOne({ _id: quizId, m_quiz_status: 1 }).lean();
  if (!quiz) {
    res.status(404).json({ status: false, message: "Test not found" });
    return null;
  }
  if (!(await hasPackageAccess(req.user.id, quiz.m_quiz_package))) {
    res.status(403).json({
      status: false,
      message: "Please enroll in this test package to attempt the test.",
    });
    return null;
  }
  return quiz;
};

const publicQuestion = (q) => ({
  _id: q._id,
  title: q.m_ques_title_en,
  is_img: q.m_ques_is_img === 1,
  options: OPTION_KEYS.map((key, i) => ({
    key,
    text: q[`m_ques_op${i + 1}_en`] || "",
    is_img: String(q[`m_ques_op${i + 1}_is_img`]) === "1",
  })).filter((o) => o.text),
});

const resultSummary = (r) => ({
  _id: r._id,
  quiz_id: r.quiz_id,
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
});

// Scores answers server-side. `answers` is { [questionId]: "A"|"B"|"C"|"D" }.
const scoreAttempt = async (quiz, answers) => {
  const questions = await Question.find({ m_ques_quiz: quiz._id })
    .select("m_ques_ans")
    .sort({ _id: 1 })
    .lean();

  const perMarks = Number(quiz.m_quiz_per_marks) || 1;
  const negMarks = Number(quiz.m_quiz_pernegative_marks) || 0;

  let attempted = 0;
  let correct = 0;
  let wrong = 0;
  const saved = [];

  for (const q of questions) {
    const given = String(answers?.[q._id] || "").toUpperCase();
    // questions saved without a correct answer can't be marked either way
    const valid = OPTION_KEYS.includes(given) && !!q.m_ques_ans;
    let isCorrect = false;
    if (valid) {
      attempted++;
      if (given === q.m_ques_ans) {
        correct++;
        isCorrect = true;
      } else {
        wrong++;
      }
    }
    saved.push({
      question_id: String(q._id),
      given_answer: valid ? given : "",
      is_correct: isCorrect,
    });
  }

  const total = questions.length;
  const marks = correct * perMarks - wrong * negMarks;
  const totalMarks = total * perMarks;

  return {
    total_questions: total,
    attempted,
    correct,
    wrong,
    skipped: total - attempted,
    marks_obtained: marks,
    total_marks: totalMarks,
    percentage: totalMarks > 0 ? Math.max(0, Math.round((marks / totalMarks) * 100)) : 0,
    answers: saved,
  };
};

// Creates the (single) result for an attempt. Safe to call twice.
const finalizeAttempt = async (attempt, quiz, answers) => {
  const existing = await QuizResult.findOne({
    user_id: attempt.user_id,
    quiz_id: String(quiz._id),
  });
  if (existing) return existing;

  const scored = await scoreAttempt(quiz, answers);
  const elapsed = Math.min(
    (Date.now() - attempt.started_at.getTime()) / 1000,
    (attempt.expires_at.getTime() - attempt.started_at.getTime()) / 1000,
  );

  const result = await QuizResult.create({
    user_id: attempt.user_id,
    quiz_id: String(quiz._id),
    package_id: quiz.m_quiz_package || null,
    course_id: quiz.m_quiz_course_id || null,
    ...scored,
    time_taken: secondsToHms(elapsed),
  });

  await QuizAttempt.updateOne(
    { _id: attempt._id },
    { submitted: true, result_id: String(result._id) },
  );
  return result;
};

// ---------------------------------------------------------------- handlers

// GET /test-quiz/:quiz_id/info
const getQuizInfo = async (req, res) => {
  try {
    const quiz = await loadAccessibleQuiz(req, res);
    if (!quiz) return;

    const [questionCount, instructions, result, attempt, pkg] = await Promise.all([
      Question.countDocuments({ m_ques_quiz: quiz._id }),
      QuizInstruction.find({ m_instruction_quiz: quiz._id }).sort({ m_instruction_id: 1 }).lean(),
      QuizResult.findOne({ user_id: req.user.id, quiz_id: String(quiz._id) }).sort({ createdAt: -1 }).lean(),
      QuizAttempt.findOne({ user_id: req.user.id, quiz_id: String(quiz._id) }).lean(),
      toObjectId(quiz.m_quiz_package)
        ? TestPackage.findById(quiz.m_quiz_package).select("m_package_title").lean()
        : null,
    ]);

    const win = quizWindow(quiz);
    const inProgress = !!attempt && !attempt.submitted && !result && attempt.expires_at.getTime() + SUBMIT_GRACE_SECONDS * 1000 > Date.now();

    return res.json({
      status: true,
      data: {
        _id: quiz._id,
        title: quiz.m_quiz_title,
        description: quiz.m_quiz_description || quiz.m_quiz_shortDesc || "",
        package_id: quiz.m_quiz_package,
        package_title: pkg?.m_package_title || "",
        total_questions: questionCount,
        duration_seconds: durationToSeconds(quiz.m_quiz_duration),
        per_marks: Number(quiz.m_quiz_per_marks) || 1,
        negative_marks: Number(quiz.m_quiz_pernegative_marks) || 0,
        window: { state: win.state, start: win.start, end: win.end },
        instructions: instructions.map((i) => ({ key: i.m_instruction_key, value: i.m_instruction_value || "" })),
        attempted: !!result,
        in_progress: inProgress,
        result: result ? resultSummary(result) : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// POST /test-quiz/:quiz_id/start  — begins or resumes the sitting
const startQuiz = async (req, res) => {
  try {
    const quiz = await loadAccessibleQuiz(req, res);
    if (!quiz) return;

    const userId = req.user.id;
    const quizId = String(quiz._id);

    const done = await QuizResult.findOne({ user_id: userId, quiz_id: quizId }).lean();
    if (done) {
      return res.status(409).json({
        status: false,
        message: "You have already attempted this test.",
        result_id: done._id,
      });
    }

    const win = quizWindow(quiz);
    const durationSec = durationToSeconds(quiz.m_quiz_duration);
    if (durationSec <= 0) {
      return res.status(400).json({ status: false, message: "This test has no duration configured." });
    }

    let attempt = await QuizAttempt.findOne({ user_id: userId, quiz_id: quizId });

    if (attempt) {
      // Sitting that ran out without a submission: close it out as it stands.
      if (Date.now() > attempt.expires_at.getTime() + SUBMIT_GRACE_SECONDS * 1000) {
        const result = await finalizeAttempt(attempt, quiz, {});
        return res.status(409).json({
          status: false,
          message: "Your time for this test has ended.",
          result_id: result._id,
        });
      }
    } else {
      if (win.state === "upcoming") {
        return res.status(403).json({ status: false, message: "This test has not started yet." });
      }
      if (win.state === "closed") {
        return res.status(403).json({ status: false, message: "This test is no longer available." });
      }
      const started = new Date();
      attempt = await QuizAttempt.findOneAndUpdate(
        { user_id: userId, quiz_id: quizId },
        {
          $setOnInsert: {
            user_id: userId,
            quiz_id: quizId,
            started_at: started,
            expires_at: new Date(started.getTime() + durationSec * 1000),
          },
        },
        { upsert: true, new: true },
      );
    }

    const questions = await Question.find({ m_ques_quiz: quiz._id })
      .select("-m_ques_ans -m_ques_solutions")
      .sort({ _id: 1 })
      .lean();

    if (!questions.length) {
      return res.status(400).json({ status: false, message: "This test has no questions yet." });
    }

    return res.json({
      status: true,
      data: {
        attempt_id: attempt._id,
        quiz: {
          _id: quiz._id,
          title: quiz.m_quiz_title,
          per_marks: Number(quiz.m_quiz_per_marks) || 1,
          negative_marks: Number(quiz.m_quiz_pernegative_marks) || 0,
        },
        started_at: attempt.started_at,
        expires_at: attempt.expires_at,
        server_time: new Date(),
        questions: questions.map(publicQuestion),
      },
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// POST /test-quiz/:quiz_id/submit   body: { answers: { [questionId]: "A" } }
const submitQuiz = async (req, res) => {
  try {
    const quiz = await loadAccessibleQuiz(req, res);
    if (!quiz) return;

    const userId = req.user.id;
    const quizId = String(quiz._id);

    const existing = await QuizResult.findOne({ user_id: userId, quiz_id: quizId }).lean();
    if (existing) {
      return res.status(200).json({
        status: true,
        message: "Already submitted",
        result_id: existing._id,
      });
    }

    const attempt = await QuizAttempt.findOne({ user_id: userId, quiz_id: quizId });
    if (!attempt) {
      return res.status(400).json({ status: false, message: "You have not started this test." });
    }

    const late = Date.now() > attempt.expires_at.getTime() + SUBMIT_GRACE_SECONDS * 1000;
    const answers = late || typeof req.body?.answers !== "object" || !req.body.answers ? {} : req.body.answers;

    const result = await finalizeAttempt(attempt, quiz, answers);

    return res.status(201).json({
      status: true,
      message: late
        ? "Time was over, so your answers could not be counted."
        : "Your test has been submitted.",
      result_id: result._id,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// GET /test-quiz/results  — the caller's results, newest first
const getMyResults = async (req, res) => {
  try {
    const results = await QuizResult.find({ user_id: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const quizIds = results.map((r) => r.quiz_id).filter(toObjectId);
    const quizzes = await Quiz.find({ _id: { $in: quizIds } }).select("m_quiz_title m_quiz_package").lean();
    const quizMap = new Map(quizzes.map((q) => [String(q._id), q]));

    const data = await Promise.all(
      results.map(async (r) => {
        const better = await QuizResult.countDocuments({
          quiz_id: r.quiz_id,
          marks_obtained: { $gt: r.marks_obtained },
        });
        const participants = await QuizResult.countDocuments({ quiz_id: r.quiz_id });
        return {
          ...resultSummary(r),
          quiz_title: quizMap.get(r.quiz_id)?.m_quiz_title || "Test",
          rank: better + 1,
          participants,
        };
      }),
    );

    return res.json({ status: true, data });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Summary + question-by-question review for a result (shared with the admin view)
const buildResultDetails = async (result) => {
  const [quiz, questions, better, participants] = await Promise.all([
    toObjectId(result.quiz_id) ? Quiz.findById(result.quiz_id).lean() : null,
    toObjectId(result.quiz_id)
      ? Question.find({ m_ques_quiz: result.quiz_id }).sort({ _id: 1 }).lean()
      : [],
    QuizResult.countDocuments({ quiz_id: result.quiz_id, marks_obtained: { $gt: result.marks_obtained } }),
    QuizResult.countDocuments({ quiz_id: result.quiz_id }),
  ]);

  const given = new Map(
    (Array.isArray(result.answers) ? result.answers : []).map((a) => [String(a.question_id), a.given_answer || ""]),
  );

  const review = questions.map((q, i) => {
    const g = given.get(String(q._id)) || "";
    return {
      number: i + 1,
      ...publicQuestion(q),
      given_answer: g,
      correct_answer: q.m_ques_ans || "",
      is_correct: !!g && g === q.m_ques_ans,
      solution: q.m_ques_solutions || "",
    };
  });

  return {
    ...resultSummary(result),
    quiz_title: quiz?.m_quiz_title || "Test",
    per_marks: Number(quiz?.m_quiz_per_marks) || 1,
    negative_marks: Number(quiz?.m_quiz_pernegative_marks) || 0,
    rank: better + 1,
    participants,
    review,
  };
};

// GET /test-quiz/result/:result_id  — the caller's own result
const getResultDetails = async (req, res) => {
  try {
    const resultId = toObjectId(req.params.result_id);
    if (!resultId) {
      return res.status(400).json({ status: false, message: "Invalid result id" });
    }

    const result = await QuizResult.findOne({ _id: resultId, user_id: req.user.id }).lean();
    if (!result) {
      return res.status(404).json({ status: false, message: "Result not found" });
    }

    return res.json({ status: true, data: await buildResultDetails(result) });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

// Used by the "my package" screen to list the tests inside a package.
const listPackageTests = async (userId, packageId) => {
  const quizzes = await Quiz.find({ m_quiz_package: String(packageId), m_quiz_status: 1 })
    .sort({ _id: 1 })
    .lean();
  if (!quizzes.length) return [];

  const ids = quizzes.map((q) => String(q._id));
  const [counts, results, attempts] = await Promise.all([
    Question.aggregate([
      { $match: { m_ques_quiz: { $in: quizzes.map((q) => q._id) } } },
      { $group: { _id: "$m_ques_quiz", n: { $sum: 1 } } },
    ]),
    QuizResult.find({ user_id: userId, quiz_id: { $in: ids } }).select("quiz_id marks_obtained total_marks").lean(),
    QuizAttempt.find({ user_id: userId, quiz_id: { $in: ids }, submitted: false }).select("quiz_id expires_at").lean(),
  ]);

  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  const resultMap = new Map(results.map((r) => [r.quiz_id, r]));
  const attemptMap = new Map(attempts.map((a) => [a.quiz_id, a]));
  const now = new Date();

  return quizzes.map((q) => {
    const id = String(q._id);
    const win = quizWindow(q, now);
    const result = resultMap.get(id);
    const attempt = attemptMap.get(id);
    return {
      _id: q._id,
      title: q.m_quiz_title,
      questions_count: countMap.get(id) || 0,
      time_limit: Math.round(durationToSeconds(q.m_quiz_duration) / 60),
      window_state: win.state,
      starts_at: win.start,
      ends_at: win.end,
      attempted: !!result,
      result_id: result ? result._id : null,
      score: result ? `${result.marks_obtained}/${result.total_marks}` : null,
      in_progress: !result && !!attempt && attempt.expires_at > now,
    };
  });
};

module.exports = {
  getQuizInfo,
  startQuiz,
  submitQuiz,
  getMyResults,
  getResultDetails,
  buildResultDetails,
  listPackageTests,
};
