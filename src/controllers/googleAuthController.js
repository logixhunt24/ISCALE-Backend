const { OAuth2Client } = require("google-auth-library");
const Candidate = require("../models/candidates");
const { issueUserToken } = require("../utils/token");
const generateCandidateIdno = require("../utils/generateCandidateIdno");

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

const FRONTEND_URL = process.env.FRONTEND_URL || "https://theiscale.com";

// GET /auth/google
exports.googleLogin = (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });

  res.redirect(authUrl);
};

// GET /auth/google/callback
exports.googleCallback = async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(
      `${FRONTEND_URL}/auth/callback?status=failed&message=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return res.redirect(
      `${FRONTEND_URL}/auth/callback?status=failed&message=${encodeURIComponent(
        "Missing authorization code"
      )}`
    );
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email ? payload.email.toLowerCase() : null;

    if (!email) {
      return res.redirect(
        `${FRONTEND_URL}/auth/callback?status=failed&message=${encodeURIComponent(
          "Google account has no email"
        )}`
      );
    }

    // Match existing user by google id first, then by email (account linking)
    let user = await Candidate.findOne({ c_google_id: googleId });

    if (!user) {
      user = await Candidate.findOne({ c_email: email });
    }

    if (user) {
      const updates = {};

      if (!user.c_google_id) {
        updates.c_google_id = googleId;
      }
      if (!user.c_profile_image && payload.picture) {
        updates.c_profile_image = payload.picture;
      }
      if (!user.c_email_verified && payload.email_verified) {
        updates.c_email_verified = 1;
      }

      if (Object.keys(updates).length) {
        await Candidate.updateOne({ _id: user._id }, { $set: updates });
        Object.assign(user, updates);
      }
    } else {
      const displayName = payload.name || payload.given_name || "";
      const joinDate = new Date();

      user = await Candidate.create({
        candidate_idno: await generateCandidateIdno(joinDate),
        c_register_date: joinDate,
        c_first_name: payload.given_name || displayName,
        c_last_name: payload.family_name || "",
        c_display_name: displayName,
        c_email: email,
        c_email_verified: payload.email_verified ? 1 : 0,
        c_profile_image: payload.picture || null,
        c_google_id: googleId,
        c_login_provider: "google",
        c_user_status: 1,
      });
    }

    const token = await issueUserToken(user, req, { forceWeb: true });

    return res.redirect(
      `${FRONTEND_URL}/auth/callback?status=success&token=${encodeURIComponent(token)}`
    );
  } catch (err) {
    console.log("Google auth error", err);

    return res.redirect(
      `${FRONTEND_URL}/auth/callback?status=failed&message=${encodeURIComponent(
        "Google authentication failed"
      )}`
    );
  }
};
