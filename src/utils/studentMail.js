const sendEmail = require("./sendEmail");
const templates = require("./emailTemplates");
const ApplicationSetting = require("../models/application_settings");
const Candidate = require("../models/candidates");
const Course = require("../models/course");
const { signedInvoiceUrl } = require("./invoiceLinks");
const { certificateUrlFor } = require("./certificateLinks");

const SITE_URL = () => (process.env.SITE_URL || "https://www.theiscale.com").replace(/\/$/, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getBrand = async () => {
  const rows = await ApplicationSetting.find({ m_app_key: { $in: ["app_name", "app_email", "app_mobile"] } }).lean();
  const map = Object.fromEntries(rows.map((r) => [r.m_app_key, r.m_app_value]));
  return { name: map.app_name || "The iScale", email: map.app_email || "", phone: map.app_mobile || "" };
};

const idOf = (v) => (v && v._id ? v._id : v);

const firstName = (c) => c?.c_first_name || c?.c_display_name || "";

// Sends one email and reports whether it went out. Never throws: an email problem must not
// break a payment, an approval or a class.
const trySend = async ({ to, subject, html, text }) => {
  if (!to || !EMAIL_RE.test(String(to).trim())) return false;
  try {
    await sendEmail({ to: String(to).trim(), subject, html, text });
    return true;
  } catch (err) {
    console.error(`Email "${subject}" to ${to} failed:`, err.message);
    return false;
  }
};

// After a successful payment
const sendPurchaseConfirmation = async (enrollment) => {
  const [student, course, brand] = await Promise.all([
    Candidate.findById(idOf(enrollment.user_id)).select("c_first_name c_display_name c_email").lean(),
    Course.findById(idOf(enrollment.course_id)).select("m_course_title").lean(),
    getBrand(),
  ]);
  if (!student?.c_email) return false;

  const mail = templates.purchaseConfirmation({
    brand,
    name: firstName(student),
    courseTitle: course?.m_course_title || "your course",
    amount: enrollment.payable_amount ?? enrollment.amount,
    paymentId: enrollment.transaction_id,
    paidOn: enrollment.enrolled_on || enrollment.createdAt,
    access:
      enrollment.access_type === "limited" && enrollment.expiry_date
        ? `Until ${new Date(enrollment.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`
        : "Lifetime",
    courseUrl: `${SITE_URL()}/enrolled-course-details/${idOf(enrollment.course_id)}`,
    invoiceUrl: signedInvoiceUrl(enrollment._id),
  });
  return trySend({ to: student.c_email, ...mail });
};

// When an admin approves a certificate
const sendCertificateReady = async (enrollment) => {
  const [student, course, brand] = await Promise.all([
    Candidate.findById(idOf(enrollment.user_id)).select("c_first_name c_display_name c_email").lean(),
    Course.findById(idOf(enrollment.course_id)).select("m_course_title").lean(),
    getBrand(),
  ]);
  if (!student?.c_email) return false;

  const mail = templates.certificateReady({
    brand,
    name: firstName(student),
    courseTitle: course?.m_course_title || "your course",
    certificateNo: enrollment.certificate_no,
    downloadUrl: certificateUrlFor(enrollment),
    courseUrl: `${SITE_URL()}/enrolled-course-details/${idOf(enrollment.course_id)}`,
  });
  return trySend({ to: student.c_email, ...mail });
};

// One reminder per student (never a shared recipient list, so nobody sees anyone else's address).
// `students` = [{ c_first_name, c_email, ... }]. Returns { sent, failed, skipped }.
const sendLiveClassReminders = async ({ liveClass, batchName, teacher, students, concurrency = 5 }) => {
  const brand = await getBrand();
  const result = { sent: 0, failed: 0, skipped: 0 };
  const queue = [...students];

  const worker = async () => {
    while (queue.length) {
      const student = queue.shift();
      if (!student?.c_email || !EMAIL_RE.test(String(student.c_email).trim())) {
        result.skipped++;
        continue;
      }
      const mail = templates.liveClassReminder({
        brand,
        name: firstName(student),
        title: liveClass.title,
        batchName,
        classDate: liveClass.class_date,
        startTime: liveClass.start_time,
        duration: liveClass.duration,
        teacher,
        joinUrl: liveClass.meeting_link,
      });
      (await trySend({ to: student.c_email, ...mail })) ? result.sent++ : result.failed++;
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) || 1 }, worker));
  return result;
};

module.exports = { sendPurchaseConfirmation, sendCertificateReady, sendLiveClassReminders };
