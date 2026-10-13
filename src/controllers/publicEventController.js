const mongoose = require("mongoose");

const Event = require("../models/event");
const EventEnrollment = require("../models/event_enrollment");
const Team = require("../models/our_teams");
const { toPublicUrl } = require("../utils/imageUrl");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Public events never expose the meeting link (only enrolled students get it)
// and never include inactive/draft events.
const PUBLIC_SELECT = "-m_event_link";

const shapeEvent = (e) => ({
  _id: e._id,
  m_event_title: e.m_event_title,
  m_event_slug: e.m_event_slug,
  m_event_category: e.m_event_category,
  m_event_banner: toPublicUrl(e.m_event_banner),
  m_event_date_start: e.m_event_date_start,
  m_event_date_end: e.m_event_date_end,
  m_event_time_start: e.m_event_time_start,
  m_event_time_end: e.m_event_time_end,
  m_event_skill_level: e.m_event_skill_level,
  m_event_certificate: e.m_event_certificate,
  m_event_lang: e.m_event_lang,
  m_event_host: e.m_event_host,
  m_event_url: e.m_event_url,
  m_event_contact_no: e.m_event_contact_no,
  m_event_whatsapp_no: e.m_event_whatsapp_no,
  m_event_desc: e.m_event_desc,
  m_event_file: toPublicUrl(e.m_event_file),
  m_event_no_of_enroll: e.m_event_no_of_enroll || 0,
});

// GET /event/public-get-events?search=&category=&page=&limit=
const getPublicEvents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const filter = { m_event_status: 1 };

    if (req.query.search) {
      const k = escapeRegex(req.query.search);
      filter.$or = [
        { m_event_title: { $regex: k, $options: "i" } },
        { m_event_host: { $regex: k, $options: "i" } },
      ];
    }
    if (req.query.category) {
      if (!mongoose.Types.ObjectId.isValid(req.query.category)) {
        return res.status(400).json({ status: false, message: "Invalid category" });
      }
      filter.m_event_category = req.query.category;
    }

    const [total, events] = await Promise.all([
      Event.countDocuments(filter),
      Event.find(filter)
        .select(PUBLIC_SELECT)
        .populate("m_event_category", "m_ec_title")
        .sort({ m_event_date_start: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      status: true,
      message: "Events fetched successfully",
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      data: events.map((e) => ({ ...shapeEvent(e), m_event_category: e.m_event_category })),
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// GET /event/public-event/:slug  — details, host card and similar events
const getPublicEventBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const event = await Event.findOne({ m_event_slug: slug, m_event_status: 1 })
      .select(PUBLIC_SELECT)
      .populate("m_event_category", "m_ec_title m_ec_slug")
      .lean();

    if (!event) {
      return res.status(404).json({ status: false, message: "Event not found" });
    }

    // the host is stored as free text; show a profile card when it matches a team member
    let host = null;
    if (event.m_event_host && event.m_event_host.trim()) {
      const member = await Team.findOne({
        member_name: { $regex: `^${escapeRegex(event.m_event_host.trim())}$`, $options: "i" },
        member_status: 1,
      })
        .select("member_name member_position member_image member_expertise member_experience member_linkedin member_bio")
        .lean();

      if (member) {
        host = {
          name: member.member_name,
          position: member.member_position || "",
          image: toPublicUrl(member.member_image),
          expertise: member.member_expertise || "",
          experience: member.member_experience || "",
          linkedin: member.member_linkedin || "",
          bio: member.member_bio || "",
        };
      }
    }

    const similarFilter = { _id: { $ne: event._id }, m_event_status: 1 };
    if (event.m_event_category?._id) similarFilter.m_event_category = event.m_event_category._id;

    const similar = await Event.find(similarFilter)
      .select("m_event_title m_event_slug m_event_banner m_event_date_start m_event_time_start m_event_time_end")
      .sort({ m_event_date_start: -1 })
      .limit(3)
      .lean();

    return res.json({
      status: true,
      data: {
        ...shapeEvent(event),
        m_event_category: event.m_event_category,
        host_name: event.m_event_host || "",
        host,
        similar: similar.map((s) => ({
          _id: s._id,
          m_event_title: s.m_event_title,
          m_event_slug: s.m_event_slug,
          m_event_banner: toPublicUrl(s.m_event_banner),
          m_event_date_start: s.m_event_date_start,
          m_event_time_start: s.m_event_time_start,
          m_event_time_end: s.m_event_time_end,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

// GET /enrolled-events/status/:event_id  (logged in)
// The meeting link is only handed to students who are enrolled.
const getEventEnrollmentStatus = async (req, res) => {
  try {
    const { event_id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(event_id)) {
      return res.status(400).json({ status: false, message: "Invalid event id" });
    }

    const enrolled = await EventEnrollment.exists({ user_id: req.user.id, event_id });
    let join_link = "";
    if (enrolled) {
      const event = await Event.findOne({ _id: event_id, m_event_status: 1 }).select("m_event_link").lean();
      join_link = event?.m_event_link || "";
    }

    return res.json({ status: true, enrolled: !!enrolled, join_link });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = { getPublicEvents, getPublicEventBySlug, getEventEnrollmentStatus };
