// A student the admin has deactivated keeps their record (for logs) but can no
// longer log in or use the apps. This is the c_deactivated flag, set only by the
// admin's Deactivate button. c_user_status alone can't be used: new sign-ups also
// start at 0 until they finish registering.
const Candidate = require("../models/candidates");

const DEACTIVATED_MESSAGE = "Your account has been deactivated. Please contact support.";

// Replies 403 and returns true when the user is deactivated (caller should `return`).
const denyIfDeactivated = (user, res) => {
  if (!user || !user.c_deactivated) return false;
  res.status(403).json({
    status: false,
    code: "ACCOUNT_DEACTIVATED",
    message: DEACTIVATED_MESSAGE,
  });
  return true;
};

// Per-request check for tokens that are already issued. Cached briefly so it
// doesn't add a database read to every request.
const CACHE_MS = 15 * 1000;
const cache = new Map(); // userId -> { deactivated, at }

const isUserDeactivated = async (userId) => {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.deactivated;

  try {
    const row = await Candidate.findById(key).select("c_deactivated").lean();
    const deactivated = Boolean(row?.c_deactivated);
    cache.set(key, { deactivated, at: Date.now() });
    return deactivated;
  } catch (err) {
    // shortcut: fail open on a database error, so an outage never locks every student out
    return false;
  }
};

// Call after the admin changes a user so the change applies immediately
const forgetUser = (userId) => cache.delete(String(userId));

module.exports = { DEACTIVATED_MESSAGE, denyIfDeactivated, isUserDeactivated, forgetUser };
