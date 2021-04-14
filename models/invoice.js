const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InvoiceSchema = new Schema({
  total: { type: Number, required: true },
  invoiceNr: { type: Number, required: true },
  year: { type: String, required: true },
  month: { type: String, required: true },
  day: { type: String, required: true },
  services: { type: [{
    cnt: { type: Number, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true }
  }]},
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
