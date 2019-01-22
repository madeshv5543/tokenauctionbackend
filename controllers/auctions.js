const config = require('config');
const provider = config.get('adhiNet');
const web3util = require('../utils/web3Provider');
const web3Instance = web3util(provider);
const Auction  =require('../models/auction');


const getAllActions = (req, res) => {
  console.log('get all auction', req.query)
  let { currentPage, pageLimit} = req.query;
  let skip = 0;
  if(parseInt(currentPage)) 
  skip = ( currentPage - 1) * pageLimit
  console.log('skip', skip)
  Auction.find().skip(skip).limit(parseInt(pageLimit))
  .then(
    auctions  => {
      console.log('all auction')
      res.json({
        data: auctions,
        status: 200,
        type : 'Success'
      })
    },
    err => {
      console.log('err',err)
      res.json({
        message: 'Cannot get all auction',
        status: 400,
        type: 'failure'
      })
    }
  )
}

module.exports = function(app) {
  app.get('/allAuction',
    getAllActions
  )
}