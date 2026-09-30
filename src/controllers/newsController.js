const News = require("../models/news");
const { toPublicUrl } = require("../utils/imageUrl");

const fs = require("fs");

const deleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const addNews = async (req, res) => {
  try {
    const image = req.files?.m_snews_image?.[0]?.path || null;

    const news = await News.create({
      m_snews_title: req.body.m_snews_title || null,
      m_snews_image: image,
      m_snews_des: req.body.m_snews_des || null,
      m_snews_url: req.body.m_snews_url || null,
      m_snews_added_on: new Date(),
      m_snews_updated_on: new Date(),
    });

    res.json({
      status: true,
      message: "News added successfully",
      data: news,
    });
  } catch (err) {
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

    const fields = ["m_snews_title", "m_snews_des", "m_snews_url"];

    fields.forEach((field) => {
      if (
        req.body[field] !== undefined &&
        req.body[field] !== null &&
        req.body[field].toString().trim() !== ""
      ) {
        news[field] = req.body[field];
      }
    });

    if (
      req.body.m_snews_status &&
      [0,1].includes(req.body.m_snews_status)
    ) {
      news.m_snews_status = req.body.m_snews_status;
    }

    if (req.files?.m_snews_image?.[0]) {
      deleteFile(news.m_snews_image);

      news.m_snews_image = req.files.m_snews_image[0].path;
    }

    news.m_snews_updated_on = new Date();

    await news.save();

    res.json({
      status: true,
      message: "Updated successfully",
      data: news,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
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

    // image delete
    deleteFile(news.m_snews_image);

    await News.findByIdAndDelete(req.params.id);

    res.json({
      status: true,
      message: "Deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const getAllNews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;

    const skip = (page - 1) * limit;

    const data = await News.find().sort({ _id: -1 }).skip(skip).limit(limit);

    const total = await News.countDocuments();

    res.json({
      status: true,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const getSingleNews = async (req, res) => {
  try {
    const { id } = req.params;

    const news = await News.findById(id);

    if (!news) {
      return res.status(404).json({
        status: false,
        message: "News not found",
      });
    }

    res.json({
      status: true,
      data: news,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
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

    news.m_snews_status =
      news.m_snews_status === 1 ? 0 : 1;

    news.m_snews_updated_on = new Date();

    await news.save();

    res.json({
      status: true,
      message: `News ${
        news.m_snews_status === 1 ? "activated" : "deactivated"
      } successfully`,
      data: news,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};


// Mobile Apis=============================================================================================================================




const appGetBlogsForApp = async (req, res) => {
  try {
    const blogs = await News.find({
      m_snews_status: 1,
    }).sort({ _id: -1 });

    return res.status(200).json({
      response: "success",
      blogs: blogs.map((item) => ({
        m_news_id: item._id,
        m_news_intro: item.m_snews_title || "",
        m_news_title: item.m_snews_title || "",
        m_news_slug: item.m_snews_title
          ? item.m_snews_title
              .toLowerCase()
              .replace(/[^\w\s]/gi, "")
              .replace(/\s+/g, "-")
          : "",

        m_news_image: toPublicUrl(item.m_snews_image),

        m_news_image1: null,
        m_news_image2: null,
        m_news_image3: null,
        m_news_image4: null,
        m_news_image5: null,
        m_news_image6: null,
        m_news_image7: null,
        m_news_image8: null,
        m_news_image9: null,

        m_news_description: item.m_snews_des || "",
        m_news_description1: null,
        m_news_description2: null,
        m_news_description3: null,
        m_news_description4: null,
        m_news_description5: null,
        m_news_description6: null,
        m_news_description7: null,
        m_news_description8: null,
        m_news_description9: null,

        m_news_added_on: item.m_snews_added_on,
        m_news_order: "1",
        m_news_status: String(item.m_snews_status),
        m_news_addedby: "0",
      })),
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      response: "error",
      message: error.message,
    });
  }
};


const appGetSingleBlogForApp = async (req, res) => {
  try {
    const { news_id } = req.body;

    if (!news_id) {
      return res.status(400).json({
        response: "error",
        message: "news_id is required",
      });
    }

    const blog = await News.findOne({
      _id: news_id,
      m_snews_status: 1,
    });

    if (!blog) {
      return res.status(404).json({
        response: "error",
        message: "Blog not found",
      });
    }

    return res.status(200).json({
      response: "success",
      blogs: {
        m_news_id: blog._id,

        m_news_intro: blog.m_snews_title || "",
        m_news_title: blog.m_snews_title || "",

        m_news_slug: blog.m_snews_title
          ? blog.m_snews_title
              .toLowerCase()
              .replace(/[^\w\s]/gi, "")
              .replace(/\s+/g, "-")
          : "",

        m_news_image: toPublicUrl(blog.m_snews_image),

        m_news_image1: null,
        m_news_image2: null,
        m_news_image3: null,
        m_news_image4: null,
        m_news_image5: null,
        m_news_image6: null,
        m_news_image7: null,
        m_news_image8: null,
        m_news_image9: null,

        m_news_description: blog.m_snews_des || "",

        m_news_description1: null,
        m_news_description2: null,
        m_news_description3: null,
        m_news_description4: null,
        m_news_description5: null,
        m_news_description6: null,
        m_news_description7: null,
        m_news_description8: null,
        m_news_description9: null,

        m_news_added_on: blog.m_snews_added_on,

        m_news_order: "1",
        m_news_status: String(blog.m_snews_status),
        m_news_addedby: "0",
      },
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      response: "error",
      message: error.message,
    });
  }
};



module.exports = {
  addNews,
  updateNews,
  deleteNews,
  getAllNews,
  getSingleNews,
  changeNewsStatus,

  appGetBlogsForApp,
  appGetSingleBlogForApp
};
