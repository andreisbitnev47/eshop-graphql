const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
    total: { type: Number, required: true },
    totalWithShipping: { type: Number, required: true },
    shippingCost: { type: Number, required: true },
    status: { type: String, required: true },
    products: { type: [{
      title: { type: String, required: true },
      amount: { type: Number, required: true },
      price: { type: Number, required: true },
      total: { type: Number, required: true },
      product: { type: Schema.Types.ObjectId, ref: 'Product' }
    }]},
    user: {type: Schema.Types.ObjectId, ref: 'User'}
});

module.exports = mongoose.model('Order', OrderSchema);
