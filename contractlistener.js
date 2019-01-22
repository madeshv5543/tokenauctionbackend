const contract = require('adhi-contract');
const config = require('config')
const mongoose = require('mongoose')
const redis = require('redis');
const redisServer = require('redis').createClient('redis://localhost:6379');


const db = config.get('mongoDb');
const provider = config.get('adhiNet');
const web3utils = require('./utils/web3Provider');
const  web3Provider = web3utils(provider)
const auctionFactory = require('./contract/AuctionFactory.json');
const AuctionArtifact = require('./contract/Auction.json')
const Auction = require('./models/auction')
const auctionFactoryContract = contract(auctionFactory)
auctionFactoryContract.setProvider(web3Provider.currentProvider)
const auctionContract = contract(AuctionArtifact)
auctionContract.setProvider(web3Provider.currentProvider)

mongoose.connect(db, { useNewUrlParser: true }, function(err) {
    if(err) {
      console.log("err",err)
    }
});

const auctionSubscriber = require('./utils/subscriber')(
    redis.createClient(config.redisClient), 
    'createAuction'
);

const publisherclient = redis.createClient(config.redisClient);
const publisher = require('./utils/publisher');
publisher.setClient(publisherclient)

let contractInstanc;
const deployContract = async () => {
  contractInstanc = await auctionFactoryContract.deployed()
  getAllAuction()
  contractInstanc
  .AuctionCreated({ fromBlock: 0, toBlock: 'latest' })
  .watch((error, result) => {
    if (error) {
      console.log('Auction created event ERR', error)
    } else {
      if(result.args && result.args.auctionContract){
        redisServer.lpush('auctions', result.args.auctionContract);
        redisServer.publish('createAuction','');
      }
    }
  })
}

const getAllAuction  = async () => {
  let allAuctions = [];
  let auctions = await contractInstanc.allAuctions.call()
  for (let auctionaddr of auctions) {
    const auction = auctionContract.at(auctionaddr)
    const owner = await auction.owner.call()
    const startBlock = await auction.startBlock.call()
    const endBlock = await auction.endBlock.call()
    const bidIncrement = await auction.bidIncrement.call()
    const ipfsHash = await auction.ipfsHash.call()
    const title = await auction.title.call()
    const description = await auction.description.call()
    const tags = await auction.tags.call()
    let bidIncrementvalue = await convertWebiToether(bidIncrement)
    console.log('bid', bidIncrement)
    let auctionDetails = {
      address: auctionaddr,
      owner: owner,
      startBlock: startBlock.toString(),
      endBlock: endBlock.toString(),
      bidIncrement: bidIncrementvalue,
      ipfsHash: ipfsHash,
      title: title,
      description: description,
      tags: tags,
    }
    allAuctions.push(auctionDetails)
  }
  if(allAuctions.length) {
    Auction.insertMany(allAuctions)
    .then(
      result => {
        console.log('data inserted successfully.', allAuctions)
      },
      err => {
        console.log('error on insert data ')
      }
    )
  }
}

const getContractDetails = async (auctionaddr) => {
  const auction = auctionContract.at(auctionaddr)
  const owner = await auction.owner.call()
  const startBlock = await auction.startBlock.call()
  const endBlock = await auction.endBlock.call()
  const bidIncrement = await auction.bidIncrement.call()
  const ipfsHash = await auction.ipfsHash.call()
  const title = await auction.title.call()
  const description = await auction.description.call()
  const tags = await auction.tags.call()
  let bidIncrementvalue = await convertWebiToether(bidIncrement)
  console.log('bid',bidIncrement)
  let auctionDetails = new Auction({
    address: auctionaddr,
    owner: owner,
    startBlock: startBlock.toString(),
    endBlock: endBlock.toString(),
    bidIncrement: bidIncrementvalue,
    ipfsHash: ipfsHash,
    title: title,
    description: description,
    tags: tags,
  })
  auctionDetails.save()
  .then(
    docs => {
      console.log('Auction details inserted successfully', auctionaddr)
    },
    err => {
      console.log('err in inserting auction details', auctionaddr)
    }
  )
}

const convertWebiToether = (vale) => {
  return web3Provider.fromWei(vale, 'ether')
}

const insertAuction = function(channel, message ) {
  const redisClient = redis.createClient(config.redisClient);
  redisClient.rpop('auctions', (err, redres) => {
      if(err || !redres) {
          console.log("error in insert auction");
          return
      }
      getContractDetails(redres)
  });
}

deployContract()
auctionSubscriber(insertAuction);

