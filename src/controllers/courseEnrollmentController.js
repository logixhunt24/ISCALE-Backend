const Course = require("../models/course");
const Enrollment = require("../models/course_enrollment");

// ===============================
// ENROLL COURSE
// ===============================
const enrollCourse = async (req, res) => {
  try {

    const user_id = req.user.id;

    const { course_id, coupon_code, transaction_id } = req.body;

    // ===============================
    // VALIDATION
    // ===============================

    if (!course_id) {
      return res.status(400).json({
        status: false,
        message: "Course ID is required",
      });
    }

    // ===============================
    // CHECK COURSE
    // ===============================

    const course = await Course.findById(course_id);

    if (!course) {
      return res.status(404).json({
        status: false,
        message: "Course not found",
      });
    }

    // ===============================
    // DUPLICATE CHECK
    // ===============================

    const alreadyEnrolled = await Enrollment.findOne({
      user_id,
      course_id,
    });

    if (alreadyEnrolled) {
      return res.status(400).json({
        status: false,
        message: "Already enrolled",
      });
    }

    // ===============================
    // FREE COURSE
    // ===============================

    if (course.m_course_type === 1) {

      const enroll = await Enrollment.create({
        user_id,
        course_id,

        course_type: 1,

        payment_status: 1,

        amount: 0,

        original_amount: 0,
        offer_amount: 0,
        discount_amount: 0,
        payable_amount: 0,

        coupon_code: coupon_code || null,
        transaction_id: transaction_id || null,

        access_type: "lifetime",

        expiry_date: null,

        progress: 0,

        status: 1,

        app_status: 1,
        android_status: 1,
        ios_status: 1,

        test_series_status: 0,
        live_class_status: 0,

        certificate_status: 0,
      });

      return res.status(200).json({
        status: true,
        message: "Enrolled successfully (Free)",
        data: enroll,
      });
    }

    // ===============================
    // PAID COURSE
    // ===============================

    if (course.m_course_type === 2) {

      // TEMP PAYMENT STATUS
      const payment_status = 1;

      // ===============================
      // ACCESS LOGIC
      // ===============================

      let expiry_date = null;

      let access_type = "lifetime";

      if (course.m_course_access_type === "limited") {

        access_type = "limited";

        expiry_date = new Date();

        expiry_date.setDate(
          expiry_date.getDate() + course.m_course_access_days
        );
      }

      // ===============================
      // PRICE CALCULATION
      // ===============================

      const originalAmount =
        course.m_course_price || 0;

      const offerAmount =
        course.m_course_offer_price || originalAmount;

      const discountAmount =
        originalAmount - offerAmount;

      const payableAmount =
        offerAmount;

      // ===============================
      // CREATE ENROLLMENT
      // ===============================

      const enroll = await Enrollment.create({
        user_id,
        course_id,

        course_type: 2,

        payment_status,

        amount: payableAmount,

        original_amount: originalAmount,

        offer_amount: offerAmount,

        discount_amount: discountAmount,

        payable_amount: payableAmount,

        coupon_id: coupon_code || null,
        transaction_id: transaction_id || null,

        access_type,

        expiry_date,

        progress: 0,

        status: 1,

        app_status: 1,
        android_status: 1,
        ios_status: 1,

        test_series_status: 0,
        live_class_status: 0,

        certificate_status: 0,
      });

      return res.status(200).json({
        status: true,
        message: "Enrolled successfully (Paid)",
        data: enroll,
      });
    }

    // ===============================
    // INVALID COURSE TYPE
    // ===============================

    return res.status(400).json({
      status: false,
      message: "Invalid course type",
    });

  } catch (err) {

    console.log(err);

    return res.status(500).json({
      status: false,
      message: err.message,
    });

  }
};

module.exports = {
  enrollCourse,
};