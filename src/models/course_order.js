const mongoose = require("mongoose");

// One row per checkout attempt for a paid course. The amount here is what the
// SERVER computed (price/plan/coupon), and it is what the Razorpay order was
// created for - payment verification checks the signature against this order
// and only then creates the enrollment, so a client can never pick its own
// price or enroll without a verified payment.
const courseOrderSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "candidates",
      required: true,
    },
    course_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "course",
      required: true,
    },

    // Which pricing plan (fee tier index) was bought; null for single-price courses.
    plan_index: { type: Number, default: null },
    plan_name: { type: String, default: "" },

    original_amount: { type: Number, required: true },
    offer_amount: { type: Number, required: true },
    coupon_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "coupon",
      default: null,
    },
    coupon_code: { type: String, default: null },
    coupon_discount: { type: Number, default: 0 },
    payable_amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    razorpay_order_id: { type: String, required: true, unique: true },
    razorpay_payment_id: { type: String, default: null },

    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("course_order", courseOrderSchema);
