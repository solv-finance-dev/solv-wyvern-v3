const colors = require('colors');
const { ethers } = require('hardhat');

module.exports = async ({getNamedAccounts, gasNowPrice, deployments, network}) => {
    const {deploy} = deployments
    const {deployer} = await getNamedAccounts();
    const gasPrice = await gasNowPrice.getGasPrice(network.name);
    console.log(`network ${network.name} gasPrice ${gasPrice}`);

    const contractName = 'WyvernRegistry'

    let deployed = await deploy(contractName, {
        from: deployer,
        gasPrice: gasPrice,
        log: true,
    });

    console.log(`${colors.green("INFO")} ${colors.yellow(`${contractName}`)} deployed at ${colors.green(deployed.address)} on ${colors.red(network.name)}`)
};


module.exports.tags = ['wyRegistry']
