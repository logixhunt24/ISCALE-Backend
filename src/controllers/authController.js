const Candidate = require("../models/candidates");
const Enrollment = require("../models/course_enrollment");
const { toPublicUrl } = require("../utils/imageUrl");
// const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { generateTokenUser } = require("../utils/token");
// const Candidate = require("../models/candidate");
const sendSms = require("../utils/sendSms");
const sendEmail = require("../utils/sendEmail");
const generateCandidateIdno = require("../utils/generateCandidateIdno");
const { generateResetToken, generateRegisterToken } = require("../utils/token");
const validator = require("validator");
const axios = require("axios");
// const bcrypt = require("bcrypt");

// c_contact is declared as String in the schema, but this app has clearly
// evolved over time and some existing candidates - anything created before
// a schema change, or via a write path that bypassed Mongoose's
// cast-on-save (a migration/raw insert) - may have it stored as a raw
// BSON Number instead. A query cast to only one of the two types then
// silently never matches those records (MongoDB equality is type-
// sensitive), which is indistinguishable from "no account exists" -
// causing an existing number to be treated as brand-new at the "check
// mobile" step, or a deactivated/non-LMS account's OTP-gate check to
// silently no-op because the account it should have matched was never
// found in the first place. Match both representations defensively
// instead of relying on whichever the record actually has.
const contactQuery = (mobile) => ({
  $or: [{ c_contact: String(mobile) }, { c_contact: Number(mobile) }],
});

// LoginPage.jsx calls this before showing the phone-vs-Google choice: India
// (or an undetectable IP - localhost, private ranges, lookup failure) gets
// the phone/OTP flow; anywhere else gets Google-only.
//
// Uses a free external IP-geolocation lookup (ipwho.is, no key required)
// rather than a bundled local IP database (e.g. geoip-lite) - those ship a
// 150MB+ data file, which is a real risk on the shared hosting this app
// deploys to. One extra outbound call per anonymous page load is an
// acceptable tradeoff; any failure/timeout falls back to the safe default.
exports.detectCountry = async (req, res) => {
  try {
    // req.ip respects `trust proxy` (set in server.js) to read the real
    // client IP from X-Forwarded-For behind the CDN, rather than the proxy's.
    let ip = req.ip || "";
    if (ip.startsWith("::ffff:")) ip = ip.slice(7); // IPv4-mapped IPv6

    // Private/local IPs (dev, or a misconfigured proxy) can't be
    // geolocated - fall straight through to the null/default response.
    const isPrivate =
      !ip ||
      ip === "127.0.0.1" ||
      ip === "::1" ||
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

    if (isPrivate) {
      return res.status(200).json({ status: true, country: null });
    }

    const response = await axios.get(`https://ipwho.is/${ip}`, {
      timeout: 3000,
    });

    const country =
      response.data?.success !== false
        ? response.data?.country_code || null
        : null;

    return res.status(200).json({
      status: true,
      country,
    });
  } catch (error) {
    return res.status(200).json({
      status: true,
      country: null,
    });
  }
};

// Every newly registered candidate gets auto-enrolled in this free course
// so there's something to see on first login instead of an empty
// dashboard - "Free Data Analytics Course".
const DEFAULT_FREE_COURSE_ID = "6a71aae9e184696405bfffe4";

// Best-effort: a brand-new account should not fail to register just
// because the demo-course auto-enroll hit an issue (e.g. that course was
// deleted). Silently skip on any error.
const enrollInDefaultCourse = async (userId) => {
  try {
    const alreadyEnrolled = await Enrollment.findOne({
      user_id: userId,
      course_id: DEFAULT_FREE_COURSE_ID,
    });
    if (alreadyEnrolled) return;

    await Enrollment.create({
      user_id: userId,
      course_id: DEFAULT_FREE_COURSE_ID,
      course_type: 1,
      payment_status: 1,
      amount: 0,
      access_type: "lifetime",
      status: 1,
    });
  } catch (error) {
    console.error("Default course auto-enroll failed:", error.message);
  }
};

// Best-effort: registration should not fail just because the welcome
// email couldn't be sent. Never log the plaintext password.
const sendPasswordEmail = async (email, password) => {
  if (!email) return;

  try {
    await sendEmail({
      to: email,
      subject: "Your account password - The iScale",
      text: `Welcome to The iScale! Your account password is: ${password}\n\nPlease keep it safe and change it after logging in if you'd like.`,
    });
  } catch (error) {
    console.log("Failed to send password email:", error.message);
  }
};

// //  LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        status: false,
        message: "Email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        status: false,
        message: "Password is required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: false,
        message: "Please enter a valid email address",
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        status: false,
        message:
          "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.",
      });
    }

    const user = await Candidate.findOne({ c_email: email.toLowerCase() });

    if (!user) {
      return res.status(400).send({
        status: false,
        message: "User not found",
      });
    }

    //  bcrypt compare
    const isMatch = await bcrypt.compare(password, user.c_password);

    if (!isMatch) {
      return res.status(400).send({
        status: false,
        message: "Invalid password",
      });
    }

    // Generate token for user
    const token = generateTokenUser(user);

    res.status(200).send({
      status: true,
      message: "Login successful",
      token: token,
    });
  } catch (e) {
    console.log(e);
    res.status(500).send({
      status: false,
      message: e.message,
    });
  }
};

exports.loginWithPassword = async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        status: false,
        message: "Mobile and Password are required",
      });
    }

    if (mobile.length !== 10) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be 10 digits",
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        status: false,
        message:
          "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.",
      });
    }

    const user = await Candidate.findOne(contactQuery(mobile));

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Password exists?
    if (!user.c_password) {
      return res.status(400).json({
        status: false,
        message: "Password not created",
        isPass: 0,
      });
    }

    const isMatch = await bcrypt.compare(password, user.c_password);

    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: "Invalid password",
      });
    }

    const token = generateTokenUser(user);

    return res.status(200).json({
      status: true,
      response: "success",
      message: "Login successful",
      token,
      user: [
        {
          user_id: String(user._id),
          user_name: user.c_display_name || user.c_first_name || "",
          user_contact: String(user.c_contact),
          user_email: user.c_email || "",
          user_gender: user.c_gender || "",
          c_profile_image: toPublicUrl(user.c_profile_image),
        },
      ],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ======================================
// OTP LOGIN (existing accounts only - the iScale mobile app)
// ======================================
// Unlike checkMobile/verifyOtp above (registration flow: creates a
// temp candidate for a brand-new number), these two only ever act on an
// account that already exists and has already completed registration
// (has a name) - the mobile app has no self-registration, so a number
// with no matching account, or a temp/incomplete one, is rejected outright
// instead of silently creating something.
exports.loginSendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || String(mobile).length !== 10) {
      return res.status(400).json({
        status: false,
        message: "A valid 10-digit mobile number is required",
      });
    }

    const user = await Candidate.findOne(contactQuery(mobile));

    if (!user || !user.c_first_name) {
      return res.status(404).json({
        status: false,
        message: "No account found for this number",
      });
    }

    // theIscale mobile app is LMS-only: only accounts actively registered
    // for LMS (is_lms_student === 1) can log in - covers both accounts
    // never added to LMS (undefined) and ones explicitly removed (0).
    if (user.is_lms_student !== 1) {
      return res.status(403).json({
        status: false,
        message: "This account is not registered for LMS access",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.c_user_otp = otp;
    user.c_otp_expiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // Must match the DLT-registered template text for this ID exactly
    // (word-for-word, only the OTP varies) - a different wording under the
    // same template ID gets silently dropped by the carrier even though
    // MSG91's API reports success, which is why this needs to be identical
    // to the OTP message used everywhere else for this same DLT_TE_ID.
    const message = `${otp} is the OTP to authenticate login credential. Do not share with anyone. - The iScale`;
    await sendSms(message, mobile, "1307173398514201568");

    return res.status(200).json({
      status: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.loginVerifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({
        status: false,
        message: "Mobile number and OTP are required",
      });
    }

    const user = await Candidate.findOne(contactQuery(mobile));

    if (!user || !user.c_first_name) {
      return res.status(404).json({
        status: false,
        message: "No account found for this number",
      });
    }

    if (user.is_lms_student !== 1) {
      return res.status(403).json({
        status: false,
        message: "This account is not registered for LMS access",
      });
    }

    if (!user.c_user_otp || user.c_user_otp !== otp) {
      return res.status(400).json({
        status: false,
        message: "Invalid OTP",
      });
    }

    if (!user.c_otp_expiry || user.c_otp_expiry < new Date()) {
      return res.status(400).json({
        status: false,
        message: "OTP expired",
      });
    }

    user.c_user_otp = null;
    user.c_otp_expiry = null;
    await user.save();

    const token = generateTokenUser(user);

    // Return user as array with Android-compatible field names
    return res.status(200).json({
      status: true,
      response: "success",
      message: "OTP verified successfully",
      token,
      user: [
        {
          user_id: String(user._id),
          user_name: user.c_display_name || user.c_first_name || "",
          user_contact: String(user.c_contact),
          user_email: user.c_email || "",
          user_gender: user.c_gender || "",
          c_profile_image: toPublicUrl(user.c_profile_image),
        },
      ],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.checkMobile = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        status: false,
        message: "Mobile number is required",
      });
    }

    if (mobile.length !== 10) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be 10 digits",
      });
    }

    const user = await Candidate.findOne(contactQuery(mobile));

    // ==========================
    // NEW USER
    // ==========================
    if (!user) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      const tempUser = await Candidate.create({
        c_contact: Number(mobile),
        c_user_otp: otp,
        c_otp_expiry: new Date(Date.now() + 5 * 60 * 1000),
        c_register_date: new Date(),
      });

      const message = `${otp} is the OTP to authenticate login credential. Do not share with anyone. - The iScale`;

      await sendSms(message, mobile, "1307173398514201568");

      return res.status(200).json({
        status: true,
        isNew: 1,
        message: "OTP sent successfully",
      });
    }

    // ==========================
    // EXISTING USER
    // ==========================

    return res.status(200).json({
      status: true,
      isNew: 0,
      isPass: user.c_password ? 1 : 0,
      message: user.c_password ? "Login with password" : "Create password",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile) {
      return res.status(400).json({
        status: false,
        message: "Mobile number is required",
      });
    }

    if (mobile.length !== 10) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be 10 digits",
      });
    }

    const user = await Candidate.findOne(contactQuery(mobile));

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    if (user.c_user_otp !== otp) {
      return res.status(400).json({
        status: false,
        message: "Invalid OTP",
      });
    }

    if (!user.c_otp_expiry || user.c_otp_expiry < new Date()) {
      return res.status(400).json({
        status: false,
        message: "OTP expired",
      });
    }

    user.c_user_otp = null;
    user.c_otp_expiry = null;

    await user.save();

    const registerToken = generateRegisterToken(mobile);

    return res.status(200).json({
      status: true,
      message: "OTP Verified",
      registerToken,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({
        status: false,
        message: "Mobile number required",
      });
    }

    let user = await Candidate.findOne(contactQuery(mobile));

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Existing User
    if (user) {
      user.c_user_otp = otp;
      user.c_otp_expiry = new Date(Date.now() + 5 * 60 * 1000);

      await user.save();
    }

    // New User
    else {
      user = await Candidate.create({
        c_contact: mobile,
        c_user_otp: otp,
        c_otp_expiry: new Date(Date.now() + 5 * 60 * 1000),
        c_register_date: new Date(),
      });
    }

    const message = `${otp} is the OTP to authenticate login credential. Do not share with anyone. - The iScale`;

    await sendSms(message, mobile, "1307173398514201568");

    return res.status(200).json({
      status: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// exports.verifyOtp = async (req, res) => {
//   try {
//     const { mobile, otp } = req.body;

//     const user = await Candidate.findOne({
//       c_contact: mobile,
//     });

//     if (!user) {
//       return res.status(404).json({
//         status: false,
//         message: "User not found",
//       });
//     }

//     if (user.c_user_otp !== otp) {
//       return res.status(400).json({
//         status: false,
//         message: "Invalid OTP",
//       });
//     }

//     if (!user.c_otp_expiry || user.c_otp_expiry < new Date()) {
//       return res.status(400).json({
//         status: false,
//         message: "OTP expired",
//       });
//     }

//     // OTP clear
//     user.c_user_otp = null;
//     user.c_otp_expiry = null;

//     await user.save();

//     // Existing Registered User
//     if (user.c_first_name && user.c_email && user.c_password) {
//       const token = generateTokenUser(user);

//       return res.status(200).json({
//         status: true,
//         action: "login",
//         message: "Login successful",
//         token,
//       });
//     }

//     // New User
//     const registerToken = generateRegisterToken(mobile);

//     return res.status(200).json({
//       status: true,
//       action: "register",
//       message: "Complete registration",
//       registerToken,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       status: false,
//       message: error.message,
//     });
//   }
// };

exports.register = async (req, res) => {
  try {
    const { fname, lname, email, password, whatsapp, gender } = req.body;

    const mobile = req.registerUser.mobile;

    if (!fname || !lname || !email || !password || !whatsapp) {
      return res.status(400).json({
        status: false,
        message: "All fields are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: false,
        message: "Please enter a valid email address",
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        status: false,
        message:
          "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.",
      });
    }

    if (whatsapp.length !== 10) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be 10 digits",
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        status: false,
        message: "Enter the email in the correct format.",
      });
    }

    if (String(whatsapp).length !== 10) {
      return res.status(400).json({
        status: false,
        message: "The WhatsApp number must be 10 digits long.",
      });
    }

    // Mobile se temporary user find karo
    const user = await Candidate.findOne(contactQuery(mobile));

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Already registered check
    if (user.c_first_name) {
      return res.status(400).json({
        status: false,
        message: "User already registered",
      });
    }

    // Email duplicate check
    const existingEmail = await Candidate.findOne({
      c_email: email.toLowerCase(),
    });

    if (existingEmail) {
      return res.status(400).json({
        status: false,
        message: "Email already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Update User
    user.c_first_name = fname;
    user.c_last_name = lname;
    user.c_display_name = fname;

    user.c_email = email.toLowerCase();

    user.c_password = hashedPassword;

    user.c_whatsapp = whatsapp;

    if (gender) {
      user.c_gender = gender;
    }

    user.c_mobile_verified = 1;
    user.c_user_status = 1;
    user.c_email_verified = 0;

    const joinDate = new Date();

    user.c_register_date = joinDate;
    user.candidate_idno = await generateCandidateIdno(joinDate);

    await user.save();

    await enrollInDefaultCourse(user._id);

    await sendPasswordEmail(user.c_email, password);

    // Direct Login Token
    const token = generateTokenUser(user);

    return res.status(201).json({
      status: true,
      message: "Registration successful",
      token,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.createPassword = async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        status: false,
        message: "Mobile and Password are required",
      });
    }

    if (mobile.length !== 10) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be 10 digits",
      });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        status: false,
        message:
          "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.",
      });
    }

    const user = await Candidate.findOne(contactQuery(mobile));

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    if (user.c_password) {
      return res.status(400).json({
        status: false,
        message: "Password already exists",
      });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    user.c_password = hashPassword;
    user.c_password_update = 1;
    user.c_mobile_verified = 1;
    user.c_user_status = 1;

    await user.save();

    await sendPasswordEmail(user.c_email, password);

    const token = generateTokenUser(user);

    return res.status(200).json({
      status: true,
      message: "Password created successfully",
      token,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Forget password
exports.sendForgotPasswordOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (mobile.length !== 10) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be 10 digits",
      });
    }

    const user = await Candidate.findOne(contactQuery(mobile));

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.c_user_otp = otp;

    user.c_otp_expiry = new Date(Date.now() + 5 * 60 * 1000);

    await user.save();

    // const message =
    //   `${otp} is the OTP to reset your password. Do not share with anyone. - The iScale`;

    const message = `${otp} is the OTP to authenticate login credential. Do not share with anyone. - The iScale`;

    await sendSms(message, mobile, "1307173398514201568");

    // console.log("SMS RESPONSE =>", smsResponse);

    return res.status(200).json({
      status: true,
      message: "OTP sent successfully for forget passsword",
      // smsResponse,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (mobile.length !== 10) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be 10 digits",
      });
    }

    const user = await Candidate.findOne(contactQuery(mobile));

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    if (user.c_user_otp !== otp) {
      return res.status(400).json({
        status: false,
        message: "Invalid OTP",
      });
    }

    if (!user.c_otp_expiry || user.c_otp_expiry < new Date()) {
      return res.status(400).json({
        status: false,
        message: "OTP expired",
      });
    }

    // OTP verified ho gaya
    user.c_user_otp = null;
    user.c_otp_expiry = null;

    await user.save();

    const resetToken = generateResetToken(user);

    return res.status(200).json({
      status: true,
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { password, confirm_password } = req.body;

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        status: false,
        message:
          "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one special character.",
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        status: false,
        message: "Password and Confirm Password do not match",
      });
    }

    const user = await Candidate.findById(req.resetUser.id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user.c_password = hashedPassword;

    user.c_password_update = 1;

    user.c_user_otp = null;
    user.c_otp_expiry = null;

    await user.save();

    return res.status(200).json({
      status: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ── Android app registration ──────────────────────────────────────────────────
// Single-step signup: collects all user details, creates the account, and
// sends OTP in one call. The Android RegistrationActivity calls this before
// the OTP screen so the user fills details first, then verifies their number.
exports.appSignup = async (req, res) => {
  try {
    const { c_name, mobile, email, whatsapp, gender } = req.body;

    if (!c_name || !mobile || !email || !whatsapp) {
      return res.status(400).json({
        status: false,
        message: "Name, mobile, email and whatsapp are required",
      });
    }

    if (String(mobile).length !== 10) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be 10 digits",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: false,
        message: "Please enter a valid email address",
      });
    }

    // Check for duplicate mobile
    const existing = await Candidate.findOne(contactQuery(mobile));
    if (existing && existing.c_first_name) {
      return res.status(400).json({
        status: false,
        message: "Mobile number is already registered",
      });
    }

    // Check for duplicate email
    const emailExists = await Candidate.findOne({ c_email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({
        status: false,
        message: "Email is already registered",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    let user;
    if (existing) {
      // Temp record already created by a prior send-otp call — update it
      existing.c_first_name = c_name;
      existing.c_display_name = c_name;
      existing.c_email = email.toLowerCase();
      existing.c_whatsapp = whatsapp;
      if (gender) existing.c_gender = gender;
      existing.is_lms_student = 1;
      existing.c_user_otp = otp;
      existing.c_otp_expiry = otpExpiry;
      await existing.save();
      user = existing;
    } else {
      user = await Candidate.create({
        c_contact: String(mobile),
        c_first_name: c_name,
        c_display_name: c_name,
        c_email: email.toLowerCase(),
        c_whatsapp: String(whatsapp),
        c_gender: gender || "",
        is_lms_student: 1,
        c_user_otp: otp,
        c_otp_expiry: otpExpiry,
        c_register_date: new Date(),
        c_user_status: 1,
        c_mobile_verified: 0,
      });
    }

    const message = `${otp} is the OTP to authenticate login credential. Do not share with anyone. - The iScale`;
    await sendSms(message, String(mobile), "1307173398514201568");

    return res.status(200).json({
      status: true,
      response: "success",
      message: "OTP sent successfully",
      user: [
        {
          user_id: String(user._id),
          user_name: user.c_display_name || c_name,
          user_contact: String(user.c_contact),
          user_email: user.c_email || email,
          user_gender: user.c_gender || gender || "",
        },
      ],
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ── Android app password reset ────────────────────────────────────────────────
// Called by UpdatePasswordActivity after OTP verification, for both:
//   SET=0  new-user first-time password creation
//   SET=1  forgot-password reset (no current password available)
// No JWT required — OTP verification already proved ownership of the number.
exports.appResetPassword = async (req, res) => {
  try {
    const { mobile, newPassword, confirmPassword } = req.body;

    if (!mobile || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "Mobile, new password and confirm password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        status: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "Passwords do not match",
      });
    }

    const user = await Candidate.findOne(contactQuery(mobile));
    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.c_password = hashedPassword;
    user.c_password_update = 1;
    user.c_mobile_verified = 1;
    user.c_user_status = 1;
    await user.save();

    const token = generateTokenUser(user);

    return res.status(200).json({
      status: true,
      response: "success",
      message: "Password set successfully",
      token,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};
