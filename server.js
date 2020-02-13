// server.js
// where your node app starts

// init project
const axios = require('axios');
const express = require("express");
const slpaddr = require('bchaddrjs-slp');
const app = express();

// we've started you off with Express,
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

app.post('/calculate', async function(req,res) {
  var tokenId = req.body.zslpTokenId;
  if (/^([A-Fa-f0-9]{2}){32,32}$/.test(tokenId)){
    var amountDiv = req.body.dividendZcl;
    var divType = (req.body.divType == 'ZCL') ? false : true
    var divs = await processTokenDivs(tokenId, amountDiv, divType) 
    res.send(divs)
  } else {
    res.send({error: true, errormsg: 'Invalid token address.'})
  }
});

async function querySLPdata(query){
    const b64 = Buffer.from(JSON.stringify(query)).toString('base64');
    const url = "https://zslpdb.zslp.org/q/" + b64;
    var msg = ''
  
    await axios.get(url)
    .then(res => {
      msg = res.data
    })
    .catch(err => {
      console.log(err);
      msg = 'error'
    });
    return msg
}

async function queryTokenData(tokenId){
  var q = { "v": 3,
            "q": {
              "db": ["t"],
              "find": {
                "tokenDetails.tokenIdHex": tokenId
              },
              "limit": 1
            }
          }
  var r = await querySLPdata(q)
  return r
}

async function queryHoldersData(tokenId, skip=0){
  var q = { "v": 3,
            "q": {
              "db": [
                "a"
              ],
              "find": {
                "tokenDetails.tokenIdHex": tokenId
              },
              "sort": {
                "token_balance": -1
              },
              "limit": 100,
              "skip": skip
            }
          }
  var r = await querySLPdata(q)
  return r
}

async function processTokenDivs(tokenId, amount, isZCLdividend=true){
  var final = ''
  var tokenData = await queryTokenData(tokenId)
  if (tokenData != 'error'){
    var nrHolders = tokenData.t[0].tokenStats.qty_valid_token_addresses
    var circTokens = tokenData.t[0].tokenStats.qty_token_circulating_supply
    var tokenName = tokenData.t[0].tokenDetails.name + '(' + tokenData.t[0].tokenDetails.symbol + ')'
    var nrLoops = Math.ceil(nrHolders/100)
     for (var k=0; k<nrLoops; k++){
       var holderData = await queryHoldersData(tokenId, k*100)
       for (var i=0; i<holderData.a.length; i++){
         var div = (holderData.a[i].token_balance / circTokens) * amount
         var address = (isZCLdividend) ? holderData.a[i].address : slpaddr.toLegacyAddress(holderData.a[i].address)
         final += address+','+div.toFixed(8) + '\n'
       }
     }
  }  
  return {token_name: tokenName, circulating_supply: circTokens, amount_holders: nrHolders, addresses: final.trim()}
}

// listen for requests :)
const listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
