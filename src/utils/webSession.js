const crypto = require("crypto");
const WebSession = require("../models/web_session");

// Sent by the website on every request; the mobile apps do not send it.
const isWebClient = (req) =>
  String(req?.headers?.["x-client-platform"] || "").toLowerCase() === "web";

// userId -> { sid, at }  — keeps the per-request check off the database.
const CACHE_MS = 15 * 1000;
const cache = new Map();

const remember = (userId, sid) => cache.set(String(userId), { sid, at: Date.now() });

// Starts a new website session for the user and returns its id, replacing any previous one.
const startWebSession = async (userId, req) => {
  const sid = crypto.randomUUID();
  await WebSession.findOneAndUpdate(
    { user_id: String(userId) },
    {
      session_id: sid,
      user_agent: String(req?.headers?.["user-agent"] || "").slice(0, 255),
      ip: String(req?.headers?.["x-forwarded-for"] || req?.ip || "").split(",")[0].trim().slice(0, 64),
      last_login: new Date(),
    },
    { upsert: true, new: true },
  );
  remember(userId, sid);
  return sid;
};

// Is `sid` still the user's current website session?
const isCurrentWebSession = async (userId, sid) => {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.sid === sid;

  const row = await WebSession.findOne({ user_id: key }).select("session_id").lean();

  if (!row) {
    // No record (e.g. the write after login was lost): adopt this token instead of locking the student out.
    await WebSession.updateOne({ user_id: key }, { $setOnInsert: { session_id: sid, last_login: new Date() } }, { upsert: true });
    remember(key, sid);
    return true;
  }

  remember(key, row.session_id);
  return row.session_id === sid;
};

module.exports = { isWebClient, startWebSession, isCurrentWebSession };
