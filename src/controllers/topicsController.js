const Lecture = require("../models/lecture");
const Subject = require("../models/subject");
const fs = require("fs");

// ===============================
// ADD TOPIC
// ===============================
const addTopic = async (req, res) => {
  try {
    const {
      ml_subject,
      ml_title,
      ml_code,
      ml_type,
      ml_status,
      ml_stype,
      ml_yt_type,
      ml_video_id,
      ml_vdocipher_id,
    } = req.body;

    if (!ml_subject || !ml_title) {
      return res.status(400).json({
        status: false,
        message: "Subject and title are required",
      });
    }

    // Video ID is only mandatory for actual Video-type topics.
    // PDF/Link topics send ml_yt_type too (frontend default), but shouldn't be blocked by it.
    const isVideoTopic = ml_type == "1" || ml_type == "Video";

    if (isVideoTopic) {
      // YouTube validation
      if (ml_yt_type == "1" && !ml_video_id) {
        return res.status(400).json({
          status: false,
          message: "YouTube Video ID is required",
        });
      }

      // VdoCipher validation
      if (ml_yt_type == "2" && !ml_vdocipher_id) {
        return res.status(400).json({
          status: false,
          message: "VdoCipher Video ID is required",
        });
      }
    }

    const subject = await Subject.findById(ml_subject);
    if (!subject) {
      return res.status(404).json({
        status: false,
        message: "Subject not found",
      });
    }

    let videoFile = null;
    let pdfFile = null;

    if (req.files?.["ml_file"]) {
      videoFile = req.files["ml_file"][0].path;
    }

    if (req.files?.["ml_pdffile"]) {
      pdfFile = req.files["ml_pdffile"][0].path;
    }

    let youtubeVideoId = "";
    let vdocipherVideoId = "";

    if (ml_yt_type == "1") {
      youtubeVideoId = ml_video_id;
    } else if (ml_yt_type == "2") {
      vdocipherVideoId = ml_vdocipher_id;
    }

    const newTopic = new Lecture({
      ml_course: subject.m_subject_course,
      ml_subject,
      ml_title,
      ml_code,
      ml_type,
      ml_stype,
      ml_yt_type,
      ml_video_id: youtubeVideoId,
      ml_vdocipher_id: vdocipherVideoId,
      ml_file: videoFile,
      ml_pdffile: pdfFile,
      ml_status: ml_status ? Number(ml_status) : 1,
      ml_added_on: new Date(),
    });

    const saved = await newTopic.save();

    res.status(201).json({
      status: true,
      message: "Topic added successfully",
      data: saved,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// get public topics (for users, only active topics with id and title)
const getPublicTopics = async (req, res) => {
  try {
    const { subject_id } = req.params;

    const topics = await Lecture.find({
      ml_subject: subject_id,
      ml_status: 1,
    })
      .select("_id ml_title") //  only safe fields
      .sort({ ml_seq: 1, _id: 1 });

    res.json({
      status: true,
      data: topics,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

const getPrivateTopics = async (req, res) => {
  try {
    const { subject_id } = req.params;

    const topics = await Lecture.find({
      ml_subject: subject_id,
      ml_status: 1,
    }).sort({ ml_seq: 1, _id: 1 });

    res.json({
      status: true,
      data: topics,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

// ===============================
// GET TOPICS BY SUBJECT
// ===============================
const getTopicsBySubject = async (req, res) => {
  try {
    const { subject_id } = req.params;

    const data = await Lecture.find({
      ml_subject: subject_id,
    }).sort({ ml_seq: 1, _id: 1 });

    res.json({
      status: true,
      data,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// UPDATE TOPIC
// ===============================
const updateTopic = async (req, res) => {
  try {
    const { id } = req.params;

    const topic = await Lecture.findById(id);
    if (!topic) {
      return res.status(404).json({
        status: false,
        message: "Topic not found",
      });
    }

    const {
      ml_title,
      ml_code,
      ml_type,
      ml_status,
      ml_stype,
      ml_yt_type,
      ml_video_id,
      ml_vdocipher_id,
      ml_seq,
    } = req.body;

    // Effective type after this update (falls back to the topic's existing type
    // when ml_type isn't part of this particular save, e.g. a PDF-only update).
    const effectiveType = ml_type !== undefined ? ml_type : topic.ml_type;
    const isVideoTopic = effectiveType == "1" || effectiveType == "Video";

    if (isVideoTopic && ml_yt_type !== undefined) {
      if (ml_yt_type == "1" && !ml_video_id) {
        return res.status(400).json({
          status: false,
          message: "YouTube Video ID is required",
        });
      }

      if (ml_yt_type == "2" && !ml_vdocipher_id) {
        return res.status(400).json({
          status: false,
          message: "VdoCipher Video ID is required",
        });
      }
    }

    // UPDATE FIELDS
    if (ml_title !== undefined) topic.ml_title = ml_title;
    if (ml_code !== undefined) topic.ml_code = ml_code;
    if (ml_type !== undefined) topic.ml_type = ml_type;
    if (ml_stype !== undefined) topic.ml_stype = ml_stype;
    // if (ml_video_id) topic.ml_video_id = ml_video_id;
    if (isVideoTopic && ml_yt_type !== undefined) {
      topic.ml_yt_type = ml_yt_type;

      if (ml_yt_type == "1") {
        topic.ml_video_id = ml_video_id;
        topic.ml_vdocipher_id = "";
      } else if (ml_yt_type == "2") {
        topic.ml_vdocipher_id = ml_vdocipher_id;
        topic.ml_video_id = "";
      }
    }
    if (ml_status !== undefined) topic.ml_status = Number(ml_status);
    if (ml_seq !== undefined && ml_seq !== "" && !isNaN(Number(ml_seq))) topic.ml_seq = Number(ml_seq);
    if (!topic.ml_course) {
      const subject = await Subject.findById(topic.ml_subject);
      if (subject?.m_subject_course) {
        topic.ml_course = subject.m_subject_course;
      }
    }

    // ===============================
    // FILE UPDATE
    // ===============================

    // VIDEO FILE
    if (req.files?.["ml_file"]) {
      if (topic.ml_file && fs.existsSync(topic.ml_file)) {
        fs.unlinkSync(topic.ml_file);
      }
      topic.ml_file = req.files["ml_file"][0].path;
    }

    // PDF FILE
    if (req.files?.["ml_pdffile"]) {
      if (topic.ml_pdffile && fs.existsSync(topic.ml_pdffile)) {
        fs.unlinkSync(topic.ml_pdffile);
      }
      topic.ml_pdffile = req.files["ml_pdffile"][0].path;
    }

    topic.ml_modified_on = new Date();

    const updated = await topic.save();

    res.json({
      status: true,
      message: "Topic updated successfully",
      data: updated,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// ===============================
// DELETE TOPIC
// ===============================
const deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;

    const topic = await Lecture.findById(id);
    if (!topic) {
      return res.status(404).json({
        status: false,
        message: "Topic not found",
      });
    }

    if (topic.ml_file && fs.existsSync(topic.ml_file)) {
      fs.unlinkSync(topic.ml_file);
    }

    if (topic.ml_pdffile && fs.existsSync(topic.ml_pdffile)) {
      fs.unlinkSync(topic.ml_pdffile);
    }

    await Lecture.findByIdAndDelete(id);

    res.json({
      status: true,
      message: "Topic deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = {
  addTopic,
  getTopicsBySubject,
  updateTopic,
  deleteTopic,
  getPublicTopics,
  getPrivateTopics,
};
