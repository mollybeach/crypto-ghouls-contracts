const fs = require('fs');
const deployments = require('../data/deployments');

task('deploy_dao-royalties').setAction(async function () {
  const [deployer] = await ethers.getSigners();

  const factory = await ethers.getContractFactory("DAORoyaltiesDistribution", deployer);
  const royaltiesWallet = "CHANGEME";
  const devWallet = "CHANGEME";
  const daoWallet = "CHANGEME";
  const instance = await factory.deploy(daoWallet, devWallet, royaltiesWallet);
  await instance.deployed();

  console.log(`Deployed contract DAORoyaltiesDistribution to: ${instance.address}`);
  deployments.DAORoyaltiesDistribution = instance.address;

  const json = JSON.stringify(deployments, null, 2);
    fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
      flag: 'w',
  });
});

task('deploy_dutch-auction').setAction(async function () {
  const [deployer] = await ethers.getSigners();

  const factory = await ethers.getContractFactory("DutchAuctionMint", deployer);
  const instance = await factory.deploy();
  await instance.deployed();

  console.log(`Deployed contract DutchAuctionMint to: ${instance.address}`);
  deployments.DutchAuctionMint = instance.address;

  const json = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
    flag: 'w',
  });
});

task('deploy_staking').setAction(async function () {
  const [deployer] = await ethers.getSigners();
  const erc721address = "CHANGEME";
  const erc20address = "CHANGEME";
  const RATE = ethers.utils.parseUnits('50', 18).div(ethers.BigNumber.from('6000'));
  const expiration = 126000;

  const factory = await ethers.getContractFactory("Staking", deployer);
  const instance = await factory.deploy(erc721address, RATE, expiration, erc20address);
  await instance.deployed();

  console.log(`Deployed contract Staking to: ${instance.address}`);
  deployments.Staking = instance.address;

  const json = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
    flag: 'w',
  });
});

task('deploy-test-premint').setAction(async function () {
  const [deployer] = await ethers.getSigners();

  const factory = await ethers.getContractFactory("ERC721PreMinted", deployer);
  const instance = await factory.deploy();
  await instance.deployed();

  console.log(`Deployed contract ERC721PreMinted to: ${instance.address}`);
  deployments.ERC721PreMinted = instance.address;

  const json = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
    flag: 'w',
  });
});

task('deploy-erc721-stakable').setAction(async function () {
  const [deployer] = await ethers.getSigners();

  const factory = await ethers.getContractFactory("ERC721Stakable", deployer);
  const instance = await factory.deploy();
  await instance.deployed();

  console.log(`Deployed contract ERC721Stakable to: ${instance.address}`);
  deployments.ERC721Stakable = instance.address;

  const json = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
    flag: 'w',
  });
});

task('deploy-spookypigz-staking').setAction(async function () {
  const [deployer] = await ethers.getSigners();
  const erc721Address = "0xd4048be096F969F51FD5642A9c744eC2a7eB89fE";
  const rate = ethers.utils
      .parseUnits('5', 18)
      .div(ethers.BigNumber.from('6000'));
  const expiration = ethers.BigNumber.from('42000');
  const erc20Address = "0xaEfaa45AD5e0862948e5835656AFc42D0971ced9";
  const factory = await ethers.getContractFactory("SpookyPigzStaking", deployer);
  const instance = await factory.deploy(erc721Address, rate, expiration, erc20Address);
  await instance.deployed();

  console.log(`Deployed contract SpookyPigzStaking to: ${instance.address}`);
  deployments.SpookyPigzStaking = instance.address;

  const json = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
    flag: 'w',
  });
});

task('deploy-spookycreatures2').setAction(async function () {
  const [deployer] = await ethers.getSigners();
  console.log("Account balance:", (await deployer.getBalance()).toString());
  const factory = await ethers.getContractFactory("SpookyCreatures2", deployer);
  const instance = await factory.deploy();
  await instance.deployed();

  console.log(`Deployed contract SpookyCreatures2 to: ${instance.address}`);
  deployments.SpookyCreatures2 = instance.address;

  const json = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
    flag: 'w',
  });
});

task('deploy-pugs').setAction(async function () {
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("PugMafia", deployer);
  // const proxyAddr = "0xeCeAa7453a77bFE339B25D9D9E91009CdE71c768"; // Rinkeby Wyvern Proxy Registry
  const proxyAddr = "0xa5409ec958C83C3f309868babACA7c86DCB077c1"; // Mainnet Wyvern Proxy Registry
  const instance = await factory.deploy(proxyAddr);
  await instance.deployed();

  console.log(`Deployed contract PugMafia to: ${instance.address}`);
  deployments.PugMafia = instance.address;

  const json = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
    flag: 'w',
  });
});