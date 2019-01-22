var mongoose = require( 'mongoose' );
const abiDecoder = require('abi-decoder');
var Web3 = require('web3');
const redis = require('redis');
require( '../db.js' );
var fs = require('fs');
var etherUnits = require("../lib/etherUnits.js");

var daoABI = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"INITIAL_SUPPLY","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_subtractedValue","type":"uint256"}],"name":"decreaseApproval","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_addedValue","type":"uint256"}],"name":"increaseApproval","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"}];
abiDecoder.addABI(daoABI); 
var config = {};
//Look for config.json file if not
try {
    var configContents = fs.readFileSync('config.json');
    config = JSON.parse(configContents);
    console.log('config.json found.');
}
catch (error) {
  if (error.code === 'ENOENT') {
      console.log('No config file found.');
  }
  else {
      throw error;
      process.exit(1);
  }
}


// set the default NODE address to localhost if it's not provided
if (!('nodeAddr' in config) || !(config.nodeAddr)) {
    config.nodeAddr = 'localhost'; // default
  }
  // set the default geth port if it's not provided
  if (!('gethPort' in config) || (typeof config.gethPort) !== 'number') {
    config.gethPort = 8545; // default
  }

var web3 = new Web3(new Web3.providers.HttpProvider('http://' + config.nodeAddr + ':' + config.gethPort.toString()));
const transactionSubscriber = require('./subscriber')(
    redis.createClient(config.redisUri), 
    'tokenTransaction'
);
const tokenSubscriber = require('./subscriber')(
    redis.createClient(config.redisUri),
    'savetoken'
)
const publisherclient = redis.createClient(config.redisClient);
const publisher = require('./publisher');
publisher.setClient(publisherclient)


const Token  = mongoose.model( 'TokenTrans' );
const Tokens = mongoose.model('Tokens');
const insertToken = function(channel, message ) {
    const redisClient = redis.createClient(config.redisUri);
    redisClient.rpop('tokenTransaction', (err, redres) => {
        if(err || !redres) {
            console.log("error in token transaction added");
            return
        }
            let tx = JSON.parse(redres);
            let receipt = web3.adh.getTransactionReceipt(tx.hash);
            if(receipt && receipt.logs.length) {
                let logs = abiDecoder.decodeLogs(receipt.logs);
                let daoContract = web3.adh.contract(daoABI);
                let DAO = daoContract.at(tx.to);
                let bulkOps  = [];
                for(d in logs) {
                    if(!logs[d]) {
                        continue;
                    }
                  let log = logs[d].events;
                  let tokenTrans = {
                    hash:tx.hash,
                    from:log[0].value,
                    to:log[1].value,
                    value:etherUnits.toEther(parseFloat(log[2].value),'wei'),
                    contractAddress:tx.to,
                    blockNumber:tx.blockNumber,
                    name:DAO.name(),
                    decimals:DAO.decimals(),
                    token:DAO.symbol(),
                    timestamp:tx.timestamp
                  }
                  bulkOps.push(tokenTrans);
                }
                if( bulkOps.length > 0 ){
                    var bulk = bulkOps;
                    bulkOps = [];
                    if(bulk.length == 0) return;
                    Token.collection.insert(bulk, function( err, tokenData ){
                      if ( typeof err !== 'undefined' && err ) {
                        if (err.code == 11000) {
                          if(!('quiet' in config && config.quiet === true)) {
                            console.log('Skip: Duplicate DB key : ' +err);
                            return;
                          }
                        }else{
                          console.log('Error: Aborted due to error on DB: ' + err);
                          process.exit(9);
                        }
                      }else{
                            redisClient.lpush('savetoken',tx.to)
                            publisher.publishItemTo('savetoken',{});
                            // redis.quiet()
                        console.log('* ' + tokenData.insertedCount + ' token data successfully written.');
                      }
                    });
                  }
              }else {
                  return;
              }
    });
}

const inserTokenData = function(channel, message) {
    const redisClient = redis.createClient(config.redisUri);
    redisClient.rpop('savetoken', (err, redres) => {
        if(err) {
            console.log("redis err on the token gettter");
            return;
        }

        Tokens.findOne({"address":redres} ,(err, res) =>{
            console.log("res",res)
            if(err) {
                console.log("error in finding token");
                return;
            }
            if(!res){
                let daoContract = web3.adh.contract(daoABI);
                let DAO = daoContract.at(redres);
                const newToken  = new Tokens({
                    address: redres,
                    name : DAO.name(),
                    symbol : DAO.symbol(),
                    decimals: DAO.decimals(),
                    totalsupply : DAO.totalSupply()/1e18
                })
                newToken.save((err) => {
                    if(err) {
                        if(err.code == 11000) {
                            console.log("duplicate error");
                            return;
                        }
                        console.log("Inserting token error",err);
                        return;
                    }else{
                        return;
                    }
                })
            }
        })
    })
}
transactionSubscriber(insertToken);
tokenSubscriber(inserTokenData)