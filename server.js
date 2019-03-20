
const express = require('express');
const expressGraphQL = require('express-graphql');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const schema = require('./schema/schema');
const fileUpload = require('express-fileupload');
const get = require('lodash/get');
require('dotenv-safe').config();

const app = express();

mongoose.connect(process.env.MONGO_URL);

app.use(fileUpload());
app.use(bodyParser.json());
app.use('/graphql', expressGraphQL(request => ({
  schema,
  graphiql: true,
  context: { token: get(request, 'headers.authorization', 'Bearer ').split('Bearer ')[1] }
})));

app.use('/images', express.static('images'));

app.post('/fileUpload', function(req, res) {
  if (Object.keys(req.files).length == 0) {
    return res.status(400).send('No files were uploaded.');
  }
  const sampleFile = req.files.sampleFile;

  // Use the mv() method to place the file somewhere on your server
  sampleFile.mv(`./images/${sampleFile.name}`, function(err) {
    if (err)
      return res.status(500).send(err);

    res.send('File uploaded!');
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
