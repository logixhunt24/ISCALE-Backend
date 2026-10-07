

const News = require("../models/news&update");
const fs = require("fs");

//COMMON FILE DELETE
const deleteUploadedFiles = (files) => {
  if (!files) return;

  Object.values(files).forEach((fileArray) => {
    fileArray.forEach((file) => {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
  });
};

const addNews = async (req, res) => {
  try {
    const { m_news_title } = req.body;

    if (!m_news_title) {
      return res.status(400).json({
        status: false,
        message: "Title is required",
      });
    }

    const slug = m_news_title.toLowerCase().replace(/\s+/g, "-");

    const image = req.files?.m_news_image?.[0]?.path || null;

    const news = await News.create({
      m_news_title,
      m_news_slug: slug,
      m_news_intro: req.body.m_news_intro,
      m_news_description: req.body.m_news_description,
      m_news_image: image,
    });

    res.json({
      status: true,
      data: news,
      msg: "News&Updates added successfully",
    });
  } catch (err) {
    deleteUploadedFiles(req.files); // 🔥 important
    res.status(500).json({ status: false, message: err.message });
  }
};

const updateNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);

    if (!news) {
      return res.status(404).json({
        status: false,
        message: "News not found",
      });
    }

    Object.keys(req.body).forEach((key) => {
      news[key] = req.body[key];
    });

    //  IMAGE UPDATE
    if (req.files?.m_news_image) {
      // old delete
      if (news.m_news_image && fs.existsSync(news.m_news_image)) {
        fs.unlinkSync(news.m_news_image);
      }

      news.m_news_image = req.files.m_news_image[0].path;
    }

    await news.save();

    res.json({
      status: true,
      data: news,
    });
  } catch (err) {
    deleteUploadedFiles(req.files);
    res.status(500).json({ status: false, message: err.message });
  }
};

const getAllNews = async (req, res) => {
  try {
    // Same admin-vs-public split as the other shared controllers: req.user is
    // only set by authMiddleware, so the public mount only sees active posts.
    const filter = req.user ? {} : { m_news_status: 1 };
    const data = await News.find(filter)
      .select(
        "m_news_title m_news_intro m_news_image m_news_description m_news_added_on m_news_status m_news_order",
      )
      .sort({ _id: -1 });

    res.json({
      status: true,
      data,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const getSingleNews = async (req, res) => {
  try {
    const data = await News.findById(req.params.id);

    if (!data) {
      return res.status(404).json({
        status: false,
        message: "News not found",
      });
    }

    res.json({
      status: true,
      data,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const deleteNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);

    if (!news) {
      return res.status(404).json({
        status: false,
        message: "Not found",
      });
    }

    // ✅ SINGLE IMAGE DELETE
    if (news.m_news_image && fs.existsSync(news.m_news_image)) {
      fs.unlinkSync(news.m_news_image);
    }

    await News.findByIdAndDelete(req.params.id);

    res.json({
      status: true,
      message: "Deleted",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const changeNewsStatus = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);

    if (!news) {
      return res.status(404).json({
        status: false,
        message: "News not found",
      });
    }

    // TOGGLE STATUS
    news.m_news_status =
      news.m_news_status === 1 ? 0 : 1;

    await news.save();

    res.json({
      status: true,
      message: "Status updated successfully",
      data: {
        _id: news._id,
        m_news_status: news.m_news_status,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

module.exports = {
  addNews,
  updateNews,
  getAllNews,
  getSingleNews,
  deleteNews,
  changeNewsStatus
};
