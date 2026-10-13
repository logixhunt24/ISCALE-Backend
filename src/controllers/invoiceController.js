const crypto = require("crypto");
const mongoose = require("mongoose");

const Enrollment = require("../models/course_enrollment");
const Candidate = require("../models/candidates");
const Course = require("../models/course");
const ApplicationSetting = require("../models/application_settings");
const InvoiceCounter = require("../models/invoice_counter");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");

const PUBLIC_API_URL = (process.env.PUBLIC_API_URL || "https://api.theiscale.com").replace(/\/$/, "");

const validId = (v) => mongoose.Types.ObjectId.isValid(v);

// Signed links let the mobile app open the PDF in a browser/viewer that cannot send a bearer token.
const sign = (enrollmentId) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET || "").update(`invoice:${enrollmentId}`).digest("hex");

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const signedInvoiceUrl = (enrollmentId) =>
  `${PUBLIC_API_URL}/api/invoice/signed/${enrollmentId}?sig=${sign(enrollmentId)}`;

// Only paid, non-free enrolments get an invoice.
const isInvoiceable = (e) =>
  e && e.status === 1 && e.payment_status === 1 && e.course_type === 2 && Number(e.payable_amount ?? e.amount) > 0;

// Hands out INV-YYYY-00001 style numbers; the counter document makes it race-safe.
const nextInvoiceNo = async () => {
  const year = String(new Date().getFullYear());
  const counter = await InvoiceCounter.findOneAndUpdate(
    { _id: year },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `INV-${year}-${String(counter.seq).padStart(5, "0")}`;
};

const getSettings = async () => {
  const rows = await ApplicationSetting.find({
    m_app_key: { $in: ["app_name", "app_email", "app_mobile", "app_address"] },
  }).lean();
  const map = Object.fromEntries(rows.map((r) => [r.m_app_key, r.m_app_value]));
  return {
    name: map.app_name || "The iScale",
    email: map.app_email || "",
    phone: map.app_mobile || "",
    address: map.app_address || "",
  };
};

const accessText = (e) => {
  if (e.access_type === "limited" && e.expiry_date) {
    const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    return `Access: ${fmt(e.enrolled_on || e.createdAt)} to ${fmt(e.expiry_date)}`;
  }
  return "Access: Lifetime";
};

// Builds the PDF for an enrolment (assigning its invoice number on first use).
const buildInvoice = async (enrollment) => {
  if (!enrollment.invoice_no) {
    // only one writer wins if two requests race; the loser re-reads the winner's number
    const candidate = await nextInvoiceNo();
    const updated = await Enrollment.findOneAndUpdate(
      { _id: enrollment._id, $or: [{ invoice_no: null }, { invoice_no: "" }, { invoice_no: { $exists: false } }] },
      { invoice_no: candidate },
      { new: true },
    );
    enrollment = updated || (await Enrollment.findById(enrollment._id));
  }

  const [student, course, seller] = await Promise.all([
    Candidate.findById(enrollment.user_id).lean(),
    Course.findById(enrollment.course_id).select("m_course_title").lean(),
    getSettings(),
  ]);

  const original = Number(enrollment.original_amount ?? enrollment.amount ?? 0);
  const total = Number(enrollment.payable_amount ?? enrollment.amount ?? 0);
  const discount = Math.max(0, original - total);

  const pdf = await generateInvoicePDF({
    invoiceNo: enrollment.invoice_no,
    invoiceDate: enrollment.enrolled_on || enrollment.createdAt,
    seller,
    student: {
      name: [student?.c_first_name, student?.c_last_name].filter(Boolean).join(" ") || student?.c_display_name || "",
      email: student?.c_email || "",
      phone: student?.c_contact || "",
      studentId: student?.candidate_idno || "",
    },
    course: { title: course?.m_course_title || "Course enrolment", access: accessText(enrollment) },
    payment: {
      mode: enrollment.payment_mode,
      transactionId: enrollment.transaction_id,
      paidOn: enrollment.enrolled_on || enrollment.createdAt,
    },
    amounts: { original, discount, total },
  });

  return { pdf, invoiceNo: enrollment.invoice_no };
};

const sendPdf = (res, { pdf, invoiceNo }) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoiceNo}.pdf"`);
  res.setHeader("Content-Length", pdf.length);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.end(pdf);
};

// GET /invoice/course/:course_id  (logged-in student downloads their own invoice)
const downloadCourseInvoice = async (req, res) => {
  try {
    const { course_id } = req.params;
    if (!validId(course_id)) return res.status(400).json({ status: false, message: "Invalid course id" });

    const enrollment = await Enrollment.findOne({
      user_id: req.user.id,
      course_id,
      status: 1,
      payment_status: 1,
      course_type: 2,
    }).sort({ createdAt: -1 });

    if (!isInvoiceable(enrollment)) {
      return res.status(404).json({ status: false, message: "No invoice is available for this course." });
    }

    return sendPdf(res, await buildInvoice(enrollment));
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// GET /invoice/signed/:enrollment_id?sig=...  (link handed to the mobile app)
const downloadSignedInvoice = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const { sig } = req.query;
    if (!validId(enrollment_id) || !sig || !safeEqual(sig, sign(enrollment_id))) {
      return res.status(404).json({ status: false, message: "Invoice not found" });
    }

    const enrollment = await Enrollment.findById(enrollment_id);
    if (!isInvoiceable(enrollment)) {
      return res.status(404).json({ status: false, message: "Invoice not found" });
    }

    return sendPdf(res, await buildInvoice(enrollment));
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = {
  downloadCourseInvoice,
  downloadSignedInvoice,
  isInvoiceable,
  signedInvoiceUrl,
  nextInvoiceNo,
};
