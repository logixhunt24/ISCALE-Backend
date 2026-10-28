const { sign, apiBase } = require("./signedLink");

// Link to the generated certificate PDF (served by the API, see certificateController).
const signedCertificateUrl = (enrollmentId) =>
  `${apiBase()}/api/certificate/signed/${enrollmentId}?sig=${sign("certificate", enrollmentId)}`;

// What every API response should hand out as "the certificate file": a working link when the
// certificate is approved, nothing otherwise. The old stored value (a Cloudinary URL) is
// ignored on purpose - those links break when Cloudinary blocks PDF delivery.
const certificateUrlFor = (enrollment) =>
  enrollment && Number(enrollment.certificate_status) === 2 ? signedCertificateUrl(enrollment._id) : null;

module.exports = { signedCertificateUrl, certificateUrlFor };
