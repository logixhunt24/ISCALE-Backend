const crypto = require("crypto");
const mongoose = require("mongoose");
const Razorpay = require("razorpay");

const Course = require("../models/course");
const Coupon = require("../models/coupon");
const Enrollment = require("../models/course_enrollment");
const CourseOrder = require("../models/course_order");

// Lazily constructed so missing RAZORPAY_KEY_ID/SECRET only breaks checkout,
// not server start-up.
let razorpayClient = null;
const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error(
      "Razorpay is not configured - set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET",
    );
  }
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---------------------------------------------------------------------------
// Pricing - the single source of truth for what a course costs. Plans come
// from the course's own configuration: either its single price, or its fee
// tiers (plan_index = the tier's position in m_course_fee_tiers).
// ---------------------------------------------------------------------------
const finalPrice = (price, offer) => {
  const p = Number(price) || 0;
  const o = Number(offer) || 0;
  return o > 0 && o < p ? o : p;
};

const getPlans = (course) => {
  if (
    Number(course.m_course_pricing_mode) === 2 &&
    Array.isArray(course.m_course_fee_tiers)
  ) {
    const plans = [];
    course.m_course_fee_tiers.forEach((tier, index) => {
      if (tier && Number(tier.price) > 0) {
        plans.push({
          index,
          name: tier.tier_name,
          price: Number(tier.price),
          final: finalPrice(tier.price, tier.offer_price),
        });
      }
    });
    if (plans.length > 0) return plans;
  }
  return [
    {
      index: null,
      name: "Course Fee",
      price: Number(course.m_course_price) || 0,
      final: finalPrice(course.m_course_price, course.m_course_offer_price),
    },
  ];
};

const pickPlan = (plans, planIndex) => {
  if (planIndex !== undefined && planIndex !== null && planIndex !== "") {
    const wanted = plans.find((p) => String(p.index) === String(planIndex));
    if (wanted) return wanted;
  }
  return plans[0];
};

// Validates a promo code against a course/amount and returns either
// { coupon, discount } or { error }.
const evaluateCoupon = async (code, course, amount) => {
  const trimmed = String(code || "").trim();
  if (!trimmed) return {};

  const coupon = await Coupon.findOne({
    coupon_code: new RegExp(`^${escapeRegex(trimmed)}$`, "i"),
    coupon_status: 1,
  });
  if (!coupon) return { error: "Invalid or expired promo code" };

  if (coupon.coupon_type && Number(coupon.coupon_type) !== 1) {
    return { error: "This promo code isn't valid for courses" };
  }
  if (
    coupon.coupon_type_id &&
    String(coupon.coupon_type_id) !== String(course._id)
  ) {
    return { error: "This promo code isn't valid for this course" };
  }

  const now = new Date();
  if (coupon.coupon_start_date && now < new Date(coupon.coupon_start_date)) {
    return { error: "This promo code isn't active yet" };
  }
  if (coupon.coupon_end_date && now > new Date(coupon.coupon_end_date)) {
    return { error: "This promo code has expired" };
  }
  if (coupon.total_coupon > 0 && coupon.used_coupon >= coupon.total_coupon) {
    return { error: "This promo code's usage limit has been reached" };
  }
  if (coupon.coupon_min_amount > 0 && amount < coupon.coupon_min_amount) {
    return {
      error: `This promo code needs an order of at least ₹${coupon.coupon_min_amount}`,
    };
  }

  let discount =
    coupon.coupon_discount_type === "percent"
      ? (amount * (Number(coupon.coupon_discount) || 0)) / 100
      : Number(coupon.coupon_discount) || 0;
  if (coupon.coupon_max_amount > 0) {
    discount = Math.min(discount, coupon.coupon_max_amount);
  }
  // Always leave at least ₹1 to pay - Razorpay can't create a zero-amount order.
  discount = Math.max(0, Math.min(Math.round(discount), Math.floor(amount) - 1));
  if (discount <= 0) return { error: "This promo code gives no discount here" };

  return { coupon, discount };
};

const buildSummary = async ({ course, userId, planIndex, couponCode }) => {
  const plans = getPlans(course);
  const plan = pickPlan(plans, planIndex);
  const couponResult = await evaluateCoupon(couponCode, course, plan.final);

  const couponDiscount = couponResult.discount || 0;
  const total = Math.max(plan.final - couponDiscount, 0);

  const alreadyEnrolled = !!(await Enrollment.exists({
    user_id: userId,
    course_id: course._id,
  }));

  return {
    plans,
    plan,
    original: plan.price,
    offerDiscount: Math.max(plan.price - plan.final, 0),
    couponDiscount,
    total,
    coupon: couponResult.coupon || null,
    couponError: couponResult.error || null,
    alreadyEnrolled,
  };
};

const findPayableCourse = async (courseId) => {
  if (!isValidId(courseId)) return null;
  return Course.findById(courseId).populate("m_course_category", "m_category_name");
};

// GET /api/checkout/summary/:courseId?plan=&coupon=
const getSummary = async (req, res) => {
  try {
    const course = await findPayableCourse(req.params.courseId);
    if (!course) {
      return res.status(404).json({ status: false, message: "Course not found" });
    }

    const isFree = Number(course.m_course_type) === 1;
    const summary = await buildSummary({
      course,
      userId: req.user.id,
      planIndex: req.query.plan,
      couponCode: isFree ? "" : req.query.coupon,
    });

    return res.json({
      status: true,
      data: {
        course: {
          id: course._id,
          title: course.m_course_title,
          banner: course.m_course_banner || "",
          category: course.m_course_category?.m_category_name || "",
          language: course.m_course_language_text || "",
          deliveryMode: course.m_course_delivery_mode || "",
          commencementDate: course.m_course_commencement_date || "",
          lifetimeAccess: course.m_course_access_type !== "limited",
          accessDays:
            course.m_course_access_type === "limited"
              ? course.m_course_access_days
              : null,
        },
        isFree,
        alreadyEnrolled: summary.alreadyEnrolled,
        plans: summary.plans.map((p) => ({
          index: p.index,
          name: p.name,
          price: p.price,
          final: p.final,
        })),
        selectedPlan: summary.plan.index,
        pricing: {
          original: summary.original,
          offerDiscount: summary.offerDiscount,
          couponDiscount: summary.couponDiscount,
          total: summary.total,
        },
        coupon: summary.coupon
          ? { code: summary.coupon.coupon_code, title: summary.coupon.coupon_title }
          : null,
        couponError: summary.couponError,
      },
    });
  } catch (err) {
    console.error("checkout summary error:", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

// POST /api/checkout/create-order  { course_id, plan, coupon_code }
const createOrder = async (req, res) => {
  try {
    const { course_id, plan, coupon_code } = req.body;
    const course = await findPayableCourse(course_id);
    if (!course) {
      return res.status(404).json({ status: false, message: "Course not found" });
    }
    if (Number(course.m_course_type) === 1) {
      return res.status(400).json({
        status: false,
        message: "This course is free - no payment is needed",
      });
    }

    const summary = await buildSummary({
      course,
      userId: req.user.id,
      planIndex: plan,
      couponCode: coupon_code,
    });

    if (summary.alreadyEnrolled) {
      return res.status(400).json({ status: false, message: "You are already enrolled in this course" });
    }
    if (summary.couponError) {
      return res.status(400).json({ status: false, message: summary.couponError });
    }
    if (!(summary.total >= 1)) {
      return res.status(400).json({ status: false, message: "This course has no price set yet" });
    }

    const order = await getRazorpay().orders.create({
      amount: Math.round(summary.total * 100),
      currency: "INR",
      // Razorpay caps receipt at 40 chars.
      receipt: `crs_${String(course._id).slice(-8)}_${Date.now()}`.slice(0, 40),
      notes: {
        user_id: String(req.user.id),
        course_id: String(course._id),
        plan: summary.plan.name || "",
      },
    });

    await CourseOrder.create({
      user_id: req.user.id,
      course_id: course._id,
      plan_index: summary.plan.index,
      plan_name: summary.plan.name,
      original_amount: summary.original,
      offer_amount: summary.plan.final,
      coupon_id: summary.coupon?._id || null,
      coupon_code: summary.coupon?.coupon_code || null,
      coupon_discount: summary.couponDiscount,
      payable_amount: summary.total,
      razorpay_order_id: order.id,
    });

    return res.json({
      status: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        courseTitle: course.m_course_title,
      },
    });
  } catch (err) {
    console.error("checkout create-order error:", err);
    return res.status(500).json({
      status: false,
      message: err.message || "Failed to create payment order",
    });
  }
};

// POST /api/checkout/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        status: false,
        message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
      });
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ status: false, message: "Razorpay is not configured on the server" });
    }

    const order = await CourseOrder.findOne({
      razorpay_order_id,
      user_id: req.user.id,
    });
    if (!order) {
      return res.status(404).json({ status: false, message: "Order not found" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      order.status = "failed";
      await order.save();
      return res.status(400).json({ status: false, message: "Payment verification failed" });
    }

    // Idempotent: a repeated verify (or a retry after a network blip) must
    // not create a second enrollment or double-count the coupon.
    const existing = await Enrollment.findOne({
      user_id: req.user.id,
      course_id: order.course_id,
    });
    if (existing) {
      if (order.status !== "paid") {
        order.status = "paid";
        order.razorpay_payment_id = razorpay_payment_id;
        await order.save();
      }
      return res.json({ status: true, message: "Payment verified - you are enrolled", data: { courseId: order.course_id } });
    }

    const course = await Course.findById(order.course_id);
    if (!course) {
      return res.status(404).json({ status: false, message: "Course not found" });
    }

    let expiry_date = null;
    let access_type = "lifetime";
    if (course.m_course_access_type === "limited") {
      access_type = "limited";
      expiry_date = new Date();
      expiry_date.setDate(expiry_date.getDate() + (course.m_course_access_days || 0));
    }

    await Enrollment.create({
      user_id: req.user.id,
      course_id: order.course_id,
      course_type: 2,
      payment_status: 1,
      amount: order.payable_amount,
      original_amount: order.original_amount,
      offer_amount: order.offer_amount,
      discount_amount: order.original_amount - order.offer_amount + order.coupon_discount,
      payable_amount: order.payable_amount,
      coupon_id: order.coupon_id,
      coupon_code: order.coupon_code,
      payment_mode: "razorpay",
      transaction_id: razorpay_payment_id,
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
      register_from: 1,
    });

    order.status = "paid";
    order.razorpay_payment_id = razorpay_payment_id;
    await order.save();

    if (order.coupon_id) {
      await Coupon.updateOne({ _id: order.coupon_id }, { $inc: { used_coupon: 1 } });
    }

    return res.json({
      status: true,
      message: "Payment verified - you are enrolled",
      data: { courseId: order.course_id },
    });
  } catch (err) {
    console.error("checkout verify error:", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = { getSummary, createOrder, verifyPayment };
