const crypto = require("crypto");

// Links that let a browser or the mobile app open a generated PDF without sending a bearer
// token. Each link is bound to one kind of document and one record id, so a certificate link
// can never open an invoice (or any other record).
const sign = (kind, id) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET || "").update(`${kind}:${id}`).digest("hex");

const verify = (kind, id, sig) => {
  if (!sig) return false;
  const a = Buffer.from(String(sig));
  const b = Buffer.from(sign(kind, id));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const apiBase = () => (process.env.PUBLIC_API_URL || "https://api.theiscale.com").replace(/\/$/, "");

module.exports = { sign, verify, apiBase };
