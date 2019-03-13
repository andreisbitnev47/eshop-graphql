const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TranslationSchema = new Schema({
  key: { type: String },
  en: { type: String },
  rus: { type: String },
  est: { type: String },
});

module.exports = mongoose.model('Translation', TranslationSchema);
