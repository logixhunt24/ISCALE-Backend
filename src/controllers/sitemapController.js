const Course = require("../models/course");
const Event = require("../models/event");
const News = require("../models/news&update");
const Job = require("../models/company_requirement");

// Where the public website lives (the sitemap lists website URLs, not API URLs).
const SITE_URL = (process.env.SITE_URL || "https://www.theiscale.com").replace(/\/$/, "");

// Public, indexable pages of the website. Anything behind a login (dashboard,
// checkout, tests) or that is a one-off flow is deliberately left out.
const STATIC_PAGES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/explore-courses", changefreq: "daily", priority: "0.9" },
  { path: "/cohort-courses", changefreq: "weekly", priority: "0.8" },
  { path: "/events", changefreq: "daily", priority: "0.8" },
  { path: "/job-updates", changefreq: "daily", priority: "0.8" },
  { path: "/success-story", changefreq: "weekly", priority: "0.7" },
  { path: "/placement-talks", changefreq: "weekly", priority: "0.6" },
  { path: "/student-testimonials", changefreq: "weekly", priority: "0.6" },
  { path: "/blogs", changefreq: "daily", priority: "0.7" },
  { path: "/news", changefreq: "daily", priority: "0.6" },
  { path: "/about-us", changefreq: "monthly", priority: "0.6" },
  { path: "/allied-colleges", changefreq: "monthly", priority: "0.5" },
  { path: "/placement", changefreq: "monthly", priority: "0.5" },
  { path: "/hire-with-us", changefreq: "monthly", priority: "0.5" },
  { path: "/community", changefreq: "monthly", priority: "0.4" },
  { path: "/faq", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/verify-certificate", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.2" },
  { path: "/terms-of-service", changefreq: "yearly", priority: "0.2" },
  { path: "/refund-policy", changefreq: "yearly", priority: "0.2" },
];

const xmlEscape = (s) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));

const isoDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
};

const urlEntry = ({ path, lastmod, changefreq, priority }) =>
  [
    "  <url>",
    `    <loc>${xmlEscape(SITE_URL + path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");

const buildSitemap = async () => {
  const [courses, events, posts, jobs] = await Promise.all([
    Course.find({ m_course_status: 1, m_course_status_web: 1 }).select("m_course_slug").lean(),
    Event.find({ m_event_status: 1, m_event_slug: { $exists: true, $ne: "" } })
      .select("m_event_slug m_event_added_on")
      .lean(),
    News.find({ m_news_status: 1 }).select("m_news_added_on").lean(),
    Job.find({ status: 1 }).select("updatedAt createdAt").lean(),
  ]);

  const entries = [...STATIC_PAGES];

  courses.forEach((c) =>
    entries.push({
      path: `/course-details/${encodeURIComponent(c.m_course_slug || c._id)}`,
      changefreq: "weekly",
      priority: "0.8",
    }),
  );
  events.forEach((e) =>
    entries.push({
      path: `/event-details/${encodeURIComponent(e.m_event_slug)}`,
      lastmod: isoDate(e.m_event_added_on),
      changefreq: "weekly",
      priority: "0.6",
    }),
  );
  posts.forEach((p) =>
    entries.push({
      path: `/blog-details/${p._id}`,
      lastmod: isoDate(p.m_news_added_on),
      changefreq: "monthly",
      priority: "0.6",
    }),
  );
  jobs.forEach((j) =>
    entries.push({
      path: `/job-details/${j._id}`,
      lastmod: isoDate(j.updatedAt || j.createdAt),
      changefreq: "weekly",
      priority: "0.5",
    }),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map(urlEntry)
    .join("\n")}\n</urlset>\n`;
};

// Crawlers hit this often and the content changes slowly: rebuild at most once an hour.
const CACHE_MS = 60 * 60 * 1000;
let cache = { xml: null, at: 0, pending: null };

const getSitemap = async (req, res) => {
  try {
    const fresh = cache.xml && Date.now() - cache.at < CACHE_MS;
    if (!fresh) {
      // concurrent requests share a single rebuild
      cache.pending =
        cache.pending ||
        buildSitemap()
          .then((xml) => {
            cache = { xml, at: Date.now(), pending: null };
          })
          .catch((err) => {
            cache.pending = null;
            throw err;
          });
      await cache.pending;
    }
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(cache.xml);
  } catch (err) {
    // serve the last good copy rather than failing the crawler
    if (cache.xml) {
      res.set("Content-Type", "application/xml; charset=utf-8");
      return res.send(cache.xml);
    }
    return res.status(500).send("Unable to generate sitemap");
  }
};

module.exports = { getSitemap, buildSitemap };
