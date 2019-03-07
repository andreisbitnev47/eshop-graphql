const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
    total: { type: Number, required: true },
    totalWithShipping: { type: Number, required: true },
    status: { type: String, required: true },
    products: { type: [{
      title: { type: String, required: true },
      amount: { type: Number, required: true },
      price: { type: Number, required: true },
      total: { type: Number, required: true },
      product: { type: Schema.Types.ObjectId, ref: 'Product' }
    }]},
    shippingProvider: { type: {
      name: { type: String, required: true },
      optionName: { type: String },
      price: { type: Number, required: true },
      shippingProvider: { type: Schema.Types.ObjectId, ref: 'ShippingOption' }
    }},
    user: {type: Schema.Types.ObjectId, ref: 'User'}
});

module.exports = mongoose.model('Order', OrderSchema);
