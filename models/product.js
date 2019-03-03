const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
    title: { type: {
      en: { type: String },
      rus: { type: String },
      est: { type: String },
    }},
    descriptionShort: { type: {
      en: { type: String },
      rus: { type: String },
      est: { type: String },
    }},
    descriptionLong: { type: {
      en: { type: String },
      rus: { type: String },
      est: { type: String },
    }},
    weight: { type: Number },
    amount: { type: Number },
    available: { type: Boolean },
    imgSmall: [{ type: String}],
    imgBig: [{ type: String }],
    price: { type: Number },
});

module.exports = mongoose.model('Product', ProductSchema);
