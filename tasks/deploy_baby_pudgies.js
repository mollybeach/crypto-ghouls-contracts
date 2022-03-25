const fs = require('fs');
const { start } = require('repl');
const deployments = require('../data/deployments');

task('deploy-baby-puppies').setAction(async function () {
  const [deployer] = await ethers.getSigners();

  const name = "LilPuppies";
  const symbol = "BABYPUDGES";
  const baseUri = "ipfs:///";

  const factory = await ethers.getContractFactory("LilPuppies", deployer);
  const instance = await factory.deploy(
      name,
      symbol,
      baseUri
  );
  await instance.deployed();

  console.log(`Deployed contract LilPuppies to: ${instance.address}`);
  deployments.lilBabyPuppies = instance.address;

  const json = JSON.stringify(deployments, null, 2);
    fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
      flag: 'w',
  });
});