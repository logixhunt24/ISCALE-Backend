const jwt = require("jsonwebtoken");
const { isWebClient, startWebSession } = require("./webSession");

// ===============================
// GENERATE JWT TOKEN
// ===============================
const generateTokenAdmin = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      email: admin.kh_admin_email,
      contact: admin.kh_admin_phone,
      role: admin.kh_role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "60d" }
  );
};

const generateTokenUser = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.c_email,
      contact: user.c_contact,
      role: 2
    },
    process.env.JWT_SECRET,
    { expiresIn: "60d" }
  );
};

// Use this at login. Website logins (X-Client-Platform: web, or forceWeb for the
// browser-redirect Google flow) become the student's single active session; any
// other client (the mobile apps) gets a plain token exactly as before.
const issueUserToken = async (user, req, { forceWeb = false } = {}) => {
  if (!forceWeb && !isWebClient(req)) return generateTokenUser(user);

  const sid = await startWebSession(user._id, req);
  return jwt.sign(
    {
      id: user._id,
      email: user.c_email,
      contact: user.c_contact,
      role: 2,
      sid,
    },
    process.env.JWT_SECRET,
    { expiresIn: "60d" }
  );
};

const generateResetToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      mobile: user.c_contact,
      type: "password_reset",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "5m",
    }
  );
};

const generateRegisterToken = (mobile) => {
  return jwt.sign(
    {
      mobile,
      type: "register",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "10m",
    }
  );
};

const generateEmailChangeToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      type: "email_change",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    }
  );
};

module.exports = {
  generateTokenAdmin,
  generateTokenUser,
  issueUserToken,
  generateResetToken,
  generateRegisterToken,
  generateEmailChangeToken,
};