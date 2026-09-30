const Course = require("../models/course");
const Category = require("../models/category");
const { toPublicUrl } = require("../utils/imageUrl");

const TestPackage = require("../models/test_package");
const TestCategory = require("../models/test_categories");

const Notes = require("../models/notes");
const NotesCategory = require("../models/notes_category");

const Webinar = require("../models/webinar");

const Event = require("../models/event");
const EventCategory = require("../models/event_category");


const appSearch = async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword || keyword.trim() === "") {
      return res.status(400).json({
        response: "error",
        message: "Search keyword is required",
      });
    }

    const searchRegex = new RegExp(keyword, "i");

    // ==================================================
    // COURSES
    // ==================================================

    const courses = await Course.find({
      m_course_status: 1,
    })
      .populate("m_course_category", "m_category_name")
      .lean();

    const filteredCourses = courses.filter(
      (item) =>
        searchRegex.test(item.m_course_title || "") ||
        searchRegex.test(
          item.m_course_category?.m_category_name || ""
        )
    );

    // ==================================================
    // TEST PACKAGES
    // ==================================================

    const tests = await TestPackage.find({
      m_package_status: 1,
    })
      .populate(
        "m_package_test_category",
        "test_categoryName"
      )
      .lean();

    const filteredTests = tests.filter(
      (item) =>
        searchRegex.test(item.m_package_title || "") ||
        searchRegex.test(
          item.m_package_test_category?.test_categoryName || ""
        )
    );

    // ==================================================
    // NOTES
    // ==================================================

    const notes = await Notes.find({
      notes_status: 1,
    })
      .populate(
        "notes_category_id",
        "nc_name"
      )
      .lean();

    const filteredNotes = notes.filter(
      (item) =>
        searchRegex.test(item.notes_name || "") ||
        searchRegex.test(
          item.notes_category_id?.nc_name || ""
        )
    );

    // ==================================================
    // WEBINARS
    // ==================================================

    const webinars = await Webinar.find({
      m_webinar_status: 1,
      $or: [
        { m_webinar_title: searchRegex },
        { m_webinar_topic: searchRegex },
      ],
    }).lean();

    // ==================================================
    // EVENTS
    // ==================================================

    const events = await Event.find({
      m_event_status: 1,
    })
      .populate(
        "m_event_category",
        "m_ec_title"
      )
      .lean();

    const filteredEvents = events.filter(
      (item) =>
        searchRegex.test(item.m_event_title || "") ||
        searchRegex.test(
          item.m_event_category?.m_ec_title || ""
        )
    );

    return res.status(200).json({
      response: "success",
      message: "Search Successfully",

      search: {
        course: filteredCourses.map((item) => ({
          course_id: item._id,
          course_name: item.m_course_title,
          course_duration:
            item.m_course_duration_app || 0,

          category_id:
            item.m_course_category?._id || null,

          category_name:
            item.m_course_category?.m_category_name ||
            "",

          course_image: toPublicUrl(item.m_course_banner),

          course_views:
            item.m_course_view || 0,

          course_price:
            item.m_course_price || 0,

          course_offerprice:
            item.m_course_offer_price || 0,

          totalPercent:
            item.m_course_price > 0
              ? Math.round(
                  ((item.m_course_price -
                    item.m_course_offer_price) /
                    item.m_course_price) *
                    100
                )
              : 0,

          course_rating:
            item.m_course_rating || 0,

          course_reviews:
            item.m_course_reviews || 0,

          total_subjects: 0,
        })),

        test: filteredTests,

        notes: filteredNotes,

        webinar: webinars,

        events: filteredEvents,
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

module.exports={appSearch}