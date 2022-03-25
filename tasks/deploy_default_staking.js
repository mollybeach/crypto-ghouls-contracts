const fs = require('fs');
const deployments = require('../data/deployments');

task('deploy-default-staking').setAction(async function () {
    const [deployer] = await ethers.getSigners();
  
    const factory = await ethers.getContractFactory("DefaultStaking", deployer);
    const erc721Address = deployments.DefaultErc721;
    const rate = ethers.BigNumber.from("1000");
    const expiration = ethers.BigNumber.from("1000000000");
    const erc20Address = deployments.DefaultErc20;
    const instance = await factory.deploy(erc721Address, rate, expiration, erc20Address);
    await instance.deployed();
  
    console.log(`Deployed contract DefaultStaking to: ${instance.address}`);
    deployments.DefaultStaking = instance.address;
  
    const json = JSON.stringify(deployments, null, 2);
      fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
        flag: 'w',
    });
});

task('stake-nft').setAction(async function () {
    const [sender] = await ethers.getSigners();

    const erc721 = await ethers.getContractAt("DefaultErc721", deployments.DefaultErc721);

    const instance = await ethers.getContractAt("DefaultStaking", deployments.DefaultStaking);

    const unpause = await instance.connect(sender).unpause();
    await unpause.wait();

    const setApproval = await erc721.connect(sender).setApprovalForAll(deployments.DefaultStaking, true);
    await setApproval.wait();

    const stake = await instance.connect(sender).deposit([1,2,3]);
    await stake.wait();
})