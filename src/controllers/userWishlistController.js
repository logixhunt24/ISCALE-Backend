const UserWishlist = require("../models/user_wishlist");

const Course = require("../models/course");

const TestPackage = require("../models/test_package");

const Notes = require("../models/notes");

const Webinar = require("../models/webinar");
const Event = require("../models/event");
const Batch = require("../models/batch");

const addCourseToWishlist = async (req, res) => {
  try {
    const { course_id } = req.body;

    if (!course_id) {
      return res.status(400).json({
        status: false,

        message: "course_id is required",
      });
    }

    const course = await Course.findById(course_id);

    if (!course) {
      return res.status(404).json({
        status: false,

        message: "Course not found",
      });
    }

    const exists = await UserWishlist.findOne({
      user_id: req.user.id,

      course_id,
    });

    if (exists) {
      return res.status(400).json({
        status: false,

        message: "Course already added in wishlist",
      });
    }

    const wishlist = await UserWishlist.create({
      user_id: req.user.id,

      wishlist_type: 1,

      course_id,
    });

    return res.status(201).json({
      status: true,

      message: "Course added to wishlist",

      data: wishlist,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const getMyCourseWishlist = async (req, res) => {
  try {
    const data = await UserWishlist.find({
      user_id: req.user.id,

      wishlist_type: 1,
    })

      .populate({
        path: "course_id",

        select: `
            m_course_title
            m_course_price
            m_course_offer_price
            m_course_thumbnail
            m_course_duration_app
            m_course_duration_web
            m_course_level
          `,
      })

      .sort({
        added_on: -1,
      });

    return res.status(200).json({
      status: true,

      total: data.length,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const getAllCourseWishlistsAdmin = async (req, res) => {
  try {
    let {
      page = 1,

      limit = 10,

      search = "",

      course_id,

      from_date,

      to_date,
    } = req.query;

    page = parseInt(page) || 1;

    limit = parseInt(limit) || 10;

    const skip = (page - 1) * limit;

    // FILTER

    let filter = {
      wishlist_type: 1,
    };

    // COURSE FILTER
    if (course_id) {
      filter.course_id = course_id;
    }

    // DATE FILTER
    if (from_date || to_date) {
      filter.added_on = {};

      if (from_date) {
        filter.added_on.$gte = new Date(from_date);
      }

      if (to_date) {
        const endDate = new Date(to_date);

        endDate.setHours(23, 59, 59, 999);

        filter.added_on.$lte = endDate;
      }
    }

    // GET DATA

    let data = await UserWishlist.find(filter)

      .populate({
        path: "user_id",

        select: `
            c_first_name
            c_last_name
            c_email
            c_contact
          `,
      })

      .populate({
        path: "course_id",

        select: `
            m_course_title
            m_course_price
            m_course_offer_price
          `,
      })

      .sort({
        added_on: -1,
      })

      .skip(skip)

      .limit(limit)

      .lean();

    // SEARCH

    if (search) {
      const text = search.toLowerCase();

      data = data.filter((item) => {
        const studentName =
          `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`.toLowerCase();

        const email = item.user_id?.c_email?.toLowerCase() || "";

        const mobile = String(item.user_id?.c_contact || "");

        const courseName = item.course_id?.m_course_title?.toLowerCase() || "";

        return (
          studentName.includes(text) ||
          email.includes(text) ||
          mobile.includes(text) ||
          courseName.includes(text)
        );
      });
    }

    // FINAL DATA

    const finalData = data.map((item) => {
      return {
        wishlist_id: item._id,

        student_id: item.user_id?._id,

        student_name: `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`,

        contact_no: item.user_id?.c_contact,

        email: item.user_id?.c_email,

        course_id: item.course_id?._id,

        course_name: item.course_id?.m_course_title,

        added_date: item.added_on,
      };
    });

    // TOTAL

    const totalRecords = await UserWishlist.countDocuments(filter);

    // RESPONSE

    return res.status(200).json({
      status: true,

      current_page: page,

      total_pages: Math.ceil(totalRecords / limit),

      total_records: totalRecords,

      data: finalData,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

// ADMIN - SINGLE WISHLIST

const getSingleCourseWishlist = async (req, res) => {
  try {
    const wishlistId = req.params.id;

    const data = await UserWishlist.findOne({
      _id: wishlistId,
      wishlist_type: 1,
    })

      .populate({
        path: "user_id",

        select: `
            c_first_name
            c_last_name
            c_email
            c_contact
            c_alt_contact
            c_current_city
            c_current_address1
            c_current_address2
          `,
      })

      .populate({
        path: "course_id",
      });

    if (!data) {
      return res.status(404).json({
        status: false,

        message: "Wishlist not found",
      });
    }

    return res.status(200).json({
      status: true,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const deleteCourseWishlist = async (req, res) => {
  try {
    const wishlistId = req.params.id;

    const wishlist = await UserWishlist.find({
      wishlistId,
      wishlist_type: 1,
    });

    if (!wishlist) {
      return res.status(404).json({
        status: false,

        message: "Wishlist not found",
      });
    }

    await UserWishlist.findByIdAndDelete(wishlistId);

    return res.status(200).json({
      status: true,

      message: "Wishlist deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const addTestPackageToWishlist = async (req, res) => {
  try {
    const { package_id } = req.body;

    if (!package_id) {
      return res.status(400).json({
        status: false,

        message: "package_id is required",
      });
    }

    const testPackage = await TestPackage.findById(package_id);

    if (!testPackage) {
      return res.status(404).json({
        status: false,

        message: "Test package not found",
      });
    }

    const exists = await UserWishlist.findOne({
      user_id: req.user.id,

      package_id,

      wishlist_type: 2,
    });

    if (exists) {
      return res.status(400).json({
        status: false,

        message: "Test package already added in wishlist",
      });
    }

    const wishlist = await UserWishlist.create({
      user_id: req.user.id,

      wishlist_type: 2,

      package_id,
    });

    return res.status(201).json({
      status: true,

      message: "Test package added to wishlist",

      data: wishlist,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const getMyTestPackageWishlist = async (req, res) => {
  try {
    const data = await UserWishlist.find({
      user_id: req.user.id,

      wishlist_type: 2,
    })

      .populate({
        path: "package_id",

        populate: [
          {
            path: "m_package_course",

            select: `
                m_course_title
              `,
          },

          {
            path: "m_package_test_category",

            select: `
                test_categoryName
              `,
          },
        ],
      })

      .sort({
        added_on: -1,
      });

    return res.status(200).json({
      status: true,

      total: data.length,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

// ADMIN - GET ALL TEST PACKAGE WISHLISTS

const getAllTestPackageWishlistsAdmin = async (req, res) => {
  try {
    let {
      page = 1,

      limit = 10,

      search = "",

      package_id,

      from_date,

      to_date,
    } = req.query;

    page = parseInt(page) || 1;

    limit = parseInt(limit) || 10;

    const skip = (page - 1) * limit;

    let filter = {
      wishlist_type: 2,
    };

    // PACKAGE FILTER
    if (package_id) {
      filter.package_id = package_id;
    }

    // DATE FILTER
    if (from_date || to_date) {
      filter.added_on = {};

      if (from_date) {
        filter.added_on.$gte = new Date(from_date);
      }

      if (to_date) {
        const endDate = new Date(to_date);

        endDate.setHours(23, 59, 59, 999);

        filter.added_on.$lte = endDate;
      }
    }

    let data = await UserWishlist.find(filter)

      .populate({
        path: "user_id",

        select: `
            c_first_name
            c_last_name
            c_email
            c_contact
          `,
      })

      .populate({
        path: "package_id",

        select: `
            m_package_title
            m_package_price
            m_package_offer_price
          `,
      })

      .sort({
        added_on: -1,
      })

      .skip(skip)

      .limit(limit)

      .lean();

    // SEARCH

    if (search) {
      const text = search.toLowerCase();

      data = data.filter((item) => {
        const studentName =
          `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`.toLowerCase();

        const email = item.user_id?.c_email?.toLowerCase() || "";

        const mobile = String(item.user_id?.c_contact || "");

        const packageName =
          item.package_id?.m_package_title?.toLowerCase() || "";

        return (
          studentName.includes(text) ||
          email.includes(text) ||
          mobile.includes(text) ||
          packageName.includes(text)
        );
      });
    }

    // FINAL DATA

    const finalData = data.map((item) => {
      return {
        wishlist_id: item._id,

        student_id: item.user_id?._id,

        student_name: `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`,

        contact_no: item.user_id?.c_contact,

        email: item.user_id?.c_email,

        package_id: item.package_id?._id,

        package_name: item.package_id?.m_package_title,

        added_date: item.added_on,
      };
    });

    const totalRecords = await UserWishlist.countDocuments(filter);

    return res.status(200).json({
      status: true,

      current_page: page,

      total_pages: Math.ceil(totalRecords / limit),

      total_records: totalRecords,

      data: finalData,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

// ADMIN - SINGLE TEST PACKAGE WISHLIST

const getSingleTestPackageWishlist = async (req, res) => {
  try {
    const wishlistId = req.params.id;

    const data = await UserWishlist.findOne({
      _id: wishlistId,

      wishlist_type: 2,
    })

      .populate({
        path: "user_id",

        select: `
            c_first_name
            c_last_name
            c_email
            c_contact
            c_alt_contact
            c_current_city
            c_current_address1
            c_current_address2
          `,
      })

      .populate({
        path: "package_id",

        populate: [
          {
            path: "m_package_course",
          },

          {
            path: "m_package_test_category",
          },
        ],
      });

    if (!data) {
      return res.status(404).json({
        status: false,

        message: "Wishlist not found",
      });
    }

    return res.status(200).json({
      status: true,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const deleteTestPackageWishlist = async (req, res) => {
  try {
    const wishlistId = req.params.id;

    const wishlist = await UserWishlist.findOne({
      _id: wishlistId,

      wishlist_type: 2,
    });

    if (!wishlist) {
      return res.status(404).json({
        status: false,

        message: "Wishlist not found",
      });
    }

    await UserWishlist.findByIdAndDelete(wishlistId);

    return res.status(200).json({
      status: true,

      message: "Wishlist deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

// ADD NOTES TO WISHLIST

const addNotesToWishlist = async (req, res) => {
  try {
    const { notes_id } = req.body;

    if (!notes_id) {
      return res.status(400).json({
        status: false,

        message: "notes_id is required",
      });
    }

    const notes = await Notes.findById(notes_id);

    if (!notes) {
      return res.status(404).json({
        status: false,

        message: "Notes not found",
      });
    }

    const exists = await UserWishlist.findOne({
      user_id: req.user.id,

      notes_id,

      wishlist_type: 3,
    });

    if (exists) {
      return res.status(400).json({
        status: false,

        message: "Notes already added in wishlist",
      });
    }

    const wishlist = await UserWishlist.create({
      user_id: req.user.id,

      wishlist_type: 3,

      notes_id,
    });

    return res.status(201).json({
      status: true,

      message: "Notes added to wishlist",

      data: wishlist,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

// GET MY NOTES WISHLIST

const getMyNotesWishlist = async (req, res) => {
  try {
    const data = await UserWishlist.find({
      user_id: req.user.id,

      wishlist_type: 3,
    })

      .populate({
        path: "notes_id",

        select: `
            notes_name
            notes_image
            notes_price
            notes_offer_price
          `,
      })

      .sort({
        added_on: -1,
      });

    return res.status(200).json({
      status: true,

      total: data.length,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

// ADMIN GET ALL NOTES WISHLISTS

const getAllNotesWishlistsAdmin = async (req, res) => {
  try {
    let {
      page = 1,

      limit = 10,

      search = "",

      notes_id,

      from_date,

      to_date,
    } = req.query;

    page = parseInt(page) || 1;

    limit = parseInt(limit) || 10;

    const skip = (page - 1) * limit;

    // FILTER

    let filter = {
      wishlist_type: 3,
    };

    // NOTES FILTER

    if (notes_id) {
      filter.notes_id = notes_id;
    }

    // DATE FILTER

    if (from_date || to_date) {
      filter.added_on = {};

      if (from_date) {
        filter.added_on.$gte = new Date(from_date);
      }

      if (to_date) {
        const endDate = new Date(to_date);

        endDate.setHours(23, 59, 59, 999);

        filter.added_on.$lte = endDate;
      }
    }

    // GET DATA

    let data = await UserWishlist.find(filter)

      .populate({
        path: "user_id",

        select: `
            c_first_name
            c_last_name
            c_email
            c_contact
          `,
      })

      .populate({
        path: "notes_id",

        select: `
            notes_name
          `,
      })

      .sort({
        added_on: -1,
      })

      .skip(skip)

      .limit(limit)

      .lean();

    // SEARCH

    if (search) {
      const text = search.toLowerCase();

      data = data.filter((item) => {
        const studentName =
          `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`.toLowerCase();

        const email = item.user_id?.c_email?.toLowerCase() || "";

        const mobile = String(item.user_id?.c_contact || "");

        const notesName = item.notes_id?.notes_name?.toLowerCase() || "";

        return (
          studentName.includes(text) ||
          email.includes(text) ||
          mobile.includes(text) ||
          notesName.includes(text)
        );
      });
    }

    // FINAL DATA

    const finalData = data.map((item) => {
      return {
        wishlist_id: item._id,

        student_id: item.user_id?._id,

        student_name: `${item.user_id?.c_first_name || ""} ${item.user_id?.c_last_name || ""}`,

        contact_no: item.user_id?.c_contact,

        email: item.user_id?.c_email,

        notes_id: item.notes_id?._id,

        notes_name: item.notes_id?.notes_name,

        added_date: item.added_on,
      };
    });

    // TOTAL

    const totalRecords = await UserWishlist.countDocuments(filter);

    return res.status(200).json({
      status: true,

      current_page: page,

      total_pages: Math.ceil(totalRecords / limit),

      total_records: totalRecords,

      data: finalData,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

// ADMIN SINGLE NOTES WISHLIST

const getSingleNotesWishlist = async (req, res) => {
  try {
    const wishlistId = req.params.id;

    const data = await UserWishlist.findOne({
      _id: wishlistId,

      wishlist_type: 3,
    })

      .populate({
        path: "user_id",

        select: `
            c_first_name
            c_last_name
            c_email
            c_contact
            c_alt_contact
            c_current_city
            c_current_address1
            c_current_address2
          `,
      })

      .populate({
        path: "notes_id",
      });

    if (!data) {
      return res.status(404).json({
        status: false,

        message: "Notes wishlist not found",
      });
    }

    return res.status(200).json({
      status: true,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const deleteNotesWishlist = async (req, res) => {
  try {
    const wishlistId = req.params.id;

    const wishlist = await UserWishlist.findOne({
      _id: wishlistId,

      wishlist_type: 3,
    });

    if (!wishlist) {
      return res.status(404).json({
        status: false,

        message: "Notes wishlist not found",
      });
    }

    await UserWishlist.findByIdAndDelete(wishlistId);

    return res.status(200).json({
      status: true,

      message: "Notes wishlist deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

// Mobile Apis=============================================================================================================================

const appAddToWishlist = async (req, res) => {
  try {
    const user_id = req.user.id;

    const { wishlist_type, item_id } = req.body;

    if (!wishlist_type || !item_id) {
      return res.status(400).json({
        response: "failed",
        message: "wishlist_type and item_id are required",
      });
    }

    const wishlistData = {
      user_id,
      wishlist_type,
    };

    const checkQuery = {
      user_id,
    };

    switch (Number(wishlist_type)) {
      case 1: {
        const course = await Course.findById(item_id);

        if (!course) {
          return res.status(404).json({
            response: "failed",
            message: "Course not found",
          });
        }

        wishlistData.course_id = item_id;
        checkQuery.course_id = item_id;
        break;
      }

      case 2: {
        const pkg = await TestPackage.findById(item_id);

        if (!pkg) {
          return res.status(404).json({
            response: "failed",
            message: "Package not found",
          });
        }

        wishlistData.package_id = item_id;
        checkQuery.package_id = item_id;
        break;
      }

      case 3: {
        const notes = await Notes.findById(item_id);

        if (!notes) {
          return res.status(404).json({
            response: "failed",
            message: "Notes not found",
          });
        }

        wishlistData.notes_id = item_id;
        checkQuery.notes_id = item_id;
        break;
      }

      case 4: {
        const webinar = await Webinar.findById(item_id);

        if (!webinar) {
          return res.status(404).json({
            response: "failed",
            message: "Webinar not found",
          });
        }

        wishlistData.webinar_id = item_id;
        checkQuery.webinar_id = item_id;
        break;
      }

      case 5: {
        const event = await Event.findById(item_id);

        if (!event) {
          return res.status(404).json({
            response: "failed",
            message: "Event not found",
          });
        }

        wishlistData.event_id = item_id;
        checkQuery.event_id = item_id;
        break;
      }

      case 6: {
        const batch = await Batch.findById(item_id);

        if (!batch) {
          return res.status(404).json({
            response: "failed",
            message: "Batch not found",
          });
        }

        wishlistData.batch_id = item_id;
        checkQuery.batch_id = item_id;
        break;
      }

      default:
        return res.status(400).json({
          response: "failed",
          message: "Invalid wishlist type",
        });
    }

    const existingWishlist = await UserWishlist.findOne(checkQuery);

    if (existingWishlist) {
      return res.status(200).json({
        response: "failed",
        message: "Already Added to Wishlist",
      });
    }

    await UserWishlist.create(wishlistData);

    return res.status(200).json({
      response: "success",
      message: "Added to Wishlist",
    });
  } catch (error) {
    return res.status(500).json({
      response: "failed",
      message: error.message,
    });
  }
};

const appGetWishlist = async (req, res) => {
  try {
    const user_id = req.user.id;
    const wishlist_type = req.query.wishlist_type;

    if (!wishlist_type) {
      return res.status(400).json({
        response: "failed",
        message: "wishlist_type is required",
      });
    }

    // ==========================
    // COURSE
    // ==========================
    if (Number(wishlist_type) === 1) {
      const wishlist = await UserWishlist.find({
        user_id,
        wishlist_type: 1,
      }).populate("course_id");

      const wishlist_course = wishlist.map((item) => ({
        t_wishlist_id: item._id,

        course_id: item.course_id?._id || "",
        course_name: item.course_id?.m_course_title || "",
        course_image: item.course_id?.m_course_banner || "",
        course_price: item.course_id?.m_course_price || 0,
        course_offerprice: item.course_id?.m_course_offer_price || 0,
        course_views: item.course_id?.m_course_view || 0,
        course_rating: item.course_id?.m_course_rating || 0,
        course_duration:
          item.course_id?.m_course_duration_app ||
          item.course_id?.m_course_duration_web ||
          0,
        total_review: item.course_id?.m_course_reviews || 0,
      }));

      return res.status(200).json({
        response: "success",
        wishlist_course,
      });
    }

    // ==========================
    // PACKAGE
    // ==========================
    if (Number(wishlist_type) === 2) {
      const wishlist = await UserWishlist.find({
        user_id,
        wishlist_type: 2,
      }).populate("package_id");

      const wishlist_package = wishlist.map((item) => ({
        t_wishlist_id: item._id,

        package_id: item.package_id?._id || "",
        package_name: item.package_id?.m_package_title || "",
        package_price: item.package_id?.m_package_price || 0,
        package_offerprice: item.package_id?.m_package_offer_price || 0,
        total_test: item.package_id?.m_package_total_test || 0,
        package_image:
          item.package_id?.m_package_banner ||
          item.package_id?.m_package_image ||
          "",
      }));

      return res.status(200).json({
        response: "success",
        wishlist_package,
      });
    }

    // ==========================
    // NOTES
    // ==========================
    if (Number(wishlist_type) === 3) {
      const wishlist = await UserWishlist.find({
        user_id,
        wishlist_type: 3,
      }).populate("notes_id");

      const wishlist_notes = wishlist.map((item) => ({
        t_wishlist_id: item._id,

        m_notes_id: item.notes_id?._id || "",
        m_notes_title: item.notes_id?.m_notes_title || "",
        m_notes_price: item.notes_id?.m_notes_price || 0,
        m_notes_offer_price: item.notes_id?.m_notes_offer_price || 0,
        m_notes_banner: item.notes_id?.m_notes_banner || "",
        m_notes_intro: item.notes_id?.m_notes_intro || "",
        m_notes_desc: item.notes_id?.m_notes_desc || "",
      }));

      return res.status(200).json({
        response: "success",
        wishlist_notes,
      });
    }

    // ==========================
    // WEBINAR
    // ==========================
    if (Number(wishlist_type) === 4) {
      const wishlist = await UserWishlist.find({
        user_id,
        wishlist_type: 4,
      }).populate("webinar_id");

      const wishlist_webinar = wishlist.map((item) => ({
        t_wishlist_id: item._id,

        m_webinar_id: item.webinar_id?._id || "",
        m_webinar_topic: item.webinar_id?.m_webinar_topic || "",
        m_webinar_title: item.webinar_id?.m_webinar_title || "",
        m_webinar_desc: item.webinar_id?.m_webinar_desc || "",
        m_webinar_date: item.webinar_id?.m_webinar_date || "",
        m_webinar_time: item.webinar_id?.m_webinar_time || "",
        m_webinar_host_link: item.webinar_id?.m_webinar_host_link || "",
        price: item.webinar_id?.price || 0,
        offer_price: item.webinar_id?.offer_price || 0,
        m_webinar_link: item.webinar_id?.m_webinar_link || "",
        m_webinar_mode: item.webinar_id?.m_webinar_mode || "",
        m_webinar_banner: item.webinar_id?.m_webinar_banner || "",
        m_webinar_duration: item.webinar_id?.m_webinar_duration || "",
        m_webinar_speaker_name: item.webinar_id?.m_webinar_speaker_name || "",
        m_webinar_speaker_experience:
          item.webinar_id?.m_webinar_speaker_experience || "",
        m_webinar_speaker_degisnation:
          item.webinar_id?.m_webinar_speaker_degisnation || "",
        m_webinar_speaker_image: item.webinar_id?.m_webinar_speaker_image || "",
        m_webinar_speaker_mobile:
          item.webinar_id?.m_webinar_speaker_mobile || "",
        m_webinar_speaker_email: item.webinar_id?.m_webinar_speaker_email || "",
        m_webinar_status: item.webinar_id?.m_webinar_status || "",
      }));

      return res.status(200).json({
        response: "success",
        wishlist_webinar,
      });
    }

    // ==========================
    // EVENT
    // ==========================
    if (Number(wishlist_type) === 5) {
      const wishlist = await UserWishlist.find({
        user_id,
        wishlist_type: 5,
      }).populate("event_id");

      const wishlist_event = wishlist.map((item) => ({
        m_event_id: item.event_id?._id || "",
        m_event_title: item.event_id?.m_event_title || "",
        m_event_slug: item.event_id?.m_event_slug || "",
        m_event_category: item.event_id?.m_event_category || "",
        m_event_cat_slug: "",
        m_event_for: "",
        m_event_banner: item.event_id?.m_event_banner || "",
        m_event_date_start: item.event_id?.m_event_date_start || "",
        m_event_date_end: item.event_id?.m_event_date_end || "",
        m_event_time_start: item.event_id?.m_event_time_start || "",
        m_event_time_end: item.event_id?.m_event_time_end || "",
        m_event_skill_level: item.event_id?.m_event_skill_level || "",
        m_event_certificate: item.event_id?.m_event_certificate || "",
        m_event_lang: item.event_id?.m_event_lang || "",
        m_event_host: item.event_id?.m_event_host || "",
        m_event_url: item.event_id?.m_event_url || "",
        m_event_link: item.event_id?.m_event_link || "",
        m_event_contact_no: item.event_id?.m_event_contact_no || "",
        m_event_whatsapp_no: item.event_id?.m_event_whatsapp_no || "",
        m_event_desc: item.event_id?.m_event_desc || "",
        m_event_file: item.event_id?.m_event_file || "",
        m_event_no_of_enroll: item.event_id?.m_event_no_of_enroll || "",
        m_event_order: item.event_id?.m_event_order || "",
        m_event_status: item.event_id?.m_event_status || "",
        m_event_added_on: item.event_id?.m_event_added_on || "",
        t_wishlist_id: item._id,
      }));

      return res.status(200).json({
        response: "success",
        wishlist_event,
      });
    }

    // ==========================
    // BATCH
    // ==========================
    if (Number(wishlist_type) === 6) {
      const wishlist = await UserWishlist.find({
        user_id,
        wishlist_type: 6,
      })
        .populate("batch_id")
        .populate({
          path: "batch_id",
          populate: {
            path: "batch_course",
            model: "course",
          },
        });

      const wishlist_batch = wishlist.map((item) => ({
        t_wishlist_id: item._id,

        batch_id: item.batch_id?._id || "",
        batch_name: item.batch_id?.batch_name || "",
        batch_instructor: item.batch_id?.batch_instructor || "",
        batch_image: item.batch_id?.m_batch_image || "",
        batch_date: item.batch_id?.batch_date || "",
        start_time: item.batch_id?.start_time || "",
        end_time: item.batch_id?.end_time || "",
        strength: item.batch_id?.strength || 0,
        subject: item.batch_id?.subject || "",
        batch_status: item.batch_id?.m_batch_status || 0,

        course_id: item.batch_id?.batch_course?._id || "",
        course_name: item.batch_id?.batch_course?.m_course_title || "",
      }));

      return res.status(200).json({
        response: "success",
        wishlist_batch,
      });
    }

    return res.status(400).json({
      response: "failed",
      message: "Invalid wishlist_type",
    });
  } catch (error) {
    return res.status(500).json({
      response: "failed",
      message: error.message,
    });
  }
};

module.exports = {
  addCourseToWishlist,
  getMyCourseWishlist,
  getAllCourseWishlistsAdmin,
  getSingleCourseWishlist,
  deleteCourseWishlist,

  addTestPackageToWishlist,
  getMyTestPackageWishlist,
  getAllTestPackageWishlistsAdmin,
  getSingleTestPackageWishlist,
  deleteTestPackageWishlist,

  addNotesToWishlist,
  getMyNotesWishlist,
  getAllNotesWishlistsAdmin,
  getSingleNotesWishlist,
  deleteNotesWishlist,

  appAddToWishlist,
  appGetWishlist,
};
