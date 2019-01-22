const mongoose = require('mongoose')
const Schema = mongoose.Schema;

const auctionSchema = new Schema({
  title : String,
  description : String,
  owner : String,
  address: {
    type:String,
    unique: true
  },
  startBlock : String,
  endBlock : String,
  ipfsHash : String,
  tags : String,
  bidIncrement : String
})

module.exports = mongoose.model('Auction', auctionSchema)