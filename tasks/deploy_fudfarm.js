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
    deployments.MegaGarden = instance.address;
  
    const json = JSON.stringify(deployments, null, 2);
      fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
        flag: 'w',
    });
});

task('deploy-bigfarm-staking').setAction(async function () {
    const [deployer] = await ethers.getSigners();
  
    const factory = await ethers.getContractFactory("MegaGardensStaking", deployer);
    const instance = await factory.deploy();
    await instance.deployed();
  
    console.log(`Deployed contract MegaGardensStaking to: ${instance.address}`);
    deployments.MegaGardensStaking = instance.address;
  
    const json = JSON.stringify(deployments, null, 2);
      fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
        flag: 'w',
    });
});

task('deploy-batch').setAction(async function () {
    const [deployer] = await ethers.getSigners();
  
    const factory = await ethers.getContractFactory("CropToken", deployer);
    const bigGardenAddress = deployments.MegaGarden;
    const RATE = ethers.utils
        .parseUnits('10', 18)
        .div(ethers.BigNumber.from('6000'));

    const EXPIRATION = ethers.BigNumber.from('3600000');
    const instance = await factory.deploy(bigGardenAddress, RATE, EXPIRATION);
    await instance.deployed();
  
    console.log(`Deployed contract CropToken to: ${instance.address}`);
    deployments.CropToken = instance.address;
  
    const json = JSON.stringify(deployments, null, 2);
      fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
        flag: 'w',
    });
});

task('set-whitelist').setAction(async function() {
  const [sender] = await ethers.getSigners();

  const instance = await ethers.getContractAt('CropToken', deployments.CropToken);

  const amount = ethers.utils.parseUnits("10000000", 18);

  const tx = await instance.connect(sender).setWhitelist([sender.address, deployments.MegaGardensStaking]);
  await tx.wait();

  const mint = await instance.connect(sender).mint(deployments.MegaGardensStaking, amount);
  await mint.wait();
})

task('deploy-bigfarm-developed').setAction(async function () {
  const [deployer] = await ethers.getSigners();

  const factory = await ethers.getContractFactory('MegaGardensDeveloped', deployer);

  const instance = await factory.deploy();
  await instance.deployed();

  console.log(`Deployed contract MegaGardenDeveloped to: ${instance.address}`);
  deployments.bigGardensDeveloped = instance.address;

  const json = JSON.stringify(deployments, null, 2);
    fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
      flag: 'w',
    });
});

//run after minting and depositing into the old farm contract. 
task('set-staking-params').setAction(async function() {
  const [sender] = await ethers.getSigners();

  const instance = await ethers.getContractAt('MegaGardensStaking', deployments.MegaGardensStaking);

  const unpause = await instance.connect(sender).unpause();
  await unpause.wait();
})