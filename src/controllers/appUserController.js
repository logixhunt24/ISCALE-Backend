// controllers/candidateController.js

const Candidate = require("../models/candidates");
const State = require("../models/state");
const City = require("../models/city");
const Enrollment = require("../models/course_enrollment");
const Course = require("../models/course");
const generateCandidateIdno = require("../utils/generateCandidateIdno");
const { deleteEnrolledIdentity } = require("./mobileFaceController");

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// ======================================
// CHECK VALID VALUE
// ======================================

const isValidValue = (value) => {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    value !== "null" &&
    value !== "undefined"
  );
};

// ======================================
// GET ALL USERS
// ======================================

const getAllUsers = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 50,
      search = "",
      from_date,
      to_date,
      user_status,
      country,
      state,
      city,
      lms_only,
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = {};

    // ======================================
    // SEARCH
    // ======================================

    // if (isValidValue(search)) {
    //   filter.$or = [
    //     {
    //       c_display_name: {
    //         $regex: search,
    //         $options: "i",
    //       },
    //     },
    //     {
    //       c_email: {
    //         $regex: search,
    //         $options: "i",
    //       },
    //     },
    //     // {
    //     //   c_contact: {
    //     //     $regex: search,
    //     //     $options: "i",
    //     //   },
    //     // },
    //   ];
    // }

    if (isValidValue(search)) {
      filter.$or = [
        {
          c_display_name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          c_email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$c_contact" },
              regex: search,
            },
          },
        },
      ];
    }

    // ======================================
    // USER STATUS FILTER
    // ======================================

    if (isValidValue(user_status)) {
      filter.c_user_status = Number(user_status);
    }

    // ======================================
    // DATE FILTER
    // ======================================

    if (isValidValue(from_date) || isValidValue(to_date)) {
      filter.c_register_date = {};

      if (isValidValue(from_date)) {
        filter.c_register_date.$gte = new Date(from_date);
      }

      if (isValidValue(to_date)) {
        const toDate = new Date(to_date);
        toDate.setHours(23, 59, 59, 999);

        filter.c_register_date.$lte = toDate;
      }
    }

    // ======================================
    // LOCATION FILTER (plain-text country/state/city
    // entered via the candidate app's location picker)
    // ======================================

    if (isValidValue(country)) {
      filter.c_current_country_name = { $regex: `^${country}$`, $options: "i" };
    }

    if (isValidValue(state)) {
      filter.c_current_state_name = { $regex: `^${state}$`, $options: "i" };
    }

    if (isValidValue(city)) {
      filter.c_current_city_name = { $regex: `^${city}$`, $options: "i" };
    }

    // The LMS student list only shows accounts actively registered for it -
    // the general App Users page (no lms_only param) still shows everyone.
    if (isValidValue(lms_only) && Number(lms_only) === 1) {
      filter.is_lms_student = 1;
    }

    // ======================================
    // TOTAL
    // ======================================

    const total = await Candidate.countDocuments(filter);

    // ======================================
    // GET DATA
    // ======================================

    const users = await Candidate.find(filter)
      .select(
        `
        c_first_name
        c_last_name
        c_display_name
        c_email
        c_contact
        c_register_date
        c_user_status
        c_mobile_verified
        c_email_verified
        c_admin_verified
        c_current_country_name
        c_current_state_name
        c_current_city_name
        mobile_app_lifetime_access
        is_lms_student
      `,
      )
      // _id as the primary sort key (not c_register_date): it's never
      // missing and is inherently chronological, unlike c_register_date,
      // which older incomplete OTP-only signups never had set - sorting
      // by a field that can be null pushes those to the very end, past
      // any reasonable page limit once real user volume grows.
      .sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const usersWithVerification = users.map((u) => {
      const obj = u.toObject();

      obj.isVerified = Boolean(
        u.c_mobile_verified || u.c_email_verified || u.c_admin_verified,
      );

      return obj;
    });

    return res.status(200).json({
      status: true,
      message: "Users fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: usersWithVerification,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ======================================
// GET SINGLE USER
// ======================================

const getSingleUser = async (req, res) => {
  try {
    const { id } = req.params;

    // ======================================
    // VALIDATE ID
    // ======================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user id",
      });
    }

    // ======================================
    // FIND USER
    // ======================================

    const user = await Candidate.findById(id)
      .populate("c_current_state", "m_state_name")
      .populate("c_current_city", "m_city_city")
      .populate("c_user_refer_by", "kh_admin_name kh_admin_phone");

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const userObj = user.toObject();

    userObj.isVerified = Boolean(
      user.c_mobile_verified || user.c_email_verified || user.c_admin_verified,
    );

    return res.status(200).json({
      status: true,
      data: userObj,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ======================================
// EDIT USER
// ======================================

const editUser = async (req, res) => {
  try {
    const { id } = req.params;

    // ======================================
    // VALIDATE ID
    // ======================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user id",
      });
    }

    // ======================================
    // CHECK USER
    // ======================================

    const existingUser = await Candidate.findById(id);

    if (!existingUser) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // ======================================
    // UPDATE OBJECT
    // ======================================

    const updateData = {};

    // ======================================
    // NAME
    // ======================================

    if (isValidValue(req.body.c_first_name)) {
      updateData.c_first_name = req.body.c_first_name;
    }

    if (isValidValue(req.body.c_last_name)) {
      updateData.c_last_name = req.body.c_last_name;
    }

    if (isValidValue(req.body.c_display_name)) {
      updateData.c_display_name = req.body.c_display_name;
    }

    // ======================================
    // EMAIL
    // ======================================

    if (isValidValue(req.body.c_email)) {
      updateData.c_email = req.body.c_email;
    }

    // ======================================
    // EMAIL VERIFIED
    // ======================================

    if (isValidValue(req.body.c_email_verified)) {
      updateData.c_email_verified = Number(req.body.c_email_verified);
    }

    // ======================================
    // CONTACT
    // ======================================

    if (isValidValue(req.body.c_contact)) {
      updateData.c_contact = req.body.c_contact;
    }

    // ======================================
    // MOBILE VERIFIED
    // ======================================

    if (isValidValue(req.body.c_mobile_verified)) {
      updateData.c_mobile_verified = Number(req.body.c_mobile_verified);
    }

    // ======================================
    // ALT CONTACT
    // ======================================

    // Optional fields: apply whenever the key was actually sent, even as an
    // empty string, so clearing them from the edit form persists. The admin
    // edit form (the only caller of this endpoint) always sends every key,
    // so isValidValue's "" === "not sent" treatment silently ignored any
    // attempt to blank these out - the old value stuck with no error shown.
    if (req.body.c_alt_contact !== undefined) {
      updateData.c_alt_contact = req.body.c_alt_contact;
    }

    // ======================================
    // STATUS
    // ======================================

    if (isValidValue(req.body.c_user_status)) {
      updateData.c_user_status = Number(req.body.c_user_status);
    }

    // ======================================
    // GENDER
    // ======================================

    if (req.body.c_gender !== undefined) {
      updateData.c_gender = req.body.c_gender;
    }

    // ======================================
    // DOB
    // ======================================

    if (req.body.c_dob !== undefined) {
      updateData.c_dob = req.body.c_dob || null;
    }

    // ======================================
    // PINCODE
    // ======================================

    if (req.body.c_current_pincode !== undefined) {
      updateData.c_current_pincode = req.body.c_current_pincode;
    }

    // ======================================
    // ADDRESS
    // ======================================

    if (req.body.c_current_address1 !== undefined) {
      updateData.c_current_address1 = req.body.c_current_address1;
    }

    // ======================================
    // STATE
    // ======================================

    if (isValidValue(req.body.c_current_state)) {
      if (req.body.c_current_state !== "others") {
        if (!mongoose.Types.ObjectId.isValid(req.body.c_current_state)) {
          return res.status(400).json({
            status: false,
            message: "Invalid state id",
          });
        }

        const stateData = await State.findById(req.body.c_current_state);

        if (!stateData) {
          return res.status(404).json({
            status: false,
            message: "State not found",
          });
        }

        updateData.c_current_state = req.body.c_current_state;
      } else {
        updateData.c_current_state = "others";
      }
    }

    // ======================================
    // CITY
    // ======================================

    if (isValidValue(req.body.c_current_city)) {
      if (req.body.c_current_city !== "others") {
        if (!mongoose.Types.ObjectId.isValid(req.body.c_current_city)) {
          return res.status(400).json({
            status: false,
            message: "Invalid city id",
          });
        }

        const cityData = await City.findById(req.body.c_current_city);

        if (!cityData) {
          return res.status(404).json({
            status: false,
            message: "City not found",
          });
        }

        updateData.c_current_city = req.body.c_current_city;

        // AUTO STATE
        updateData.c_current_state = cityData.m_city_state;
      } else {
        updateData.c_current_city = "others";
      }
    }

    // ======================================
    // REFERED BY
    // ======================================

    if (isValidValue(req.body.c_user_refer_by)) {
      updateData.c_user_refer_by = req.body.c_user_refer_by;
    }

    // ======================================
    // PROFILE IMAGE
    // ======================================

    if (req.files?.c_profile_image?.[0]?.path) {
      updateData.c_profile_image = req.files.c_profile_image[0].path;
    }

    // ======================================
    // PASSWORD UPDATE
    // ======================================

    if (
      isValidValue(req.body.password) ||
      isValidValue(req.body.confirm_password)
    ) {
      if (req.body.password !== req.body.confirm_password) {
        return res.status(400).json({
          status: false,
          message: "Password and confirm password does not match",
        });
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      updateData.c_password = hashedPassword;
      updateData.c_password_update = 1;
    }

    // ======================================
    // UPDATE USER
    // ======================================

    const updatedUser = await Candidate.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    return res.status(200).json({
      status: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const searchUsersForDropdown = async (req, res) => {
  try {
    let { keyword = "", page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const filter = {};

    // ======================================
    // SEARCH
    // ======================================

    if (keyword && keyword.trim() !== "") {
      filter.$or = [
        {
          c_first_name: {
            $regex: keyword,
            $options: "i",
          },
        },

        {
          c_last_name: {
            $regex: keyword,
            $options: "i",
          },
        },

        {
          c_display_name: {
            $regex: keyword,
            $options: "i",
          },
        },

        {
          c_email: {
            $regex: keyword,
            $options: "i",
          },
        },
      ];
    }

    // ======================================
    // TOTAL COUNT
    // ======================================

    const totalRecords = await Candidate.countDocuments(filter);

    // ======================================
    // GET USERS
    // ======================================

    const users = await Candidate.find(filter)
      .select(
        `
        c_first_name
        c_last_name
        c_display_name
        c_email
      `,
      )
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    // ======================================
    // FORMAT DATA
    // ======================================

    const finalData = users.map((user) => {
      return {
        _id: user._id,

        full_name:
          user.c_display_name ||
          `${user.c_first_name || ""} ${user.c_last_name || ""}`.trim(),

        first_name: user.c_first_name || "",

        last_name: user.c_last_name || "",

        email: user.c_email || "",
      };
    });

    // ======================================
    // RESPONSE
    // ======================================

    return res.status(200).send({
      status: true,

      pagination: {
        currentPage: page,
        perPage: limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },

      data: finalData,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// ======================================
// TOGGLE ADMIN-VERIFIED (the "Verified" badge)
// ======================================
// Displayed verified status = c_mobile_verified || c_email_verified ||
// c_admin_verified. Mobile/email verification is earned automatically
// through the OTP/Google flows; this is the admin's manual override for
// accounts that haven't gone through either (e.g. admin-created ones).

// Flips the Active/Inactive account flag (c_user_status: 1 = active, 0 = inactive)
const { forgetUser } = require("../utils/accountStatus");

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: false, message: "Invalid user id" });
    }

    const user = await Candidate.findById(id);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    const activating = user.c_user_status !== 1;
    user.c_user_status = activating ? 1 : 0;
    user.c_deactivated = !activating;
    user.c_deactivated_at = activating ? null : new Date();
    await user.save();
    forgetUser(user._id); // takes effect on their next request, not after the cache expires

    return res.status(200).json({
      status: true,
      message: activating ? "User activated" : "User deactivated",
      c_user_status: user.c_user_status,
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: error.message });
  }
};

const toggleAdminVerified = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user id",
      });
    }

    const user = await Candidate.findById(id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    const currentlyVerified = Boolean(
      user.c_mobile_verified || user.c_email_verified || user.c_admin_verified,
    );

    let update;
    if (currentlyVerified) {
      // Displayed status is an OR of three sources - flipping only
      // c_admin_verified had no visible effect whenever mobile/email
      // verification already made this true (the common case), which is
      // why this toggle looked broken. Unverifying now clears all three so
      // the click always has a real, visible effect.
      update = { c_mobile_verified: 0, c_email_verified: 0, c_admin_verified: 0 };
    } else {
      update = { c_admin_verified: 1 };
    }

    await Candidate.updateOne({ _id: user._id }, { $set: update });

    const isVerified = !currentlyVerified;

    return res.status(200).json({
      status: true,
      message: "Verified status updated successfully",
      c_admin_verified: update.c_admin_verified,
      isVerified,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ======================================
// TOGGLE LIFETIME ACCESS (the iScale mobile app)
// ======================================
// Manual admin override for mobile_app_lifetime_access - lets support grant
// or revoke lifetime access to the mobile app without going through
// Razorpay (comps, refunds, testing, etc).

const toggleLifetimeAccess = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user id",
      });
    }

    const user = await Candidate.findById(id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    user.mobile_app_lifetime_access = !user.mobile_app_lifetime_access;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Lifetime access updated successfully",
      hasLifetimeAccess: user.mobile_app_lifetime_access,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ======================================
// DELETE USER
// ======================================

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // ======================================
    // VALIDATE ID
    // ======================================

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user id",
      });
    }

    // ======================================
    // CHECK USER
    // ======================================

    const candidate = await Candidate.findById(id);

    if (!candidate) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // ======================================
    // DELETE ENROLLMENTS
    // ======================================

    const deletedEnrollments = await Enrollment.deleteMany({
      user_id: id,
    });

    // ======================================
    // DELETE USER
    // ======================================

    await Candidate.findByIdAndDelete(id);

    return res.status(200).json({
      status: true,
      message: "User deleted successfully",
      deleted_enrollments: deletedEnrollments.deletedCount,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ======================================
// ADD STUDENT (admin-created, no self-registration needed)
// ======================================
// No password is set here - this account logs into the iScale mobile app
// via OTP only (see authController.loginSendOtp/loginVerifyOtp), which
// only requires c_first_name to be set, not a password.
const addUser = async (req, res) => {
  try {
    const { fname, lname, mobile, email, gender } = req.body;

    if (!fname || !mobile) {
      return res.status(400).json({
        status: false,
        message: "Name and mobile number are required",
      });
    }

    if (String(mobile).length !== 10) {
      return res.status(400).json({
        status: false,
        message: "Mobile number must be 10 digits",
      });
    }

    // c_contact is schema'd as String, but some legacy candidates may have
    // it stored as a raw Number (a write path that bypassed Mongoose's
    // cast-on-save) - match both so this duplicate check can't miss them
    // and create a second account for the same number.
    const existing = await Candidate.findOne({
      $or: [{ c_contact: String(mobile) }, { c_contact: Number(mobile) }],
    });
    if (existing) {
      return res.status(400).json({
        status: false,
        message: "A student with this mobile number already exists",
      });
    }

    if (email) {
      const existingEmail = await Candidate.findOne({
        c_email: email.toLowerCase(),
      });
      if (existingEmail) {
        return res.status(400).json({
          status: false,
          message: "A student with this email already exists",
        });
      }
    }

    const joinDate = new Date();

    const student = await Candidate.create({
      c_first_name: fname,
      c_last_name: lname || "",
      c_display_name: fname,
      c_email: email ? email.toLowerCase() : undefined,
      c_contact: Number(mobile),
      c_gender: gender || undefined,
      c_mobile_verified: 1,
      c_admin_verified: 1,
      c_user_status: 1,
      c_register_date: joinDate,
      candidate_idno: await generateCandidateIdno(joinDate),
      // Not is_lms_student: 1 here - this endpoint is shared by the plain
      // App Users "+ Add Student" flow and the LMS page's "New Student"
      // flow. Only the latter should register the account for LMS, and it
      // does so with a separate setLmsStatus call right after creation.
    });

    return res.status(201).json({
      status: true,
      message: "Student added successfully",
      data: student,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Registers an existing candidate into the LMS module (is_lms_student: 1,
// used when picking "Existing iScale Student" in Add Student), or
// deactivates one out of it (is_lms_student: 0, used by the LMS list's
// Delete action - blocks their login without touching their account or
// enrollment history, see authController.loginSendOtp/loginVerifyOtp).
const setLmsStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_lms_student } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user id",
      });
    }

    if (![0, 1].includes(Number(is_lms_student))) {
      return res.status(400).json({
        status: false,
        message: "is_lms_student must be 0 or 1",
      });
    }

    const student = await Candidate.findByIdAndUpdate(
      id,
      { is_lms_student: Number(is_lms_student) },
      { new: true },
    );

    if (!student) {
      return res.status(404).json({
        status: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      status: true,
      message:
        Number(is_lms_student) === 1
          ? "Student registered for LMS successfully"
          : "Student removed from LMS successfully",
      data: student,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Clears this student's enrolled face-biometric data (face-lock) so they
// can register a new one from the app - e.g. a new phone, or a bad/wrong
// enrollment. enrollFace (mobileFaceController.js) otherwise refuses to
// overwrite an already-registered face, so this is the only way to let
// them re-enroll.
const resetFaceData = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user id",
      });
    }

    const student = await Candidate.findById(id);

    if (!student) {
      return res.status(404).json({
        status: false,
        message: "Student not found",
      });
    }

    student.mobile_app_face_registered = false;
    await student.save();

    try {
      await deleteEnrolledIdentity(String(student._id));
    } catch (mxError) {
      console.error(
        "MXFace identity delete error:",
        mxError.response?.data || mxError.message,
      );
    }

    return res.status(200).json({
      status: true,
      message: "Face data removed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ======================================
// COURSE ASSIGNMENT (LMS)
// ======================================

const getAssignedCourses = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user id",
      });
    }

    const enrollments = await Enrollment.find({ user_id: id })
      .populate("course_id", "m_course_title m_course_banner m_course_type")
      .sort({ enrolled_on: -1 });

    return res.status(200).json({
      status: true,
      data: enrollments.filter((e) => e.course_id),
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Assigns one or more LMS courses to a student - this is the admin-side
// equivalent of a purchase, skipping payment entirely. Each course can
// independently be lifetime access or time-limited (access_days from
// today). Re-submitting an already-assigned course updates its access
// type/expiry instead of erroring, so changing an existing assignment's
// duration is just calling this again.
const assignCourses = async (req, res) => {
  try {
    const { id } = req.params;
    // assignments: [{ course_id, access_type: 'lifetime'|'limited', access_days }]
    // course_ids (legacy): plain array, always assigned as lifetime.
    const assignments = Array.isArray(req.body.assignments)
      ? req.body.assignments
      : (Array.isArray(req.body.course_ids) ? req.body.course_ids : []).map(
          (cid) => ({ course_id: cid, access_type: "lifetime" }),
        );

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid user id",
      });
    }

    if (assignments.length === 0) {
      return res.status(400).json({
        status: false,
        message: "At least one course assignment is required",
      });
    }

    for (const a of assignments) {
      if (!mongoose.Types.ObjectId.isValid(a.course_id)) {
        return res.status(400).json({
          status: false,
          message: `Invalid course id: ${a.course_id}`,
        });
      }
      if (a.access_type === "limited" && !(Number(a.access_days) > 0)) {
        return res.status(400).json({
          status: false,
          message: "access_days is required for time-limited access",
        });
      }
    }

    const student = await Candidate.findById(id);
    if (!student) {
      return res.status(404).json({
        status: false,
        message: "Student not found",
      });
    }

    const courseIds = assignments.map((a) => a.course_id);
    const courses = await Course.find({ _id: { $in: courseIds } }).select(
      "m_course_type",
    );
    const courseMap = new Map(courses.map((c) => [c._id.toString(), c]));

    let assignedCount = 0;

    for (const a of assignments) {
      const course = courseMap.get(a.course_id.toString());
      if (!course) continue;

      const accessType = a.access_type === "limited" ? "limited" : "lifetime";
      const expiryDate =
        accessType === "limited"
          ? new Date(Date.now() + Number(a.access_days) * 24 * 60 * 60 * 1000)
          : null;

      await Enrollment.findOneAndUpdate(
        { user_id: id, course_id: a.course_id },
        {
          $set: {
            access_type: accessType,
            expiry_date: expiryDate,
            status: 1,
          },
          $setOnInsert: {
            user_id: id,
            course_id: a.course_id,
            course_type: course.m_course_type,
            payment_status: 1,
            amount: 0,
          },
        },
        { upsert: true },
      );

      assignedCount += 1;
    }

    return res.status(200).json({
      status: true,
      message: `${assignedCount} course${assignedCount === 1 ? "" : "s"} assigned`,
      assigned: assignedCount,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

const removeCourseAssignment = async (req, res) => {
  try {
    const { id, courseId } = req.params;

    const deleted = await Enrollment.findOneAndDelete({
      user_id: id,
      course_id: courseId,
    });

    if (!deleted) {
      return res.status(404).json({
        status: false,
        message: "This student isn't assigned that course",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Course access removed",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllUsers,
  getSingleUser,
  editUser,
  deleteUser,
  searchUsersForDropdown,
  toggleAdminVerified,
  toggleUserStatus,
  toggleLifetimeAccess,
  addUser,
  setLmsStatus,
  resetFaceData,
  getAssignedCourses,
  assignCourses,
  removeCourseAssignment,
};
