const express = require('express');
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const config = require('config')
const port  = config.get("port")
const app  = express();
const cors = require('cors');
const path = require('path')
const history = require('connect-history-api-fallback')

app.use(cors(config.cors))
const staticFileMiddleware = express.static(path.join(__dirname, '/dist'))
app.use(staticFileMiddleware)
app.use(history())
app.use(staticFileMiddleware)
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
const db = config.get('mongoDb');
mongoose.connect(db, { useNewUrlParser: true }, function(err) {
  if(err) {
    console.log("err",err)
  }
});

app.get('/', function (req, res) {
  res.render(path.join(__dirname ,'/dist'))
})
const router = express.Router();
require('./controllers/auctions')(router)
app.use('/api', router)
app.listen(port, function(err, res) {
  if(!err)
   console.log(`App started listening on the port ${port}`)
});
