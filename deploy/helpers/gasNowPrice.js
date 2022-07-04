const request = require("request")
const { BigNumber } = require("ethers")
const { extendEnvironment } = require("hardhat/config")

const get = (url) => {
  return new Promise((resolve, reject) => {
    request(url, (err, data) => {
      if (err) {
        reject(err)
      } else {
        if (data.statusCode == 200) {
          resolve(data.body)
        } else {
          reject(data.statusCode)
        }
      }
    })
  })
}
const getGasPrice = (network) => {
  const highest = process.env.gas_price_highest || 250
  const increase = process.env.gas_price_increase || 1.1
  return new Promise(async (resolve, reject) => {
    let gasPrice;
    if (network == 'mainnet') {
      const apiKey = process.env.ETHERSCAN_API_KEY
      let response = await get(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${apiKey}`);
      if (typeof response == 'string') {
        response = JSON.parse(response);
      }
      gasPrice = Number(response["result"]["FastGasPrice"]).toFixed(0);
      if (gasPrice > highest) {
        reject(`gasPrice ${gasPrice} gwei too high, abort, current highest ${highest} , use export gas_price_highest=xxx to set`)
      }
      console.log("current gasPrice: ", gasPrice);
      gasPrice = (gasPrice * increase * 1e9).toFixed(0);
      console.log("increase gasPrice to ", gasPrice);
    } else {
      const defaultPrice = {
        'bsc': 5e9,
        'bsctest': 10e9,
        'mumbai': 4e9,
        'polygon': 30e9,
        'development': 30e9,
        'testnet': 30e9,
      }
      if (defaultPrice[network] == undefined) {
        gasPrice = 5e9; //5 gwei
      } else {
        gasPrice = defaultPrice[network]
      }
    }
    console.log(`network ${network} gasPrice ${gasPrice}`)
    resolve(BigNumber.from('' + gasPrice));
  })
}

module.exports = getGasPrice

extendEnvironment(hre => {
  hre.gasNowPrice = {
    getGasPrice,
  }
})