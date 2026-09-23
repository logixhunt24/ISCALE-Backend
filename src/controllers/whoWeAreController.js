const WhoWeAre = require("../models/whoWeAre");
const {
  extractUploadedFile,
  deleteFile,
} = require("../services/storageService");

const DEFAULTS = {
  m_pill_text: "Who We Are",
  m_heading: "Know About iScale Learning",
  m_description:
    "A community-driven upskilling platform built to take learners from fundamentals to job-ready skills — live mentorship, hands-on projects, and a direct path into the careers this industry is actually hiring for.",
  m_news_pill_text: "Our Journal & Insights",
  m_news_heading: "From Our Blog",
};

// Single editable section - lazily creates the one document on first read
// instead of requiring a separate seed step.
const getOrCreate = async () => {
  let doc = await WhoWeAre.findOne();
  if (!doc) {
    doc = await WhoWeAre.create(DEFAULTS);
  }
  return doc;
};

const shape = (doc) => ({
  _id: doc._id,
  pill_text: doc.m_pill_text,
  heading: doc.m_heading,
  description: doc.m_description,
  news_pill_text: doc.m_news_pill_text,
  news_heading: doc.m_news_heading,
  cards: (doc.m_cards || []).map((c) => ({
    title: c.title || "",
    image: c.image || "",
    link: c.link || "",
  })),
});

const getWhoWeAre = async (req, res) => {
  try {
    const doc = await getOrCreate();
    return res.json({ status: true, data: shape(doc) });
  } catch (err) {
    console.error("getWhoWeAre error:", err.message);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

// Cards arrive JSON-stringified the same way course fee_features do - one
// row per slot with title/link only (images come from the separate
// card_image_0/1/2 file fields, positional against this array).
const parseCards = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const updateWhoWeAre = async (req, res) => {
  const uploadedFiles = [];
  try {
    const doc = await getOrCreate();
    const {
      m_pill_text,
      m_heading,
      m_description,
      m_news_pill_text,
      m_news_heading,
      m_cards,
    } = req.body;

    const parsedCards = parseCards(m_cards);
    const existingCards = doc.m_cards || [];

    const nextCards = [0, 1, 2].map((i) => {
      const incoming = parsedCards[i] || {};
      const existing = existingCards[i] || {};
      const uploadedFile = req.files?.[`card_image_${i}`]?.[0]
        ? extractUploadedFile(req.files[`card_image_${i}`][0])
        : null;

      if (uploadedFile?.public_id) uploadedFiles.push(uploadedFile.public_id);

      return {
        title:
          incoming.title !== undefined
            ? String(incoming.title).trim()
            : existing.title || "",
        link:
          incoming.link !== undefined
            ? String(incoming.link).trim()
            : existing.link || "",
        image: uploadedFile ? uploadedFile.url : existing.image || "",
        image_public_id: uploadedFile
          ? uploadedFile.public_id
          : existing.image_public_id || "",
      };
    });

    if (m_pill_text !== undefined) doc.m_pill_text = m_pill_text.trim();
    if (m_heading !== undefined) doc.m_heading = m_heading.trim();
    if (m_description !== undefined)
      doc.m_description = m_description.trim();
    if (m_news_pill_text !== undefined)
      doc.m_news_pill_text = m_news_pill_text.trim();
    if (m_news_heading !== undefined)
      doc.m_news_heading = m_news_heading.trim();
    doc.m_cards = nextCards;

    await doc.save();

    // Delete any images that just got replaced, now that the save succeeded.
    for (let i = 0; i < 3; i++) {
      const uploadedFile = req.files?.[`card_image_${i}`]?.[0];
      const oldPublicId = existingCards[i]?.image_public_id;
      if (uploadedFile && oldPublicId) {
        try {
          await deleteFile(oldPublicId);
        } catch (err) {
          console.error("Old card image delete failed:", err.message);
        }
      }
    }

    return res.json({ status: true, message: "Updated", data: shape(doc) });
  } catch (err) {
    for (const publicId of uploadedFiles) {
      try {
        await deleteFile(publicId);
      } catch {
        // best-effort rollback
      }
    }
    console.error("updateWhoWeAre error:", err.message);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

module.exports = { getWhoWeAre, updateWhoWeAre };
