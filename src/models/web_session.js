const mongoose = require("mongoose");

// The one active website session per student. Logging in on a new browser
// replaces the stored session id, which invalidates the older browser's token
// (see authMiddleware). Mobile app tokens carry no session id and are unaffected.
const webSessionSchema = new mongoose.Schema(
  {
    user_id: { type: String, required: true, unique: true, index: true },
    session_id: { type: String, required: true },
    user_agent: { type: String, default: "" },
    ip: { type: String, default: "" },
    last_login: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

module.exports = mongoose.model("web_session", webSessionSchema);
