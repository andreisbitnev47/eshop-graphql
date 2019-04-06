
const express = require('express');
const expressGraphQL = require('express-graphql');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const schema = require('./schema/schema');
const fileUpload = require('express-fileupload');
const get = require('lodash/get');
const cors = require('cors');
const { checkToken } = require('./util');

require('dotenv-safe').config();

const app = express();

mongoose.connect(process.env.MONGO_URL);

function getToken(request) {
  return get(request, 'headers.authorization', '');
}
app.use(cors());
app.use(fileUpload());
app.use(bodyParser.json());
app.use('/graphql', cors(), expressGraphQL(request => ({
  schema,
  graphiql: true,
  context: { token: getToken(request) }
})));

app.use('/images', express.static('images'));

app.post('/fileUpload', async function(req, res) {
  const user = await checkToken(getToken(req));
  if (get(user, 'role') === 'admin') {
    if (Object.keys(req.files).length == 0) {
      return res.status(400).send('No files were uploaded.');
    }
    const file = req.files.file;
  
    // Use the mv() method to place the file somewhere on your server
    file.mv(`./images/${file.name}`, function(err) {
      if (err)
        return res.status(500).send(err);
  
      res.send('File uploaded!');
    });
  } else {
      console.log('Unauthorized');
      res.send(null)
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
