const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ContentSchema = new Schema({
  handle: { type: String },
  group: { type: String },
  title: { type: [{
    en: { type: String },
    rus: { type: String },
    est: { type: String },
  }]},
  subTitle: { type: [{
    en: { type: String },
    rus: { type: String },
    est: { type: String },
  }]},
  paragraph: { type: [{
    en: { type: String },
    rus: { type: String },
    est: { type: String },
  }]},
  span: { type: [{
    en: { type: String },
    rus: { type: String },
    est: { type: String },
  }]},
  link: { type: [{
    en: { type: {
      url: { type: String },
      anchor: { type: String },
    } },
    est: { type: {
      url: { type: String },
      anchor: { type: String },
    } },
    rus: { type: {
      url: { type: String },
      anchor: { type: String },
    } },
  }]},
  img: { type: [{
    alt: { type: {
      en: { type: String },
      rus: { type: String },
      est: { type: String },
    }},
    url: { type: String },
  }]}
});

module.exports = mongoose.model('Content', ContentSchema);
