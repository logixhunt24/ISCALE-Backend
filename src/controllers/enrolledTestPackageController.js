const TestPackageEnrollment = require("../models/test_package_enrollment");

const TestPackage = require("../models/test_package");

const { listPackageTests } = require("./quizAttemptController");

// ======================================================
// ENROLL TEST PACKAGE
// ======================================================

const enrollTestPackage = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      test_package_id,
      payment_mode,
      transaction_id,
      coupon_code,
      remark,
    } = req.body;

    // =========================
    // VALIDATION
    // =========================

    if (!test_package_id) {
      return res.status(400).json({
        status: false,
        message: "Test package id is required",
      });
    }

    // =========================
    // PACKAGE CHECK
    // =========================

    const pkg = await TestPackage.findById(
      test_package_id,
    );

    if (!pkg) {
      return res.status(404).json({
        status: false,
        message: "Test package not found",
      });
    }

    // =========================
    // ALREADY PURCHASED CHECK
    // =========================

    const alreadyPurchased =
      await TestPackageEnrollment.findOne({
        user_id: userId,
        test_package_id,
        payment_status: 1,
      });

    if (alreadyPurchased) {
      return res.status(400).json({
        status: false,
        message:
          "Test package already purchased",
      });
    }

    // =========================
    // PRICE CALCULATION
    // =========================

    const originalAmount =
      pkg.m_package_price || 0;

    const offerAmount =
      pkg.m_package_offer_price ||
      originalAmount;

    const discountAmount =
      originalAmount - offerAmount;

    // =========================
    // FREE / PAID
    // =========================

    let paymentStatus = 2;

    if (pkg.m_package_type === 1) {
      paymentStatus = 1;
    }

    // =========================
    // CREATE ENROLLMENT
    // =========================

    const enrollment =
      await TestPackageEnrollment.create({
        user_id: userId,

        test_package_id,

        package_type:
          pkg.m_package_type || 1,

        payment_status: paymentStatus,

        payment_mode:
          payment_mode || null,

        transaction_id:
          transaction_id || null,

        original_amount: originalAmount,

        offer_amount: offerAmount,

        discount_amount: discountAmount,

        payable_amount: offerAmount,

        coupon_code: coupon_code || null,

        remark: remark || null,

        access_status: 1,

        access_type: "lifetime",

        enrolled_on: new Date(),
      });

    return res.status(201).json({
      status: true,

      message:
        paymentStatus === 1
          ? "Test package enrolled successfully"
          : "Payment pending",

      data: enrollment,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

// ======================================================
// MY PURCHASED TEST PACKAGES
// ======================================================

const myPurchasedPackages = async (
  req,
  res,
) => {
  try {
    const userId = req.user.id;

    // =========================
    // PAGINATION
    // =========================

    const page =
      parseInt(req.query.page) || 1;

    const limit =
      parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    // =========================
    // FILTERS
    // =========================

    const search =
      req.query.search || "";

    const payment_status =
      req.query.payment_status;

    const filter = {
      user_id: userId,
      access_status: 1,
    };

    // optional payment filter
    if (payment_status) {
      filter.payment_status = Number(payment_status);
      
    }

    let data =
      await TestPackageEnrollment.find(
        filter,
      )
        .populate({
          path: "test_package_id",
          select: `
            m_package_title
            m_package_image
            m_package_language
            m_package_type
            m_package_price
            m_package_offer_price
          `,
        })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean();

    // =========================
    // SEARCH FILTER
    // =========================

    if (search) {
      const keyword =
        search.toLowerCase();

      data = data.filter((item) => {
        const packageTitle =
          item.test_package_id?.m_package_title?.toLowerCase() ||
          "";

        const language =
          item.test_package_id?.m_package_language?.toLowerCase() ||
          "";

        const packageType =
          item.test_package_id?.m_package_type?.toLowerCase() ||
          "";

        return (
          packageTitle.includes(keyword) ||
          language.includes(keyword) ||
          packageType.includes(keyword)
        );
      });
    }

    // =========================
    // TOTAL COUNT
    // =========================

    const totalRecords =
      await TestPackageEnrollment.countDocuments(
        filter,
      );

    return res.status(200).json({
      status: true,

      current_page: page,

      total_pages: Math.ceil(
        totalRecords / limit,
      ),

      total_records: totalRecords,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};


// ======================================================
// SINGLE PURCHASED PACKAGE
// ======================================================

const getSinglePurchasedPackage = async (
  req,
  res,
) => {
  try {
    const userId = req.user.id;

    const enrollmentId = req.params.id;

    const data =
      await TestPackageEnrollment.findOne({
        _id: enrollmentId,
        user_id: userId,
      }).populate({
        path: "test_package_id",
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
      });

    if (!data) {
      return res.status(404).json({
        status: false,
        message: "Enrollment not found",
      });
    }

    const out = data.toObject();
    const pkg = out.test_package_id;

    out.title = pkg?.m_package_title || "";
    out.description = pkg?.m_package_description || pkg?.m_package_intro || "";
    out.tests =
      out.payment_status === 1 && pkg?._id
        ? await listPackageTests(userId, pkg._id)
        : [];

    return res.status(200).json({
      status: true,
      data: out,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

module.exports = {
  enrollTestPackage,

  myPurchasedPackages,

  getSinglePurchasedPackage,

};