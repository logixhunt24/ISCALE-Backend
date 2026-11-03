const { sign, apiBase } = require("./signedLink");

// Link to a registration's invoice PDF (served by the API, see invoiceController).
const signedInvoiceUrl = (enrollmentId) =>
  `${apiBase()}/api/invoice/signed/${enrollmentId}?sig=${sign("invoice", enrollmentId)}`;

module.exports = { signedInvoiceUrl };
