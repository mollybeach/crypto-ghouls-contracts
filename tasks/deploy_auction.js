const { BigNumber } = require('@ethersproject/bignumber');
const fs = require('fs');
const deployments = require('../data/deployments');
// task to deploy auction
task('deploy-auction').setAction(async function () {
  const [deployer] = await ethers.getSigners();

  const factory = await ethers.getContractFactory("AuctionMint", deployer);
  const instance = await factory.deploy(BigNumber.from(3000));
  await instance.deployed();

  console.log(`Deployed contract AuctionMint to: ${instance.address}`);
  deployments.AuctionMint = instance.address;

  const json = JSON.stringify(deployments, null, 2);
    fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
      flag: 'w',
  });
});
