const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
  // c_id: {
  //   type: Number,
  //   required: true,
  //   auto: true
  // },

  // Format: YYMMNNNN - YY/MM from the joining (registration) date,
  // NNNN a per-month sequence from 0115-9999. See utils/generateCandidateIdno.
  candidate_idno: { type: String, unique: true, sparse: true, index: true },

  c_register_date: { type: Date },

  c_first_name: { type: String, index: true },
  c_last_name: { type: String },
  c_display_name: { type: String },

  c_email: { type: String, unique: true, sparse: true, index: true },

  c_password: { type: String },
  c_password_update: {
    type: Number,
    enum: [0, 1], // 0=no, 1=yes
    default: 0,
  },

  //   c_role: {
  //   type: String,
  //   enum: ["user", "admin"],
  //   default: "user"
  // },

  c_current_state: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "state",
    default: null,
    set: (value) => {
      return value === "NA" || value === "" ? null : value;
    },
  },

  c_current_city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "city",
    default: null,
    set: (value) => {
      return value === "NA" || value === "" ? null : value;
    },
  },

  c_user_refer_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "app_admin",
    default: null,
    set: (value) => {
      return value === "NA" || value === "" ? null : value;
    },
  },

  // String, not Number: international numbers need a leading "+" and
  // country code, which a Number type can't represent (also loses
  // leading zeros). The Indian OTP-login flow still enforces its own
  // 10-digit check in authController; this field just stores whatever
  // format the account actually used to sign up/add a number.
  c_contact: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    index: true,
  },
  c_alt_contact: { type: Number, default: null },

  c_google_id: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  c_login_provider: {
    type: String,
    enum: ["mobile", "google"],
    default: "mobile",
  },

  c_fcm_id: { type: String, default: null },
  c_user_session_token: { type: String },

  c_user_otp: {
    type: String,
    default: null,
  },

  c_otp_expiry: {
    type: Date,
    default: null,
  },

  // Email-change flow (separate from mobile c_user_otp so the two flows
  // never clobber each other if run concurrently)
  c_email_otp: { type: String, default: null },
  c_email_otp_expiry: { type: Date, default: null },

  c_new_email: { type: String, default: null },
  c_new_email_otp: { type: String, default: null },
  c_new_email_otp_expiry: { type: Date, default: null },

  // Login gate (active/inactive), unrelated to c_mobile_verified/
  // c_email_verified/c_admin_verified, which drive the "Verified" badge.
  c_user_status: {
    type: Number,
    enum: [0, 1], // 0=inactive (can't log in), 1=active
    default: 0,
  },

  c_whatsapp: { type: Number, default: null },
  c_gender: { type: String, default: null },
  c_dob: { type: Date, default: null },
  c_age: { type: Number, default: null },

  c_bio: { type: String, default: null },
  m_occupation: { type: String, default: null },

  c_guardian: { type: String, default: null },
  c_guardian_relation: { type: String, default: null },

  c_current_address1: { type: String, default: null },
  c_current_address2: { type: String, default: null },

  c_current_country: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "countries",
    default: null,
  }, // type =string kar sakte hai
  // c_current_state: { type: String, default: null },
  // c_current_city: { type: String, default: null },

  // Plain-text location entered via the candidate app's offline
  // country-state-city dataset / pincode lookup. Kept separate from
  // c_current_country/state/city, which are ObjectId refs the admin
  // registration flow validates against the countries/state/city
  // master-data collections.
  c_current_country_name: { type: String, default: null },
  c_current_state_name: { type: String, default: null },
  c_current_city_name: { type: String, default: null },

  c_current_district: { type: String, default: null },
  c_current_area: { type: Number, default: null },
  c_current_pincode: { type: String, default: null }, // type = Number kar sakte hai

  c_permanent_address1: { type: String, default: null },
  c_permanent_address2: { type: String, default: null },
  c_permanent_state: { type: String, default: null },
  c_permanent_city: { type: String, default: null },
  c_permanent_pincode: { type: String, default: null },

  c_category: { type: String },

  c_governmentId_number: { type: String },
  c_pan_number: { type: String },

  c_idProof_image: { type: String },
  c_idProof_type: { type: String },

  c_profile_image: { type: String, default: null },
  c_profile_image_public_id: {
    type: String,
    default: null,
  },
  c_sign_image: { type: String, default: null },

  c_10schoolName: { type: String },
  c_10board: { type: String },
  c_10passingYear: { type: String },
  c_10percentage: { type: String },
  c_10division: { type: String },
  c_10grade: { type: String },
  c_10marksheet_image: { type: String },

  c_12schoolName: { type: String },
  c_12board: { type: String },
  c_12passingYear: { type: String },
  c_12percentage: { type: String },
  c_12division: { type: String },
  c_12grade: { type: String },
  c_12marksheet_image: { type: String },

  c_diploma_course: { type: Number },
  c_diploma_stream: { type: Number },
  c_diplomaName: { type: String },
  c_diplomaCollege: { type: String },
  c_diplomaUniversity: { type: String },
  c_diplomaPercentage: { type: String },
  c_diplomaPassing_year: { type: String },
  c_diplomaDivision: { type: String },
  c_diplomaGrade: { type: String },
  c_diploma_state: { type: Number },
  c_diploma_city: { type: Number },
  c_diplomaMarksheet_image: { type: String },

  c_graduationCourse: { type: String },
  c_graduation_stream: { type: Number },
  c_graduation_state: { type: Number },
  c_graduation_city: { type: Number },
  c_graduationCollege: { type: String },
  c_graduationUniversity: { type: String },
  c_graduationPercentage: { type: String },
  c_graduationPass_year: { type: String },
  c_graduationDivision: { type: String },
  c_graduationGrade: { type: String },
  c_graduationMarksheet_image: { type: String },

  c_pgCourse: { type: String },
  c_pgCollege: { type: String },
  c_pgStream: { type: Number },
  c_pgUniversity: { type: String },
  c_pgPercentage: { type: String },
  c_pgPass_year: { type: String },
  c_pgDivision: { type: String },
  c_pgGrade: { type: String },
  c_pg_city: { type: Number },
  c_pg_state: { type: Number },
  c_pgMarksheet_image: { type: String },

  c_admitcard_upload: { type: String },
  c_resume_upload: { type: String },

  c_domicile: { type: String },

  c_profile_updated: {
    type: Number,
    enum: [0, 1], // 0=no, 1=yes
  },
  c_eductional_updated: {
    type: Number,
    enum: [0, 1], // 0=no, 1=yes
  },
  c_professional_updated: {
    type: Number,
    enum: [0, 1], // 0=no, 1=yes
  },
  c_document_updated: {
    type: Number,
    enum: [0, 1], // 0=no, 1=yes
  },

  remember_token: { type: String },

  c_number1: { type: String },
  c_number2: { type: String },
  c_number3: { type: String },

  c_email1: { type: String },
  c_email2: { type: String },
  c_email3: { type: String },

  c_novisits: { type: Number },

  address_type: { type: Number },

  notify_date: { type: Date },

  is_subscribe: {
    type: Number,
    enum: [0, 1], // 0=no, 1=yes
  },
  subscription_end: { type: Date },
  next_apply_date: { type: Date },

  // the iScale mobile app (face-lock): one-time lifetime purchase flag,
  // unrelated to is_subscribe above (that field is currently unused).
  mobile_app_lifetime_access: { type: Boolean, default: false },

  // Admin LMS module (Users & Teams > LMS): the iScale mobile app is
  // LMS-only, so login (authController.loginSendOtp/loginVerifyOtp)
  // requires this to be exactly 1. undefined = never added to LMS, 0 =
  // explicitly removed ("deleted" from the LMS list) - both are blocked
  // the same way; only 1 (actively registered, shown in the LMS student
  // list) can log in.
  is_lms_student: { type: Number, enum: [0, 1] },

  // the iScale mobile app (face-lock): whether this account has an enrolled
  // face on file. The face itself is never stored here - it lives entirely
  // in MXFace's Identity API under this candidate's own _id as externalId
  // (see mobileFaceController.js) - a reinstall/new device can't be used to
  // register a second face and bypass the "one biometric identity" lock
  // since enrollment is rejected once this is already true.
  mobile_app_face_registered: { type: Boolean, default: false },

  c_user_parent: { type: String },
  m_parent_mobile: { type: Number },

  m_roll_number: { type: String },

  m_father_name: { type: String },
  m_mother_name: { type: String },
  m_f_occupation: { type: String },
  m_m_occupation: { type: String },

  m_blood_group: { type: String },

  c_adhar_no: { type: String },
  c_adhar_file: { type: String },

  c_pan_no: { type: String },
  c_pan_file: { type: String },

  c_upi_id: { type: String },

  c_mobile_verified: {
    type: Number,
    enum: [0, 1], //0=unvrified, 1=verified
    default: 0,
  },
  c_email_verified: {
    type: Number,
    enum: [0, 1], //0=unvrified, 1=verified
    default: 0,
  },
  // Manual admin override for the "Verified" badge - displayed verified
  // status is c_mobile_verified || c_email_verified || c_admin_verified.
  c_admin_verified: {
    type: Number,
    enum: [0, 1],
    default: 0,
  },

  c_assign_batch: { type: Number },
  // c_user_refer_by: { type: Number },

  c_user_referal_code: { type: String },
  c_user_refered_users: { type: Number },

  c_user_wallet_amount: { type: Number },
  c_user_wallet_added: { type: Number },
  c_user_wallet_winings: { type: Number },
});

module.exports = mongoose.model("candidates", candidateSchema);
