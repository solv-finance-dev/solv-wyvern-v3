const { extendEnvironment } = require("hardhat/config")
const fs = require('fs')

const address = async (project, network, contract) => {
  const contractDeploymentFile = getPath(project, network, contract)
  if (fs.existsSync(contractDeploymentFile)) {
    const content = fs.readFileSync(contractDeploymentFile)
    const deployment = JSON.parse(content)
    return deployment['address']
  }
  throw contractDeploymentFile + ' NOT FOUND'
}

const getPath = (project, network, contract) => {
  return project + '/deployments/' + network + '/' + contract + '.json'
}

extendEnvironment(hre => {
  hre.otherDeployments = {
    address,
  }
})