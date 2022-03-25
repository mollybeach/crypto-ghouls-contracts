const fs = require('fs');
const deployments = require('../data/deployments');

task('deploy-bigfarm').setAction(async function () {
    const [deployer] = await ethers.getSigners();
  
    const factory = await ethers.getContractFactory("MegaGarden", deployer);
    const name = "MegaGardens";
    const symbol = "FFARM";
    const baseURI = "https://localhost";
    const instance = await factory.deploy(name, symbol, baseURI);
    await instance.deployed();
  
    console.log(`Deployed contract MegaGarden to: ${instance.address}`);
    deployments.bigGardenOld = instance.address;
  
    const json = JSON.stringify(deployments, null, 2);
      fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
        flag: 'w',
    });
});