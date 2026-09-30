// Converts stored DB image paths to full public URLs.
// Handles: "src\uploads\banners\file.jpg" | "uploads\banners\file.jpg" | already-full URLs
const toPublicUrl = (stored) => {
  if (!stored) return "";
  if (stored.startsWith("http://") || stored.startsWith("https://")) return stored;
  const p = stored.replace(/\\/g, "/");
  const i = p.indexOf("uploads/");
  if (i >= 0) return "https://api.theiscale.com/" + p.slice(i);
  return stored;
};

module.exports = { toPublicUrl };
