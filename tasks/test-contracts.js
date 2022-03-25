const deployments = require('../data/deployments');
const fs = require('fs');
const { BigNumber } = require('@ethersproject/bignumber');

task('test-ff-staking').setAction(async function () {
    const [sender] = await ethers.getSigners();

    const instance = await ethers.getContractAt(
      'MegaGardensStaking',
      deployments.MegaGardensStaking,
    );
    const batchInstance = await ethers.getContractAt(
      'CropToken',
      deployments.CropToken,
    );
    const bigGardenToken = await ethers.getContractAt(
      'MegaGarden',
      deployments.MegaGarden,
    );

    const tx = await instance
      .connect(sender)
      .claimRewards([1]);
    await tx.wait();

    // const tx = await instance
    //   .connect(sender)
    //   .deposit([3]);
    // await tx.wait();

  });

  task('deploy-zt-drain-test').setAction(async function () {
    const [deployer] = await ethers.getSigners();
    
    const factoryZT = await ethers.getContractFactory("ZombieBatz", deployer);
    const instanceZT = await factoryZT.deploy("name_", "symbol_","baseURI_");
    await instanceZT.deployed();
    console.log(`Deployed contract ZombieBatz to: ${instanceZT.address}`);
    deployments.ZombieBatz = instanceZT.address;
    
    const factorySettings = await ethers.getContractFactory("Settings", deployer);
    const instanceSettings = await factorySettings.deploy();
    await instanceSettings.deployed();
    console.log(`Deployed contract Settings to: ${instanceSettings.address}`);
    deployments.Settings = instanceSettings.address;
    const factoryBRAINZ = await ethers.getContractFactory("VampireTokenVault", deployer);
    const instanceBRAINZ = await factoryBRAINZ.deploy(instanceSettings.address);
    await instanceBRAINZ.deployed();
    console.log(`Deployed contract VampireTokenVault to: ${instanceBRAINZ.address}`);
    deployments.VampireTokenVault = instanceBRAINZ.address;

    const RATE = ethers.utils
      .parseUnits('5', 18)
      .div(ethers.BigNumber.from('6000'));
    const EXPIRATION = ethers.BigNumber.from('42000');
    
    const factoryZTS = await ethers.getContractFactory("ZBStakingOld", deployer);
    const instanceZTS = await factoryZTS.deploy(instanceBRAINZ.address, instanceZT.address, RATE, EXPIRATION);
    await instanceZTS.deployed();
    console.log(`Deployed contract ZBStakingOld to: ${instanceZTS.address}`);
    deployments.ZBStakingOld = instanceZTS.address;

    const factory = await ethers.getContractFactory("DrainVampire", deployer);
    const instance = await factory.deploy();
    await instance.deployed();
    console.log(`Deployed contract DrainVampire to: ${instance.address}`);
    deployments.DrainVampire = instance.address;
  
    const json = JSON.stringify(deployments, null, 2);
      fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
        flag: 'w',
    });
    
    await instance.setAddresses(instanceZTS.address, instanceBRAINZ.address, instanceZT.address);

  });

  task('test-zt-drain').setAction(async function () {
    const [sender] = await ethers.getSigners();

    
    // const factory = await ethers.getContractFactory("DrainVampire", sender);
    // const instance = await factory.deploy();
    // await instance.deployed();
    // console.log(`Deployed contract DrainVampire to: ${instance.address}`);
    // deployments.DrainVampire = instance.address;

    // const factoryBRAINZ = await ethers.getContractFactory("VampireTokenVault", sender);
    // const instanceBRAINZ = await factoryBRAINZ.deploy(deployments.Settings);
    // await instanceBRAINZ.deployed();
    // console.log(`Deployed contract VampireTokenVault to: ${instanceBRAINZ.address}`);
    // deployments.VampireTokenVault = instanceBRAINZ.address;
  
    // const json = JSON.stringify(deployments, null, 2);
    //   fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
    //     flag: 'w',
    // });
    
    
    const erc721Contract = await ethers.getContractAt(
      'ZombieBatz',
      "0x1710d860034b50177d793e16945B6A25C7d92476"
      // deployments.ZombieBatz,
    );
    
    const brainzContract = await ethers.getContractAt(
      'VampireTokenVault',
      "0xe62BaB2C68B2d4C1f82A36d96B63e760295A52c2"
      // deployments.VampireTokenVault,
    );
    
    const stakingContract = await ethers.getContractAt(
      'ZBStakingOld',
      "0x4D1dE90bCA7A38c556c356C0b802b5102CEA032d"
      // deployments.ZBStakingOld,
    );
    
    const drainContract = await ethers.getContractAt(
      'DrainVampire',
      deployments.DrainVampire,
    );

    // await (await drainContract.setAddresses(stakingContract.address, brainzContract.address, erc721Contract.address)).wait();
    // console.log("Set addresses for the drain contract");

    // await (await brainzContract.initialize(sender.address, erc721Contract.address, BigNumber.from(1), ethers.utils.parseEther("100000000"), BigNumber.from(10000), BigNumber.from(0), "BRAINZTOKEN", "BRAINZZ")).wait();
    // await (await stakingContract.setTokenAddress(deployments.VampireTokenVault)).wait();
    // console.log("Set the new brainz token address successfully");

    // await (await erc721Contract.setStart(true)).wait();

    // console.log('Started!');

    // await (await erc721Contract.connect(sender).mintToad(BigNumber.from(1), {
    //   value: ethers.utils.parseEther("0.02")
    // })).wait();
    // console.log("Successfully minted a toad!");

    const toadId = BigNumber.from(426);
    
    // await (await erc721Contract.transferFrom(sender.address, drainContract.address, toadId)).wait();
    // console.log("Transferred toad to contract!");

    // await (await drainContract.depositToad(toadId)).wait();
    // console.log(`Deposited toad #${toadId.toString()} successfully`);

    
    const depositBlock = 13573559;
    await (await drainContract.withdrawVampire(toadId, BigNumber.from(depositBlock + 1))).wait();
    console.log("Successfully withdrew all of the brainz");

    // await (await drainContract.transferVampire()).wait();

  });