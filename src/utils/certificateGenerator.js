const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const fs = require("fs");
const path = require("path");

// Unique ID Generate
const generateUniqueCertNo = async (EnrollmentModel) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${yy}${mm}`;
  const latestCert = await EnrollmentModel.findOne({
    certificate_no: { $regex: `^${prefix}` },
  }).sort({ certificate_no: -1 });
  let sequence = 115;
  if (latestCert && latestCert.certificate_no)
    sequence = parseInt(latestCert.certificate_no.slice(-4)) + 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
};

const generateCertificatePDF = async (
  userName,
  courseTitle,
  categoryName,
  certNo,
  issuedAt = null,
) => {
  try {
    const cat = String(categoryName || "bootcamp").toLowerCase();
    // One decision drives the template, the layout and the drawing code. Matching
    // "analy" covers both "Data Analyst" and "Data Analytics" category names; they
    // used to be checked with different strings, so "Data Analytics" got the
    // bootcamp layout but the data-course drawing path and crashed.
    const isDS = /data\s*scien/.test(cat);
    const isDA = !isDS && /data\s*analy/.test(cat);

    // the printed date is the approval date, so re-downloading later gives the same certificate
    const now = issuedAt ? new Date(issuedAt) : new Date();
    const monthYear = now.toLocaleString("default", {
      month: "long",
      year: "numeric",
    }); // "May 2026"
    const fullDate = `${String(now.getDate()).padStart(2, "0")} ${monthYear}`; // "04 May 2026"

    let config = {};

    // --- CONFIGURATION ---
    if (isDS) {
      config = {
        nameSize: 120,
        nameY: 580,
        nameColor: rgb(0.17, 0.17, 0.17),
        courseSize: 45,
        courseX: 740,
        courseY: 455,
        courseColor: rgb(0.46, 0.098, 0.098),
        dateX: 700,
        dateY: 400,
        datePart1: "On ",
        color1: rgb(0.17, 0.17, 0.17),
        color2: rgb(0.474, 0.094, 0.098),
        certNoSize: 50,
        certNoX: 450,
        certNoY: 220,

        certNoColor: rgb(0.188, 0.188, 0.188),
      };
    } else if (isDA) {
      config = {
        nameSize: 110,
        nameY: 840,
        nameColor: rgb(0.46, 0.09, 0.09),
        courseSize: 45,
        courseX: 290,
        courseY: 700,
        courseColor: rgb(0.46, 0.09, 0.1),
        dateX: 500,
        dateY: 650,
        datePart1: "On ",
        color1: rgb(0.17, 0.17, 0.17),
        color2: rgb(0.46, 0.1, 0.094),
        certNoSize: 55,
        certNoX: 80,
        certNoY: 420,
        certNoColor: rgb(0.17, 0.17, 0.17),
      };
    } else {
      // Bootcamp Style (Conducted By ...)
      config = {
        // ==========================
        // NAME
        // ==========================
        nameSize: 85,
        nameX: 870, // null = auto center
        nameY: 620,
        nameColor: rgb(0, 0, 0),

        // ==========================
        // COURSE
        // ==========================
        // courseSize: 40,
        // courseX: 410,
        // courseY: 455,
        // courseColor: rgb(0, 0, 0),

        // // ==========================
        // // CONDUCTED TEXT
        // // ==========================
        // conductedText: "Conducted By The iScale.",
        // conductedSize: 40,
        // conductedX: 300,
        // conductedY: 285,
        // conductedColor: rgb(0, 0, 0),

        // COURSE + CONDUCTED (Combined)
        courseSize: 40,

        courseY: 455,

        courseRightX: 1520, // Right Side Fix

        courseColor: rgb(1, 0, 0),

        conductedText: " Conducted By The iScale.",

        conductedColor: rgb(0, 0, 0),

        // ==========================
        // DATE
        // ==========================
        dateLabel: "Date: ",
        dateValue: fullDate,
        dateSize: 40,
        dateX: 1150,
        dateY: 360,
        dateColor: rgb(0, 0, 0.5),

        // ==========================
        // CERTIFICATE NUMBER
        // ==========================
        certNoSize: 42,
        certNoX: 470,
        certNoY: 140,
        certNoColor: rgb(0, 0, 0),
      };
    }

    const assetsDir = path.join(__dirname, "../../assets");
    const templateName = isDS
      ? "ds_bg.jpeg"
      : isDA
        ? "da_bg.jpeg"
        : "bootcamp_bg.jpeg";

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const image = await pdfDoc.embedJpg(
      fs.readFileSync(path.join(assetsDir, "templates", templateName)),
    );
    const nameFont = await pdfDoc.embedFont(
      fs.readFileSync(
        path.join(assetsDir, "fonts", "GoodVibrations-Script-400.ttf"),
      ),
    );
    const secFont = await pdfDoc.embedFont(
      fs.readFileSync(path.join(assetsDir, "fonts", "calibri-italic.ttf")),
    );

    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    // 1. Name
    page.drawText(userName, {
      x:
        config.nameX ??
        image.width / 2 -
          nameFont.widthOfTextAtSize(userName, config.nameSize) / 2,

      y: config.nameY,

      size: config.nameSize,

      font: nameFont,

      color: config.nameColor,
    });

    // 2. Course & Conducted Text
    if ((isDS || isDA)) {
      page.drawText(courseTitle, {
        x: config.courseX,
        y: config.courseY,
        size: config.courseSize,
        font: secFont,
        color: config.courseColor,
      });
    } else {
      // Course
      const courseWidth = secFont.widthOfTextAtSize(
        courseTitle,
        config.courseSize,
      );

      const conductedWidth = secFont.widthOfTextAtSize(
        config.conductedText,
        config.courseSize,
      );

      const totalWidth = courseWidth + conductedWidth;

      // Right side fix
      const startX = config.courseRightX - totalWidth;

      // Course
      page.drawText(courseTitle, {
        x: startX,
        y: config.courseY,
        size: config.courseSize,
        font: secFont,
        color: config.courseColor,
      });

      // Conducted
      page.drawText(config.conductedText, {
        x: startX + courseWidth,
        y: config.courseY,
        size: config.courseSize,
        font: secFont,
        color: config.conductedColor,
      });
    }

    // 3. Dynamic Date Logic
    if ((isDS || isDA)) {
      const w1 = secFont.widthOfTextAtSize(config.datePart1, config.courseSize);
      page.drawText(config.datePart1, {
        x: config.dateX,
        y: config.dateY,
        size: config.courseSize,
        font: secFont,
        color: config.color1,
      });
      page.drawText(monthYear, {
        x: config.dateX + w1,
        y: config.dateY,
        size: config.courseSize,
        font: secFont,
        color: config.color2,
      });
    } else {
      // "Date: 04 May 2026"
      page.drawText(`${config.dateLabel}${config.dateValue}`, {
        x: config.dateX,
        y: config.dateY,
        size: config.dateSize,
        font: secFont,
        color: config.dateColor,
      });
    }

    // 4. Cert No
    page.drawText(certNo, {
      x: config.certNoX,
      y: config.certNoY,
      size: config.certNoSize,
      font: secFont,
      color: config.certNoColor,
    });

    // const pdfBytes = await pdfDoc.save();
    // fs.writeFileSync(
    //   path.join(assetsDir, "certificates", `Cert_${certNo}.pdf`),
    //   pdfBytes,
    // );
    // return `assets/certificates/Cert_${certNo}.pdf`;

    const pdfBytes = await pdfDoc.save();

    return pdfBytes;
  } catch (error) {
    throw error;
  }
};

module.exports = { generateCertificatePDF, generateUniqueCertNo };
