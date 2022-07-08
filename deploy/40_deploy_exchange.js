const colors = require('colors');
const { ethers } = require('hardhat');

const txWait = async (tx) => {
    const receipt = await tx.wait();
    if (receipt.status || receipt.status == "0x1") {
        console.log('completed!');
    }
    else {
        await txWait(tx);
    }
}

module.exports = async ({getNamedAccounts, gasNowPrice, deployments, network, otherDeployments}) => {
    const {deploy} = deployments
    const {deployer} = await getNamedAccounts();
    const gasPrice = await gasNowPrice.getGasPrice(network.name);
    const chainId = network.config.chainId
    console.log(`network ${network.name} chainId ${chainId} gasPrice ${gasPrice}`);

    const contractName = 'WyvernExchange'

    const personalSignPrefixes = {
        default: "\x19Ethereum Signed Message:\n",
    }

    const registryAddress = await otherDeployments.address('./', network.name, 'WyvernRegistry')
    const registryAddresses = [registryAddress]

    console.log('registryAddresses', registryAddresses)

    const personalSignPrefix = personalSignPrefixes[network] || personalSignPrefixes['default']

    let deployed = await deploy(contractName, {
        from: deployer,
        args: [chainId, registryAddresses, Buffer.from(personalSignPrefix,'binary')],
        gasPrice: gasPrice,
        log: true,
    });

    const exchangeAddress = deployed.address
    const registryFactory = await ethers.getContractFactory("WyvernRegistry");
    const registry = await registryFactory.attach(registryAddress);

    const auth = await registry.contracts(exchangeAddress)
    console.log('auth', auth)
    if (auth === false) {
        let result = await registry.grantInitialAuthentication(exchangeAddress);
        await txWait(result);
        console.log('endGrantAuthentication', result.hash);
    }

    console.log(`${colors.green("INFO")} ${colors.yellow(`${contractName}`)} deployed at ${colors.green(deployed.address)} on ${colors.red(network.name)}`)
};


module.exports.tags = ['wyExchange']
module.exports.dependencies = ['wyRegistry', 'wyStatic']