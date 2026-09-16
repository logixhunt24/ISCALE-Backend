// Proxies the iScale mobile app's face-biometric calls to MXFace.ai, so the
// MXFace subscription key lives only on this server and never ships inside
// the Flutter app.
//
// Enrollment/matching uses MXFace's Identity API ("1-to-n search" product,
// api/v3/FaceIdentity + api/v3/Group) instead of storing the face image
// ourselves: the captured photo is uploaded straight to MXFace under this
// candidate's own externalId, MXFace keeps the biometric template, and every
// future login just asks MXFace "does this new photo match externalId X?".
// We never persist the image or a Cloudinary copy - only a boolean flag
// (mobile_app_face_registered) so the app knows whether to show the
// enroll-face or scan-face screen.
const axios = require("axios");
const Candidate = require("../models/candidates");

const MXFACE_BASE_URL =
  process.env.MXFACE_BASE_URL || "https://faceapi.mxface.ai/api/v3";

const mxfaceHeaders = () => ({
  "Content-Type": "application/json",
  Subscriptionkey: process.env.MXFACE_SUBSCRIPTION_KEY,
});

// All of this app's enrolled faces live in one MXFace group. Created lazily
// on first use and cached in memory - set MXFACE_GROUP_ID in .env once it's
// logged (see the console.warn below) so a restart doesn't spawn a new group.
let cachedGroupId = process.env.MXFACE_GROUP_ID
  ? Number(process.env.MXFACE_GROUP_ID)
  : null;

const getGroupId = async () => {
  if (cachedGroupId) return cachedGroupId;

  const response = await axios.post(
    `${MXFACE_BASE_URL}/Group`,
    { groupName: "iscale-mobile-app-students" },
    { headers: mxfaceHeaders() },
  );

  cachedGroupId = response.data.groupId;
  console.warn(
    `MXFace group created (id ${cachedGroupId}) - set MXFACE_GROUP_ID=${cachedGroupId} in .env so this group isn't recreated on every restart.`,
  );
  return cachedGroupId;
};

// ======================================
// HEALTH CHECK
// ======================================
exports.health = (req, res) => {
  return res.status(200).json({
    status: true,
    message: "the iScale mobile API is up",
    timestamp: new Date().toISOString(),
  });
};

// ======================================
// LIVENESS CHECK (stateless, no DB involved)
// ======================================
exports.checkLiveness = async (req, res) => {
  try {
    const { encoded_image } = req.body;

    if (!encoded_image) {
      return res.status(400).json({
        status: false,
        message: "encoded_image is required",
      });
    }

    const response = await axios.post(
      `${MXFACE_BASE_URL}/Face/Liveness`,
      { encoded_image },
      { headers: mxfaceHeaders() },
    );

    return res.status(200).json({
      status: true,
      data: response.data,
    });
  } catch (error) {
    const mxError = error.response?.data;
    console.error("MXFace Liveness Error:", mxError || error.message);

    return res.status(502).json({
      status: false,
      message: mxError?.errorMessage || mxError?.error || "Liveness check failed",
      error: mxError || error.message,
    });
  }
};

// ======================================
// FACE DETECT (stateless, no DB involved)
// ======================================
exports.detectFace = async (req, res) => {
  try {
    const { encoded_image } = req.body;

    if (!encoded_image) {
      return res.status(400).json({
        status: false,
        message: "encoded_image is required",
      });
    }

    const response = await axios.post(
      `${MXFACE_BASE_URL}/Face/detect`,
      { encoded_image },
      { headers: mxfaceHeaders() },
    );

    return res.status(200).json({
      status: true,
      data: response.data,
    });
  } catch (error) {
    const mxError = error.response?.data;
    console.error("MXFace Detect Error:", mxError || error.message);

    return res.status(502).json({
      status: false,
      message: mxError?.errorMessage || mxError?.error || "Face detection failed",
      error: mxError || error.message,
    });
  }
};

// ======================================
// ENROLL FACE - uploads the photo to MXFace under this candidate's own id.
// One-time: rejects if this account already has a face on file. No image
// or Cloudinary reference is stored on our side, only the boolean flag.
// ======================================
exports.enrollFace = async (req, res) => {
  try {
    const { encoded_image } = req.body;

    if (!encoded_image) {
      return res.status(400).json({
        status: false,
        message: "encoded_image is required",
      });
    }

    const user = await Candidate.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    if (user.mobile_app_face_registered) {
      return res.status(400).json({
        status: false,
        message: "A face is already enrolled for this account",
      });
    }

    const groupId = await getGroupId();
    // Must not be stricter than the app's own local pre-check (detectFace,
    // gated at MxFaceConfig.minFaceQuality = 40 client-side) - a photo the
    // app already accepted as "good enough" getting rejected here purely on
    // a higher quality bar is a confusing dead end for the user.
    const qualityThreshold = Number(process.env.MXFACE_QUALITY_THRESHOLD) || 40;

    const response = await axios.post(
      `${MXFACE_BASE_URL}/FaceIdentity`,
      {
        groupIds: [groupId],
        encoded_Image: encoded_image,
        externalId: String(user._id),
        qualityThreshold,
      },
      { headers: mxfaceHeaders() },
    );

    if (response.data.errorCode || !response.data.faceIdentityId) {
      console.error("MXFace Enroll rejected:", response.data);
      return res.status(400).json({
        status: false,
        message:
          response.data.errorMessage ||
          "Face enrollment failed. Please retake the photo in good, even lighting.",
      });
    }

    user.mobile_app_face_registered = true;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Face enrolled successfully",
      data: { hasFaceRegistered: true },
    });
  } catch (error) {
    const mxError = error.response?.data;
    console.error("MXFace Enroll Error:", mxError || error.message);
    return res.status(502).json({
      status: false,
      message:
        mxError?.errorMessage ||
        mxError?.error ||
        "Face enrollment failed. Please retake the photo in good, even lighting.",
      error: mxError || error.message,
    });
  }
};

// ======================================
// FACE STATUS
// ======================================
exports.getFaceStatus = async (req, res) => {
  try {
    const user = await Candidate.findById(req.user.id).select(
      "mobile_app_face_registered",
    );

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: true,
      data: { hasFaceRegistered: !!user.mobile_app_face_registered },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ======================================
// FACE LOGIN VERIFY - searches this app's MXFace group for the newly
// captured photo and confirms the closest match is *this* logged-in
// account's own enrolled identity (not just "someone" in the group).
// JWT-gated (unlike the old raw two-image /face/verify) because matching
// is now relative to a specific account rather than two images the caller
// already had in hand.
// ======================================
exports.verifyLoginFace = async (req, res) => {
  try {
    const { encoded_image } = req.body;

    if (!encoded_image) {
      return res.status(400).json({
        status: false,
        message: "encoded_image is required",
      });
    }

    const groupId = await getGroupId();
    // matchConfidence is a server-side filter on MXFace's search - a value
    // set too high silently drops a genuine match (returns no result at
    // all, not a low-confidence one) instead of rejecting it with a reason,
    // which is exactly what happened at 80: a real login selfie under
    // slightly different lighting/angle than the enrollment shot came back
    // under that bar and looked identical to "no match" client-side. This
    // endpoint's response never exposes the actual similarity score (unlike
    // the old raw two-image /Face/verify), so there's no way to calibrate
    // this from data - 60 is a starting middle ground, adjust via env var
    // based on real testing (lower if genuine logins still get rejected,
    // raise if it ever accepts the wrong person).
    const matchConfidence = Number(process.env.MXFACE_MATCH_CONFIDENCE) || 60;
    const qualityThreshold = Number(process.env.MXFACE_QUALITY_THRESHOLD) || 40;

    const response = await axios.post(
      `${MXFACE_BASE_URL}/FaceIdentity/search`,
      {
        groupIds: [groupId],
        encoded_Image: encoded_image,
        limit: 1,
        matchConfidence,
        qualityThreshold,
      },
      { headers: mxfaceHeaders() },
    );

    if (response.data.errorCode) {
      return res.status(502).json({
        status: false,
        message: response.data.errorMessage || "Face verification failed",
      });
    }

    const top = response.data.searchedIdentities?.[0];
    // matchResult mirrors the Face/verify endpoint's convention (1 = match),
    // but the search endpoint already filters by matchConfidence server-side
    // - so a returned identity with the right externalId is trusted even if
    // matchResult itself is missing/null.
    const isMatch =
      !!top &&
      top.identity?.externalId === String(req.user.id) &&
      top.matchResult !== 0;

    return res.status(200).json({
      status: true,
      data: { isMatch },
    });
  } catch (error) {
    const mxError = error.response?.data;
    console.error("MXFace Search Error:", mxError || error.message);
    return res.status(502).json({
      status: false,
      message: mxError?.errorMessage || mxError?.error || "Face verification failed",
      error: mxError || error.message,
    });
  }
};

// ======================================
// Removes this candidate's enrolled identity from MXFace entirely, so they
// can enroll a fresh face afterwards. Used by the admin's "Remove Registered
// Face" action (appUserController.resetFaceData) - failures here are logged
// but don't block clearing our own flag, since MXFace being unreachable
// shouldn't trap an admin from resetting a student's local state.
// ======================================
exports.deleteEnrolledIdentity = async (externalId) => {
  const lookup = await axios.get(
    `${MXFACE_BASE_URL}/FaceIdentity/${externalId}/facIdentities`,
    { headers: mxfaceHeaders() },
  );

  const faceIdentityId = lookup.data?.faceIdentityId;
  if (!faceIdentityId) return;

  await axios.delete(`${MXFACE_BASE_URL}/FaceIdentity/${faceIdentityId}`, {
    headers: mxfaceHeaders(),
  });
};
