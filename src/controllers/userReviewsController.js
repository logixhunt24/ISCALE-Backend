const UserReview = require("../models/user_reviews");
const mongoose = require("mongoose");
const fs = require("fs");

// ==========================================
// ADD USER REVIEW
// ==========================================

const addUserReview = async (req, res) => {
  let uploadedImage = null;

  try {
    const {
      user_name,
      user_designation,
      user_review,
      rating,
    } = req.body;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!user_name || user_name.trim() === "") {
      if (req.files?.user_image) {
        uploadedImage = req.files.user_image[0].path;

        if (fs.existsSync(uploadedImage)) {
          fs.unlinkSync(uploadedImage);
        }
      }

      return res.status(400).send({
        status: false,
        message: "User name is required",
      });
    }

    // ==========================================
    // IMAGE
    // ==========================================

    let image = null;

    if (req.files?.user_image) {
      image = req.files.user_image[0].path;
      uploadedImage = image;
    }

    // ==========================================
    // CREATE
    // ==========================================

    const parsedRating = Number(rating);
    const data = new UserReview({
      user_name: user_name || null,
      user_designation: user_designation || null,
      user_review: user_review || null,
      rating: parsedRating >= 1 && parsedRating <= 5 ? parsedRating : 5,
      user_image: image,
    });

    const savedData = await data.save();

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(201).send({
      status: true,
      message: "User review added successfully",
      data: savedData,
    });
  } catch (error) {
    // ==========================================
    // DELETE IMAGE IF ERROR
    // ==========================================

    if (uploadedImage && fs.existsSync(uploadedImage)) {
      fs.unlinkSync(uploadedImage);
    }

    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET ALL USER REVIEWS
// ==========================================

const getAllUserReviews = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 50,
      keyword = "",
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = {};

    // ==========================================
    // SEARCH
    // ==========================================

    if (keyword && keyword.trim() !== "") {
      filter.$or = [
        {
          user_name: {
            $regex: keyword,
            $options: "i",
          },
        },

        {
          user_designation: {
            $regex: keyword,
            $options: "i",
          },
        },

        {
          user_review: {
            $regex: keyword,
            $options: "i",
          },
        },
      ];
    }

    // ==========================================
    // TOTAL RECORDS
    // ==========================================

    const totalRecords =
      await UserReview.countDocuments(filter);

    // ==========================================
    // GET DATA
    // ==========================================

    const data = await UserReview.find(filter)

      .sort({ createdAt: -1 })

      .skip((page - 1) * limit)

      .limit(limit);

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).send({
      status: true,

      pagination: {
        currentPage: page,
        perPage: limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },

      data,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// ==========================================
// GET SINGLE USER REVIEW
// ==========================================

const getSingleUserReview = async (req, res) => {
  try {
    const { id } = req.params;

    // ==========================================
    // VALIDATE ID
    // ==========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid review id",
      });
    }

    // ==========================================
    // FIND REVIEW
    // ==========================================

    const data = await UserReview.findById(id);

    if (!data) {
      return res.status(404).send({
        status: false,
        message: "Review not found",
      });
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).send({
      status: true,
      data,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// ==========================================
// CHANGE STATUS
// ==========================================

const changeUserReviewStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // ==========================================
    // VALIDATE ID
    // ==========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid review id",
      });
    }

    // ==========================================
    // FIND REVIEW
    // ==========================================

    const review = await UserReview.findById(id);

    if (!review) {
      return res.status(404).send({
        status: false,
        message: "Review not found",
      });
    }

    // ==========================================
    // TOGGLE STATUS
    // ==========================================

    review.status =
      review.status === "active"
        ? "inactive"
        : "active";

    await review.save();

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).send({
      status: true,
      message: "Status changed successfully",
      data: review,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// ==========================================
// UPDATE USER REVIEW
// ==========================================

const updateUserReview = async (req, res) => {
  let newImage = null;

  try {
    const { id } = req.params;

    // ==========================================
    // VALIDATE ID
    // ==========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      if (req.files?.user_image) {
        newImage = req.files.user_image[0].path;

        if (fs.existsSync(newImage)) {
          fs.unlinkSync(newImage);
        }
      }

      return res.status(400).send({
        status: false,
        message: "Invalid review id",
      });
    }

    // ==========================================
    // FIND REVIEW
    // ==========================================

    const review = await UserReview.findById(id);

    if (!review) {
      if (req.files?.user_image) {
        newImage = req.files.user_image[0].path;

        if (fs.existsSync(newImage)) {
          fs.unlinkSync(newImage);
        }
      }

      return res.status(404).send({
        status: false,
        message: "Review not found",
      });
    }

    const oldImage = review.user_image;

    // ==========================================
    // BODY DATA
    // ==========================================

    const {
      user_name,
      user_designation,
      user_review,
      rating,
      status,
    } = req.body;

    // ==========================================
    // UPDATE FIELDS
    // ==========================================

    if (user_name !== undefined && user_name !== "") {
      review.user_name = user_name;
    }

    if (
      user_designation !== undefined &&
      user_designation !== ""
    ) {
      review.user_designation = user_designation;
    }

    if (
      user_review !== undefined &&
      user_review !== ""
    ) {
      review.user_review = user_review;
    }

    if (status !== undefined && status !== "") {
      review.status = status;
    }

    if (rating !== undefined && rating !== "") {
      const parsedRating = Number(rating);
      if (parsedRating >= 1 && parsedRating <= 5) {
        review.rating = parsedRating;
      }
    }

    // ==========================================
    // IMAGE UPDATE
    // ==========================================

    if (req.files?.user_image) {
      newImage = req.files.user_image[0].path;

      review.user_image = newImage;
    }

    // ==========================================
    // SAVE
    // ==========================================

    const updatedData = await review.save();

    // ==========================================
    // DELETE OLD IMAGE
    // ==========================================

    if (
      newImage &&
      oldImage &&
      fs.existsSync(oldImage)
    ) {
      fs.unlinkSync(oldImage);
    }

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).send({
      status: true,
      message: "User review updated successfully",
      data: updatedData,
    });
  } catch (error) {
    // ==========================================
    // DELETE NEW IMAGE IF ERROR
    // ==========================================

    if (newImage && fs.existsSync(newImage)) {
      fs.unlinkSync(newImage);
    }

    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// ==========================================
// DELETE USER REVIEW
// ==========================================

const deleteUserReview = async (req, res) => {
  try {
    const { id } = req.params;

    // ==========================================
    // VALIDATE ID
    // ==========================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid review id",
      });
    }

    // ==========================================
    // FIND REVIEW
    // ==========================================

    const review = await UserReview.findById(id);

    if (!review) {
      return res.status(404).send({
        status: false,
        message: "Review not found",
      });
    }

    // ==========================================
    // DELETE IMAGE
    // ==========================================

    if (
      review.user_image &&
      fs.existsSync(review.user_image)
    ) {
      fs.unlinkSync(review.user_image);
    }

    // ==========================================
    // DELETE DOCUMENT
    // ==========================================

    await UserReview.findByIdAndDelete(id);

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).send({
      status: true,
      message: "User review deleted successfully",
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

module.exports = {
  addUserReview,
  getAllUserReviews,
  getSingleUserReview,
  changeUserReviewStatus,
  updateUserReview,
  deleteUserReview,
};