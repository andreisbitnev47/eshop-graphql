const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShippingOptionSchema = new Schema({
    name: { type: String, required: true },
    address: { type: [String] },
    options: { type: [{
        name: { type: String },
        price: { type: Number },
    }]},
});

module.exports = mongoose.model('ShippingOption', ShippingOptionSchema);
