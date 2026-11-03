// HTML + plain-text bodies for the emails students receive. Every value that comes from the
// database or a student (names, course/class titles, links) goes through esc() before it is
// placed in HTML, so a title like "<script>" can never end up in someone's inbox as markup.
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const money = (n) =>
  `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateText = (d, withTime = false) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const opts = { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit", hour12: true });
  return dt.toLocaleString("en-IN", opts);
};

// Only ever link to http(s) addresses.
const safeUrl = (u) => {
  try {
    const url = new URL(String(u));
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

const button = (href, label) => {
  const url = safeUrl(href);
  return url
    ? `<p style="margin:24px 0"><a href="${esc(url)}" style="background:#ed0331;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:8px;display:inline-block">${esc(label)}</a></p>`
    : "";
};

const row = (label, value) =>
  value
    ? `<tr><td style="padding:8px 0;color:#64748b;width:42%">${esc(label)}</td><td style="padding:8px 0;color:#0f172a;font-weight:600">${esc(value)}</td></tr>`
    : "";

const layout = ({ brand, title, preheader, bodyHtml }) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#ed0331;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:700">${esc(brand.name)}</td></tr>
    <tr><td style="padding:28px;color:#334155;font-size:15px;line-height:1.6">
      <h2 style="margin:0 0 14px;color:#0f172a;font-size:20px">${esc(title)}</h2>
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:18px 28px;background:#f8fafc;color:#94a3b8;font-size:12px;line-height:1.5">
      ${esc(brand.name)}${brand.email ? ` &middot; ${esc(brand.email)}` : ""}${brand.phone ? ` &middot; ${esc(brand.phone)}` : ""}<br>
      You are receiving this email because of your activity on ${esc(brand.name)}.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

// ------------------------------------------------------------------ templates

const purchaseConfirmation = ({ brand, name, courseTitle, amount, paymentId, paidOn, access, courseUrl, invoiceUrl }) => {
  const subject = `Payment received - welcome to ${courseTitle}`;
  const bodyHtml =
    `<p>Hi ${esc(name || "there")},</p>` +
    `<p>Thank you for your purchase. Your payment was successful and you now have access to <b>${esc(courseTitle)}</b>.</p>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:18px 0">` +
    row("Course", courseTitle) +
    row("Amount paid", money(amount)) +
    row("Paid on", dateText(paidOn, true)) +
    row("Payment ID", paymentId) +
    row("Access", access) +
    `</table>` +
    button(courseUrl, "Start learning") +
    (safeUrl(invoiceUrl) ? `<p>Need an invoice? <a href="${esc(safeUrl(invoiceUrl))}" style="color:#ed0331;font-weight:700">Download your invoice (PDF)</a></p>` : "") +
    `<p>If you have any questions, just reply to this email.</p>` +
    `<p>Happy learning,<br>Team ${esc(brand.name)}</p>`;
  const text =
    `Hi ${name || "there"},\n\nYour payment was successful and you now have access to ${courseTitle}.\n\n` +
    `Amount paid: ${money(amount)}\nPaid on: ${dateText(paidOn, true)}\nPayment ID: ${paymentId || "-"}\nAccess: ${access || "-"}\n\n` +
    `Start learning: ${safeUrl(courseUrl)}\n` + (safeUrl(invoiceUrl) ? `Invoice: ${safeUrl(invoiceUrl)}\n` : "") +
    `\nTeam ${brand.name}`;
  return { subject, html: layout({ brand, title: "Payment received", preheader: `You now have access to ${courseTitle}`, bodyHtml }), text };
};

const certificateReady = ({ brand, name, courseTitle, certificateNo, downloadUrl, courseUrl }) => {
  const subject = `Your certificate for ${courseTitle} is ready`;
  const bodyHtml =
    `<p>Hi ${esc(name || "there")},</p>` +
    `<p>Congratulations! Your certificate for <b>${esc(courseTitle)}</b> has been approved. Thank you for your hard work and best wishes for your career.</p>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:18px 0">` +
    row("Course", courseTitle) +
    row("Certificate number", certificateNo) +
    `</table>` +
    button(downloadUrl, "Download certificate") +
    (safeUrl(courseUrl) ? `<p>You can also download it any time from your <a href="${esc(safeUrl(courseUrl))}" style="color:#ed0331;font-weight:700">course page</a>.</p>` : "") +
    `<p>Wishing you all the very best,<br>Team ${esc(brand.name)}</p>`;
  const text =
    `Hi ${name || "there"},\n\nCongratulations! Your certificate for ${courseTitle} has been approved.\n` +
    `Certificate number: ${certificateNo || "-"}\nDownload: ${safeUrl(downloadUrl)}\n\nTeam ${brand.name}`;
  return { subject, html: layout({ brand, title: "Your certificate is ready", preheader: `Congratulations on completing ${courseTitle}`, bodyHtml }), text };
};

const liveClassReminder = ({ brand, name, title, batchName, classDate, startTime, duration, teacher, joinUrl }) => {
  const subject = `Live class reminder: ${title}`;
  const bodyHtml =
    `<p>Hi ${esc(name || "there")},</p>` +
    `<p>This is a reminder for your upcoming live class.</p>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:18px 0">` +
    row("Class", title) +
    row("Batch", batchName) +
    row("Date", dateText(classDate)) +
    row("Time", startTime) +
    row("Duration", duration ? `${duration} minutes` : "") +
    row("Teacher", teacher) +
    `</table>` +
    button(joinUrl, "Join the class") +
    `<p>Please join a few minutes early so you do not miss the start.</p>` +
    `<p>See you there,<br>Team ${esc(brand.name)}</p>`;
  const text =
    `Hi ${name || "there"},\n\nReminder for your live class: ${title}\n` +
    `${batchName ? `Batch: ${batchName}\n` : ""}Date: ${dateText(classDate)}\nTime: ${startTime || "-"}\n${teacher ? `Teacher: ${teacher}\n` : ""}` +
    `Join: ${safeUrl(joinUrl) || "(link will be shared by your teacher)"}\n\nTeam ${brand.name}`;
  return { subject, html: layout({ brand, title: "Live class reminder", preheader: `${title} - ${dateText(classDate)} ${startTime || ""}`, bodyHtml }), text };
};

module.exports = { esc, purchaseConfirmation, certificateReady, liveClassReminder };
