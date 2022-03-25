const fs = require('fs');
const deployments = require('../data/deployments');

task('deploy-default-721').setAction(async function () {
    const [deployer] = await ethers.getSigners();
  
    const factory = await ethers.getContractFactory("DefaultErc721", deployer);
    const instance = await factory.deploy();
    await instance.deployed();
  
    console.log(`Deployed contract DefaultErc721 to: ${instance.address}`);
    deployments.DefaultErc721 = instance.address;
  
    const json = JSON.stringify(deployments, null, 2);
      fs.writeFileSync(`${__dirname}/../data/deployments.json`, `${json}\n`, {
        flag: 'w',
    });
});

task('mint-default-721').setAction(async function () {
    const [sender] = await ethers.getSigners();

    const instance = await ethers.getContractAt("DefaultErc721", deployments.DefaultErc721);

    let tokenUri = "a";

    for (i = 0; i < 9000; i++) {
      const mint = await instance.connect(sender).awardItem(sender.address, tokenUri);
      await mint.wait()
    }
})