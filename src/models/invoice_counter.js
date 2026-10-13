const mongoose = require("mongoose");

// One document per calendar year (e.g. "2026"), incremented atomically so
// two students downloading their first invoice at once never share a number.
const invoiceCounterSchema = new mongoose.Schema({
  _id: { type: String }, // YYYY
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("invoice_counter", invoiceCounterSchema);
