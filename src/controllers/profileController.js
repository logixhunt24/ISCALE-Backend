const Candidate = require("../models/candidates");
const { toPublicUrl } = require("../utils/imageUrl");


// const getMyProfile = async (req, res) => {
//   try {
//     const userId = req.user.id; // from JWT middleware

//     const user = await Candidate.findById(userId);

//     if (!user) {
//       return res.status(404).send({
//         status: false,
//         message: "User not found",
//       });
//     }

//     res.status(200).send({
//       status: true,
//       data: {
//         registrationDate: user.c_register_date,
//         firstName: user.c_first_name,
//         lastName: user.c_last_name,
//         parentName: user.c_user_parent,
//         mobileNumber: user.c_contact,
//         altMobileNumber: user.c_alt_contact,
//         whatsappNumber: user.c_whatsapp,
//         email: user.c_email,
//         dob: user.c_dob,
//         gender: user.c_gender,
//         state: user.c_current_state,
//         city: user.c_current_city,
//         pincode: user.c_current_pincode,
//         address: `${user.c_current_address1} ${user.c_current_address2}`,
//         occupation: user.m_occupation,
//         biography: user.c_bio,
//       },
//     });

//   } catch (error) {
//     console.log(error);
//     res.status(500).send({
//       status: false,
//       message: error.message,
//     });
//   }
// };


// Mobile Apis=============================================================================================================================

const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id; // from JWT middleware

    const user = await Candidate.findById(userId)
      .populate("c_current_country", "m_country_name")
      .populate("c_current_state", "m_state_name")
      .populate("c_current_city", "m_city_city");

    if (!user) {
      return res.status(404).send({
        status: false,
        message: "User not found",
      });
    }

    res.status(200).send({
      status: true,
      data: {
        registrationDate: user.c_register_date,
        firstName: user.c_first_name,
        lastName: user.c_last_name,
        parentName: user.c_user_parent,
        mobileNumber: user.c_contact,
        hasMobile: Boolean(user.c_contact),
        altMobileNumber: user.c_alt_contact,
        whatsappNumber: user.c_whatsapp,
        email: user.c_email,
        dob: user.c_dob,
        gender: user.c_gender,

        country: user.c_current_country,
        state: user.c_current_state,
        city: user.c_current_city,

        countryName: user.c_current_country_name,
        stateName: user.c_current_state_name,
        cityName: user.c_current_city_name,

        pincode: user.c_current_pincode,
        address: `${user.c_current_address1 || ""} ${user.c_current_address2 || ""}`.trim(),
        occupation: user.m_occupation,
        biography: user.c_bio,

        profileImage: user.c_profile_image,

        authProvider: user.c_google_id ? "google" : "mobile",
        googleId: user.c_google_id || null,
      },
    });
  } catch (error) {
    console.log(error);

    res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};


const appGetMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await Candidate.findById(userId)
      .populate("c_current_state", "state_name")
      .populate("c_current_city", "city_name");

    if (!user) {
      return res.status(404).json({
        response: "failed",
        message: "User not found",
      });
    }

    return res.status(200).json({
      response: "success",
      message: "Detail fetched",
      data: {
        user_id: user._id,
        user_name:
          user.c_display_name ||
          `${user.c_first_name || ""} ${user.c_last_name || ""}`.trim(),

        user_contact: user.c_contact || "",
        alt_contact: user.c_alt_contact || "",

        user_email: user.c_email || "",

        user_gender: user.c_gender || "",

        c_profile_image: toPublicUrl(user.c_profile_image),

        user_dob: user.c_dob
          ? new Date(user.c_dob).toLocaleDateString("en-GB").replace(/\//g, "-")
          : "",

        user_state:
          user.c_current_state?.state_name ||
          user.c_current_state?.name ||
          "",

        user_city:
          user.c_current_city?.city_name ||
          user.c_current_city?.name ||
          "",

        user_pincode: user.c_current_pincode || "",

        user_address: [
          user.c_current_address1,
          user.c_current_address2,
        ]
          .filter(Boolean)
          .join(" "),

        user_status: user.c_user_status || 0,

        user_fcm_id: user.c_fcm_id || "",

        parent_name: user.c_user_parent || "",

        user_occupation: user.m_occupation || "",

        c_bio: user.c_bio || "",
      },
    });
  } catch (error) {
    return res.status(500).json({
      response: "failed",
      message: error.message,
    });
  }
};

module.exports={
  getMyProfile,appGetMyProfile
}