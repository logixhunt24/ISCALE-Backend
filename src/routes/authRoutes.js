const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const {
  resetPasswordMiddleware,
} = require("../middlewares/resetPasswordMiddleware");

const { registerMiddleware } = require("../middlewares/registrationMiddleware");

router.post("/login", authController.login);
router.post("/login-contact-password", authController.loginWithPassword);

// Country gate for LoginPage.jsx: decides whether to show the phone/OTP
// flow or a Google-only screen. Public, no auth (used pre-login).
router.get("/detect-country", authController.detectCountry);

// OTP login for existing accounts only (the iScale mobile app) - no
// self-registration path, see loginSendOtp/loginVerifyOtp for why this is
// kept separate from the send-otp/verify-otp pair below.
router.post("/login-send-otp", authController.loginSendOtp);
router.post("/login-verify-otp", authController.loginVerifyOtp);






// //login+register
// router.post("/send-otp", authController.sendOtp);

// router.post("/verify-otp", authController.verifyOtp);

// router.post("/register", registerMiddleware, authController.register);



router.post("/send-otp", authController.checkMobile);

router.post("/resend-otp", authController.resendOtp);

router.post("/verify-otp", authController.verifyOtp);

router.post("/register", registerMiddleware, authController.register);

router.post("/create-password",registerMiddleware, authController.createPassword);





















// Android app registration & password reset (no JWT required)
router.post("/app-signup", authController.appSignup);
router.post("/app-reset-password", authController.appResetPassword);

// Forget Password
router.post("/send-forgot-password-otp", authController.sendForgotPasswordOtp);

router.post(
  "/verify-forgot-password-otp",
  authController.verifyForgotPasswordOtp,
);

router.post(
  "/reset-password",
  resetPasswordMiddleware,
  authController.resetPassword,
);

module.exports = router;
