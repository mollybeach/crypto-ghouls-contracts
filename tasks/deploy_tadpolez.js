const fs = require('fs');
const deployments = require('../data/deployments');

task('deploy-zombie-bittenz').setAction(async function () {
  const [deployer] = await ethers.getSigners();

  const factory = await ethers.getContractFactory("ZombieBittenz", deployer);
  const baseUri = "ipfs://QmdE5RGx9XdmLYABe135ADnjiAwftiWFnyoXVvQe85hzXo/";
  const zombieBatzAddress = "0x1710d860034b50177d793e16945B6A25C7d92476";
  const brainzTokenAddress = "0xe62BaB2C68B2d4C1f82A36d96B63e760295A52c2";
  const instance = await factory.deploy(
      "ZombieBittenz",
      "ZBITTENZ",
      zombieBatzAddress, 
      brainzTokenAddress,
      baseUri
      );
  await instance.deployed();

  console.log(`Deployed contract zombieBittenz to: ${instance.address}`);
  deployments.zombieBittenz = instance.address;

  const json = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
    flag: 'w',
  });
});

// task('deploy_dutch-auction').setAction(async function () {
//     const [deployer] = await ethers.getSigners();
  
//     const factory = await ethers.getContractFactory("DutchAuctionMint", deployer);
//     const instance = await factory.deploy();
//     await instance.deployed();
  
//     console.log(`Deployed contract DutchAuctionMint to: ${instance.address}`);
//     deployments.DutchAuctionMint = instance.address;
  
//     const json = JSON.stringify(deployments, null, 2);
//     fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
//       flag: 'w',
//     });
//   });