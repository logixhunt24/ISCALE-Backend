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

// Turns a paid order into an enrolment. Safe to call from several places at once
// (the browser's /verify call AND Razorpay's webhook): whoever flips the order to
// "paid" first creates the enrolment, everyone else sees it is already done.
const fulfillOrder = async (orderId, razorpayPaymentId) => {
  const claimed = await CourseOrder.findOneAndUpdate(
    { _id: orderId, status: { $ne: "paid" } },
    { status: "paid", razorpay_payment_id: razorpayPaymentId },
    { new: true },
  );

  if (!claimed) {
    // already fulfilled by the other path
    const order = await CourseOrder.findById(orderId);
    return { enrolled: true, order, created: false };
  }

  try {
    const existing = await Enrollment.findOne({
      user_id: claimed.user_id,
      course_id: claimed.course_id,
    });
    if (existing) return { enrolled: true, order: claimed, created: false };

    const course = await Course.findById(claimed.course_id);
    if (!course) throw new Error("Course not found");

    let expiry_date = null;
    let access_type = "lifetime";
    if (course.m_course_access_type === "limited") {
      access_type = "limited";
      expiry_date = new Date();
      expiry_date.setDate(expiry_date.getDate() + (course.m_course_access_days || 0));
    }

    await Enrollment.create({
      user_id: claimed.user_id,
      course_id: claimed.course_id,
      course_type: 2,
      payment_status: 1,
      amount: claimed.payable_amount,
      original_amount: claimed.original_amount,
      offer_amount: claimed.offer_amount,
      discount_amount: claimed.original_amount - claimed.offer_amount + claimed.coupon_discount,
      payable_amount: claimed.payable_amount,
      coupon_id: claimed.coupon_id,
      coupon_code: claimed.coupon_code,
      payment_mode: "razorpay",
      transaction_id: razorpayPaymentId,
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

    if (claimed.coupon_id) {
      await Coupon.updateOne({ _id: claimed.coupon_id }, { $inc: { used_coupon: 1 } });
    }

    return { enrolled: true, order: claimed, created: true };
  } catch (err) {
    // let a retry (or the webhook) try again instead of leaving a "paid" order with no enrolment
    await CourseOrder.updateOne({ _id: orderId }, { status: "created" });
    throw err;
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
      // do not downgrade an order that has already been paid (e.g. confirmed by the webhook)
      if (order.status === "created") {
        order.status = "failed";
        await order.save();
      }
      return res.status(400).json({ status: false, message: "Payment verification failed" });
    }

    await fulfillOrder(order._id, razorpay_payment_id);

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

// GET /api/checkout/order-status/:razorpayOrderId
// The checkout page polls this after a payment when its own confirmation call did not
// come back (closed tab, flaky network); the webhook may already have enrolled the student.
const getOrderStatus = async (req, res) => {
  try {
    const order = await CourseOrder.findOne({
      razorpay_order_id: req.params.razorpayOrderId,
      user_id: req.user.id,
    }).select("status course_id");

    if (!order) return res.status(404).json({ status: false, message: "Order not found" });

    return res.json({ status: true, data: { orderStatus: order.status, courseId: order.course_id } });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// POST /api/checkout/webhook   (called by Razorpay, no login)
// Configure in the Razorpay dashboard: URL = <API>/api/checkout/webhook, events =
// payment.captured, order.paid, payment.failed, secret = RAZORPAY_WEBHOOK_SECRET.
const razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("Razorpay webhook hit but RAZORPAY_WEBHOOK_SECRET is not set");
      return res.status(503).json({ status: false, message: "Webhook not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    const raw = req.rawBody;
    if (!signature || !raw) return res.status(400).json({ status: false, message: "Missing signature" });

    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(String(signature));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ status: false, message: "Invalid signature" });
    }

    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;
    const orderEntity = req.body?.payload?.order?.entity;
    const razorpayOrderId = payment?.order_id || orderEntity?.id;

    if (!razorpayOrderId) return res.json({ status: true, message: "Ignored" });

    const order = await CourseOrder.findOne({ razorpay_order_id: razorpayOrderId });
    if (!order) return res.json({ status: true, message: "Unknown order ignored" });

    if (event === "payment.captured" || event === "order.paid") {
      // never trust a payment that does not match what we asked for (amount is in paise)
      const paidPaise = payment?.amount ?? orderEntity?.amount_paid;
      if (paidPaise !== undefined && Number(paidPaise) !== Math.round(Number(order.payable_amount) * 100)) {
        console.error(`Razorpay webhook amount mismatch for order ${razorpayOrderId}: got ${paidPaise}, expected ${order.payable_amount * 100}`);
        return res.json({ status: true, message: "Amount mismatch ignored" });
      }
      const paymentId = payment?.id || order.razorpay_payment_id;
      await fulfillOrder(order._id, paymentId);
    } else if (event === "payment.failed" && order.status === "created") {
      await CourseOrder.updateOne({ _id: order._id, status: "created" }, { status: "failed" });
    }

    return res.json({ status: true });
  } catch (err) {
    console.error("razorpay webhook error:", err);
    // a 5xx makes Razorpay retry the delivery, which is what we want for transient failures
    return res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = { getSummary, createOrder, verifyPayment, getOrderStatus, razorpayWebhook };
