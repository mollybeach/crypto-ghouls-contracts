const fs = require('fs');
const deployments = require('../data/deployments');

task('deploy-heaven-hell').setAction(async function () {
    const [deployer] = await ethers.getSigners();
  
    const factory = await ethers.getContractFactory("Inferno", deployer);
    const name = "Inferno";
    const symbol = "ANACONDAWITCH";
    const baseURI = "ipfs://QmY8m55FCDoiG6XRRhwjoPCYUqqiop8aeFgFLSgbEVyizi/";
    const berriesAddress = deployments.berriesToken;
    const stakingAddress = deployments.berriesStakingMainnet;
    const bearAddress = deployments.spookyPigz;
    const instance = await factory.deploy(name, symbol, baseURI, berriesAddress, stakingAddress, bearAddress);
    await instance.deployed();
  
    console.log(`Deployed contract Inferno to: ${instance.address}`);
    deployments.InfernoMainnet = instance.address;
  
    const json = JSON.stringify(deployments, null, 2);
      fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
        flag: 'w',
    });
});

task('test-mint').setAction(async function () {
    const [sender] = await ethers.getSigners();

    const instance = await ethers.getContractAt("Inferno", deployments.Inferno);
    const erc20 = await ethers.getContractAt("DefaultErc20", deployments.DefaultErc20);

    let amount = ethers.utils.parseUnits("0", 18);

    let tokenId = ethers.BigNumber.from("5");

    console.log(deployments.DefaultErc20.toString());

    const start = await instance.connect(sender).setStart(true);
    await start.wait();

    const approval = await erc20.connect(sender).approve(deployments.Inferno, amount);
    await approval.wait();

    for (i = 4; i< 9000; i ++) {
        const mintBear = await instance.connect(sender).mintBear(amount, i);
        await mintBear.wait();
    }

    console.log(mintBear.data);
})

task('deploy-anaconda-rewards').setAction(async function () {
    const [deployer] = await ethers.getSigners();

    const factory = await ethers.getContractFactory("AnacondaRewards", deployer);
    const instance = await factory.deploy();
    await instance.deployed();

    console.log(`Deployed contract AnacondaRewards to: ${instance.address}`);
    deployments.AnacondaRewards = instance.address;

    const json = JSON.stringify(deployments, null, 2);
      fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
        flag: 'w',
    });
})

task('set-rewards-anacondas').setAction(async function () {
    const [sender] = await ethers.getSigners();

    const instance = await ethers.getContractAt("AnacondaRewards", deployments.AnacondaRewards);

    RATE = ethers.utils.parseUnits("8", 18).div(ethers.BigNumber.from("6000"));

    EXPIRATION = ethers.BigNumber.from("90000");

    const setContracts = await instance.connect(sender).setContracts(deployments.InfernoMainnet, deployments.berriesToken)
    await setContracts.wait();

    const unpause = await instance.connect(sender).unpause();
    await unpause.wait();

    const setRate = await instance.connect(sender).setRate(RATE);
    await setRate.wait();

    const setExpiration = await instance.connect(sender).setExpiration(EXPIRATION);
    await setExpiration.wait();
})