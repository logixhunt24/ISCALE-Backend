const mongoose = require("mongoose");

// Logo gallery for the homepage "Prime Hiring Destinations" strip
// (CareerHubSection.jsx). Kept separate from the "client" model even
// though both are just logo galleries — that one is already shared across
// three different, unrelated sections (ClientsPage, TopCompaniesSection,
// and this one previously), so curating this strip independently needs its
// own list rather than overloading that shared one further.
const primeHiringDestinationSchema = new mongoose.Schema({
  m_phd_name: {
    type: String,
    default: "",
    trim: true,
  },

  m_phd_logo: {
    type: String,
    default: "",
  },

  m_phd_logo_public_id: {
    type: String,
    default: "",
  },

  m_phd_status: {
    type: Number,
    enum: [0, 1], // 0-Inactive, 1-Active
    default: 1,
  },

  m_phd_order: {
    type: Number,
    default: 0,
  },

  created_at: {
    type: Date,
    default: Date.now,
  },

  updated_at: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model(
  "prime_hiring_destination",
  primeHiringDestinationSchema,
);
