const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

const BRAND = rgb(0.76, 0.01, 0.16);
const DARK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);

// Helvetica only covers WinAnsi, so strip anything it cannot encode (emoji,
// some unicode dashes) instead of letting pdf-lib throw.
const clean = (v) =>
  String(v ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .trim();

const money = (n) =>
  `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d, withTime = false) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  const opts = { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit", hour12: true });
  return dt.toLocaleString("en-IN", opts);
};

const wrap = (text, font, size, maxWidth) => {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
};

/**
 * inv = {
 *   invoiceNo, invoiceDate,
 *   seller: { name, email, phone, address },
 *   student: { name, email, phone, studentId },
 *   course: { title, access },
 *   payment: { mode, transactionId, paidOn },
 *   amounts: { original, discount, total },
 * }
 */
const generateInvoicePDF = async (inv) => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = page.getWidth();
  const M = 48;
  let y = 800;

  const text = (t, x, yy, { size = 10, f = font, color = DARK } = {}) =>
    page.drawText(clean(t), { x, y: yy, size, font: f, color });
  const right = (t, xRight, yy, opts = {}) => {
    const f = opts.f || font;
    const size = opts.size || 10;
    text(t, xRight - f.widthOfTextAtSize(clean(t), size), yy, opts);
  };
  const rule = (yy, color = LINE) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.8, color });

  // ---- header ----
  text(inv.seller.name || "The iScale", M, y, { size: 20, f: bold, color: BRAND });
  right("INVOICE", W - M, y, { size: 20, f: bold });
  y -= 18;
  [inv.seller.address, inv.seller.email, inv.seller.phone && `Phone: ${inv.seller.phone}`]
    .filter(Boolean)
    .forEach((l) => {
      wrap(l, font, 9, 300).forEach((ln) => {
        text(ln, M, y, { size: 9, color: MUTED });
        y -= 12;
      });
    });

  const metaTop = 782;
  right(`Invoice No: ${inv.invoiceNo}`, W - M, metaTop, { size: 10, f: bold });
  right(`Date: ${fmtDate(inv.invoiceDate)}`, W - M, metaTop - 14, { size: 10, color: MUTED });

  y = Math.min(y, metaTop - 14) - 14;
  rule(y);
  y -= 26;

  // ---- billed to ----
  text("BILLED TO", M, y, { size: 9, f: bold, color: MUTED });
  y -= 16;
  text(inv.student.name || "-", M, y, { size: 13, f: bold });
  y -= 15;
  [
    inv.student.email,
    inv.student.phone && `Mobile: +91 ${inv.student.phone}`,
    inv.student.studentId && `Student ID: ${inv.student.studentId}`,
  ]
    .filter(Boolean)
    .forEach((l) => {
      text(l, M, y, { size: 10, color: MUTED });
      y -= 13;
    });

  y -= 18;

  // ---- line item ----
  const colAmountRight = W - M - 8;
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 24, color: rgb(0.96, 0.96, 0.97) });
  text("DESCRIPTION", M + 8, y + 2, { size: 9, f: bold, color: MUTED });
  right("AMOUNT", colAmountRight, y + 2, { size: 9, f: bold, color: MUTED });
  y -= 26;

  const itemTop = y;
  const titleLines = wrap(inv.course.title || "Course enrolment", bold, 11, W - 2 * M - 150);
  titleLines.forEach((ln) => {
    text(ln, M + 8, y, { size: 11, f: bold });
    y -= 15;
  });
  if (inv.course.access) {
    text(inv.course.access, M + 8, y, { size: 9.5, color: MUTED });
    y -= 13;
  }
  right(money(inv.amounts.original), colAmountRight, itemTop, { size: 11 });

  y -= 8;
  rule(y);
  y -= 22;

  // ---- totals ----
  const labelX = W - M - 230;
  const totalRow = (label, value, { strong = false, color = DARK } = {}) => {
    text(label, labelX, y, { size: strong ? 12 : 10, f: strong ? bold : font, color: strong ? DARK : MUTED });
    right(value, colAmountRight, y, { size: strong ? 12 : 10, f: strong ? bold : font, color });
    y -= strong ? 20 : 16;
  };
  totalRow("Course fee", money(inv.amounts.original));
  if (inv.amounts.discount > 0) totalRow("Discount", `- ${money(inv.amounts.discount)}`, { color: rgb(0.1, 0.55, 0.25) });
  y -= 2;
  page.drawLine({ start: { x: labelX, y: y + 12 }, end: { x: W - M, y: y + 12 }, thickness: 0.8, color: LINE });
  totalRow("Total paid", money(inv.amounts.total), { strong: true });

  y -= 18;

  // ---- payment details ----
  text("PAYMENT DETAILS", M, y, { size: 9, f: bold, color: MUTED });
  y -= 16;
  [
    ["Payment status", "Paid"],
    ["Paid on", fmtDate(inv.payment.paidOn, true)],
    ["Payment mode", inv.payment.mode ? String(inv.payment.mode).replace(/^./, (c) => c.toUpperCase()) : "-"],
    ["Transaction ID", inv.payment.transactionId || "-"],
  ].forEach(([k, v]) => {
    text(k, M, y, { size: 10, color: MUTED });
    text(v, M + 110, y, { size: 10 });
    y -= 15;
  });

  // ---- footer ----
  rule(70);
  const note = "This is a computer-generated invoice and does not require a signature.";
  text(note, (W - font.widthOfTextAtSize(note, 8.5)) / 2, 54, { size: 8.5, color: MUTED });
  const brand = `${inv.seller.name || "The iScale"} - thank you for learning with us.`;
  text(brand, (W - font.widthOfTextAtSize(clean(brand), 8.5)) / 2, 42, { size: 8.5, color: MUTED });

  return Buffer.from(await pdf.save());
};

module.exports = { generateInvoicePDF };
