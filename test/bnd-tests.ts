const { randomBytes } = require('crypto');
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BnDGame, BnDGameCR, BnDGameTG, TrainingGrounds, BnD, Tower, GP, Traits, SacrificialAlter, TestRandomizer } from "../typechain";
import { BigNumber } from "ethers";
import { GPProxy } from "../typechain/GPProxy";

describe("Wizards & Dragons Tests", function () {
    const DAY_MULTIPLIER = 24 * 60 * 60;

    let accounts: SignerWithAddress[];
    let contractOwner: SignerWithAddress;
    let player1: SignerWithAddress;
    let player2: SignerWithAddress;
    let player3: SignerWithAddress;

    const MAX_TOKENS = 100;
    
    let gameContract: BnDGame;
    let gameCRContract: BnDGameCR;
    let gameTGContract: BnDGameTG;
    let stakingContract: Tower;
    let nftContract: BnD;
    let erc20Contract: GP;
    let gpproxyContract: GPProxy;
    let traitContract: Traits;
    let erc1155Contract: SacrificialAlter;
    let randomContract: TestRandomizer;
    let trainingContract: TrainingGrounds;

    beforeEach(async () => {
        await network.provider.send("evm_setAutomine", [true]);
        accounts = await ethers.getSigners();
        contractOwner = accounts[0];
        player1 = accounts[1];
        player2 = accounts[2];
        player3 = accounts[3];

        const gameFactory = await ethers.getContractFactory("BnDGame", contractOwner);
        gameContract = await (await gameFactory.deploy()).deployed();
        const gameCRFactory = await ethers.getContractFactory("BnDGameCR", contractOwner);
        gameCRContract = await (await gameCRFactory.deploy()).deployed();
        const gameTGFactory = await ethers.getContractFactory("BnDGameTG", contractOwner);
        gameTGContract = await (await gameTGFactory.deploy()).deployed();

        const stakingFactory = await ethers.getContractFactory("Tower", contractOwner);
        stakingContract = await (await stakingFactory.deploy()).deployed();
        const trainingFactory = await ethers.getContractFactory("TrainingGrounds", contractOwner);
        trainingContract = await (await trainingFactory.deploy()).deployed();

        const nftFactory = await ethers.getContractFactory("BnD", contractOwner);
        nftContract = await (await nftFactory.deploy(MAX_TOKENS)).deployed();

        const traitFactory = await ethers.getContractFactory("Traits", contractOwner);
        traitContract = await (await traitFactory.deploy()).deployed();

        const erc20Factory = await ethers.getContractFactory("GP", contractOwner);
        erc20Contract = await (await erc20Factory.deploy()).deployed();

        const erc1155Factory = await ethers.getContractFactory("SacrificialAlter", contractOwner);
        erc1155Contract = await (await erc1155Factory.deploy()).deployed();

        const randomFactory = await ethers.getContractFactory("TestRandomizer", contractOwner);
        randomContract = await (await randomFactory.deploy()).deployed();

        const gpProxyFactory = await ethers.getContractFactory("GPProxy", contractOwner);
        gpproxyContract = await (await gpProxyFactory.deploy()).deployed();

        await gameContract.setContracts(erc20Contract.address, traitContract.address, nftContract.address, stakingContract.address, erc1155Contract.address, randomContract.address);
        await gameCRContract.setContracts(erc20Contract.address, traitContract.address, nftContract.address, stakingContract.address, erc1155Contract.address);
        await gameTGContract.setContracts(erc20Contract.address, traitContract.address, nftContract.address, erc1155Contract.address, trainingContract.address);
        await stakingContract.setContracts(nftContract.address, erc20Contract.address, gameContract.address, randomContract.address);
        await trainingContract.setContracts(nftContract.address, erc20Contract.address, erc1155Contract.address);
        // await stakingContract.setContracts(nftContract.address, erc20Contract.address, gameCRContract.address, randomContract.address);
        await nftContract.setContracts(traitContract.address, stakingContract.address, randomContract.address);
        await traitContract.setBnD(nftContract.address);
        await erc1155Contract.setContracts(erc20Contract.address);

        await erc20Contract.addAdmin(gameContract.address);
        await erc20Contract.addAdmin(gameCRContract.address);
        await erc20Contract.addAdmin(nftContract.address);
        await erc20Contract.addAdmin(stakingContract.address);
        await erc20Contract.addAdmin(erc1155Contract.address);
        await erc20Contract.addAdmin(trainingContract.address);
        await erc20Contract.addAdmin(gameTGContract.address);
        // Just for functionality testing, not for game
        await erc20Contract.addAdmin(contractOwner.address);

        await trainingContract.addAdmin(gameTGContract.address);
        // Just for functionality testing, not for game
        await trainingContract.addAdmin(contractOwner.address);

        await erc1155Contract.addAdmin(gameContract.address);
        await erc1155Contract.addAdmin(gameCRContract.address);
        await erc1155Contract.addAdmin(stakingContract.address);
        await erc1155Contract.addAdmin(gameTGContract.address);
        await erc1155Contract.addAdmin(trainingContract.address);
        // Just for functionality testing, not for game
        await erc1155Contract.addAdmin(contractOwner.address);
        
        await nftContract.addAdmin(gameContract.address);
        await nftContract.addAdmin(gameCRContract.address);
        await nftContract.addAdmin(stakingContract.address);
        await nftContract.addAdmin(traitContract.address);
        await nftContract.addAdmin(gameTGContract.address);
        await nftContract.addAdmin(trainingContract.address);
        // Just for functionality testing, not for game
        await nftContract.addAdmin(contractOwner.address);

        await nftContract.setPaused(false);
        await gameContract.setPaused(false);
        await gameCRContract.setPaused(false);
        await stakingContract.setPaused(false);
        await erc1155Contract.setPaused(false);
        await gameTGContract.setPaused(false);
        await trainingContract.setPaused(false);
    });

    it("Can't mint and check traits in same block", async function () {
        await gameContract.setPublicSaleStart(true);
        await network.provider.send("evm_setAutomine", [false]);
        const tx1 = await gameContract.connect(player1).mint(1, false, { value: ethers.utils.parseEther("0.42069") });
        await network.provider.send("evm_mine");
        await tx1.wait();
        await expect(nftContract.connect(player1).balanceOf(player1.address)).to.be.revertedWith("hmmmm what doing?");
        await network.provider.send("evm_mine");
        const tx2 = await gameContract.connect(player1).mint(1, false, { value: ethers.utils.parseEther("0.42069") });
        await network.provider.send("evm_mine");
        await tx2.wait();
        // Don't allow another contract to peep information on an account in the process of being written to
        await expect(nftContract.connect(player2).balanceOf(player1.address)).to.be.revertedWith("hmmmm what doing?");
        // Allow balance to be checked in the next block
        await network.provider.send("evm_mine");
        await expect(nftContract.connect(player1).balanceOf(player1.address)).to.not.be.reverted;
        await expect(nftContract.connect(player2).balanceOf(player1.address)).to.not.be.reverted;

    });

    it("Can't detect if $GP was stolen when claiming", async function () {
        await gameContract.setPublicSaleStart(true);
        await gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.42069") });

        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        const after1day = now.add(3 * DAY_MULTIPLIER); // add 3 days as seconds
        await ethers.provider.send("evm_mine", [after1day.toNumber()]); // fast forward 3 days because the NFT needs to be staked for 2+ days
        await network.provider.send("evm_setAutomine", [false]);

        const preBal = await erc20Contract.connect(player1).balanceOf(player1.address);
        const tx1 = await stakingContract.connect(player1).claimManyFromTowerAndFlight([1], true);
        await network.provider.send("evm_mine");
        await tx1.wait();
        await expect(erc20Contract.connect(player1).balanceOf(player1.address)).to.be.revertedWith("hmmmm what doing?");
        // Try to peep the balance from another account. Should still be disallowed.
        await expect(erc20Contract.connect(player2).balanceOf(player1.address)).to.be.revertedWith("hmmmm what doing?");
        // Allow balance to be checked in the next block
        await network.provider.send("evm_mine");
        await expect(erc20Contract.connect(player1).balanceOf(player1.address)).to.not.be.reverted;
        await expect(erc20Contract.connect(player2).balanceOf(player1.address)).to.not.be.reverted;
    });

    it("Minting from whitelist", async function () {
        await gameContract.addToWhitelist([player1.address]);
        await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.088") }))
            .to.not.be.reverted;
        await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.088") }))
            .to.not.be.reverted;
        // Only allowed 2 mints on whitelist
        await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.088") }))
            .to.be.revertedWith("too many mints");
    });

    it("Dutch auction mint costs", async function () {
        await gameContract.setPublicSaleStart(true);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.42069") }))
            .to.not.be.reverted;
        await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.41069") }))
            .to.be.revertedWith("Invalid payment amount");
        // fast forward time to make sure the price goes down by .01
        await ethers.provider.send("evm_mine", [now.add(600).toNumber()]); // fast forward 10 minutes
        await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.41069") }))
            .to.not.be.reverted;
            await ethers.provider.send("evm_mine", [now.add(1200).toNumber()]); // fast forward 20 minutes
            await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.40069") }))
                .to.not.be.reverted;
        await ethers.provider.send("evm_mine", [now.add(6 * 60 * 60).toNumber()]); // fast forward 6 hours
        // Should be the minimum price of .1
        await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.1") }))
            .to.not.be.reverted;
    });

    it("Can stake from mint and claim", async function () {
        await gameContract.addToWhitelist([player1.address]);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.088") }))
            .to.not.be.reverted;
        await expect(gameContract.connect(player1).mint(1, true, { value: ethers.utils.parseEther("0.088") }))
            .to.not.be.reverted;
        
        await ethers.provider.send("evm_mine", [now.add(1 * 24 * 60 * 60).toNumber()]); // fast forward 1 day and 5 minutes
        const balBefore = await erc20Contract.balanceOf(player1.address);
        await stakingContract.connect(player1).claimManyFromTowerAndFlight([1, 2], false);
        await ethers.provider.send("evm_mine", []);
        const balAfter = await erc20Contract.balanceOf(player1.address);
        // expect to claim 1 days worth of $GP minus the 20% tax
        // There is a 2 $GP wiggle room in the calculation.
        // If this fails, it is likely due to one of the 2 mints being a Dragon
        expect(balAfter.sub(balBefore) < ethers.utils.parseEther("24000").mul(8).div(10).add(ethers.utils.parseEther("2"))
            && balAfter.sub(balBefore) > ethers.utils.parseEther("24000").mul(8).div(10).sub(ethers.utils.parseEther("2")))
            .to.be.true;
    });

    it("Can stake after mint and claim", async function () {
        await gameContract.addToWhitelist([player1.address]);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        await expect(gameContract.connect(player1).mint(2, false, { value: ethers.utils.parseEther("0.088").mul(2) }))
            .to.not.be.reverted;
        await stakingContract.connect(player1).addManyToTowerAndFlight(player1.address, [1, 2]);
        
        await ethers.provider.send("evm_mine", [now.add(1 * 24 * 60 * 60).toNumber()]); // fast forward 1 day and 5 minutes
        const balBefore = await erc20Contract.balanceOf(player1.address);
        await stakingContract.connect(player1).claimManyFromTowerAndFlight([1, 2], false);
        await ethers.provider.send("evm_mine", []);
        const balAfter = await erc20Contract.balanceOf(player1.address);
        // expect to claim 1 days worth of $GP minus the 20% tax
        // There is a 2 $GP wiggle room in the calculation.
        // If this fails, it is likely due to one of the 2 mints being a Dragon
        expect(balAfter.sub(balBefore) < ethers.utils.parseEther("24000").mul(8).div(10).add(ethers.utils.parseEther("2"))
            && balAfter.sub(balBefore) > ethers.utils.parseEther("24000").mul(8).div(10).sub(ethers.utils.parseEther("2")))
            .to.be.true;
    });

    it("erc1155 testing", async function () {
        await expect(erc1155Contract.connect(player1).mint(1, 1, player1.address))
            .to.be.revertedWith("Only admins can call this");
        // The token type of 1 has not been initialized.
        await expect(erc1155Contract.mint(1, 1, player1.address))
            .to.be.revertedWith("All tokens minted");
        await erc1155Contract.setType(1, 2);
        await expect(erc1155Contract.mint(1, 1, player1.address))
            .to.not.be.reverted;
        // Expect a mint above max supply to fail
        await expect(erc1155Contract.mint(1, 2, player1.address))
            .to.be.revertedWith("All tokens minted");
        // Expect a mint exactly matching supply to succeed
        await expect(erc1155Contract.mint(1, 1, player1.address))
            .to.not.be.reverted;

        // minting a token that swaps erc20
        await expect(erc1155Contract.mint(2, 1, contractOwner.address))
            .to.be.revertedWith("All tokens minted");
        await erc1155Contract.setType(2, 999);
        await erc1155Contract.setExchangeAmt(2, ethers.utils.parseEther("20000"));
        await expect(erc1155Contract.mint(2, 1, contractOwner.address))
            .to.be.revertedWith("ERC20: transfer amount exceeds balance");
        await erc20Contract.mint(contractOwner.address, ethers.utils.parseEther("60000"));
        await expect(erc1155Contract.mint(2, 3, contractOwner.address))
            .to.not.be.reverted;
        expect((await erc20Contract.balanceOf(contractOwner.address)).eq(0)).to.be.true;
        await expect(erc1155Contract.burn(2, 3, contractOwner.address))
            .to.not.be.reverted;
        expect((await erc20Contract.balanceOf(contractOwner.address)).eq(ethers.utils.parseEther("60000")))
            .to.be.true;
    });

    it("sacrifice + tribute testing", async function () {
        await erc1155Contract.setType(1, 10);
        await erc1155Contract.setType(2, 10);
        await erc1155Contract.setType(3, 10);
        await erc1155Contract.setType(4, 10);
        await gameContract.setPublicSaleStart(true);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        await ethers.provider.send("evm_mine", [now.add(1 * 24 * 60 * 60).toNumber()]); // fast forward 1 day and 5 minutes
        for (let i = 0; i < MAX_TOKENS / 4; i+=10) {
            const numMints = (i + 10 > MAX_TOKENS / 4) ? MAX_TOKENS / 4 - i : 10;
            // const numMints = 1;
            await expect(gameContract.connect(player1).mint(numMints, true, { value: ethers.utils.parseEther("0.088").mul(numMints) }), "minting")
                .to.not.be.reverted;
        }
        let dragonId = 0;
        let wizardId = 0;
        await ethers.provider.send("evm_mine", []);
        for (let i = 1; i <= MAX_TOKENS / 4; i++) {
            const nft = await nftContract.getTokenTraits(i);
            if(nft[0]) {
                wizardId = i;
            }
            else {
                dragonId = i
            }
            if(dragonId != 0 && wizardId != 0) {
                break;
            }
        }
        // Fast forward a day to get claim $GP for sacrifice
        await ethers.provider.send("evm_mine", [now.add(4 * 24 * 60 * 60).toNumber()]); // fast forward 4 day and 5 minutes
        const tokens = [];
        for (let i = 1; i <= MAX_TOKENS / 4; i++) {
            tokens.push(i);
        }
        await stakingContract.connect(player1).claimManyFromTowerAndFlight(tokens, true);
        await ethers.provider.send("evm_mine", []);
        await gameContract.connect(player1).mint(1, true);
        await ethers.provider.send("evm_mine", []);
        const bal = await erc20Contract.balanceOf(player1.address);
        expect(bal.gt(ethers.utils.parseEther("240000"))).to.be.true;
        //tribute1
        await expect(gameContract.connect(player1).payTribute(ethers.utils.parseEther("24000")), "pay tribute1")
            .to.not.be.reverted;
        await ethers.provider.send("evm_mine", []);
        const balStruct1 = await erc1155Contract.balanceOf(player1.address, 1);
        expect(balStruct1.gt(0), "erc1155 token 1").to.be.true;

        //tribute2
        await expect(gameContract.connect(player1).payTribute(ethers.utils.parseEther("24000").mul(2)), "pay tribute2")
            .to.not.be.reverted;
        
        await ethers.provider.send("evm_mine", []);
        const balStruct2 = await erc1155Contract.balanceOf(player1.address, 2);
        expect(balStruct2.gt(0), "erc1155 token 2").to.be.true;
        //sacrifice3
        await expect(gameContract.connect(player1).sacrifice(wizardId, ethers.utils.parseEther("24000").mul(3)), "sacrifice wizard")
            .to.not.be.reverted;
        const balStruct3 = await erc1155Contract.balanceOf(player1.address, 3);
        expect(balStruct3.gt(0), "erc1155 token 3").to.be.true;
        //sacrifice4
        await expect(gameContract.connect(player1).sacrifice(dragonId, ethers.utils.parseEther("24000").mul(4)), "sacrifice dragon")
            .to.not.be.reverted;
        await ethers.provider.send("evm_mine", []);
        const balStruct4 = await erc1155Contract.balanceOf(player1.address, 4);
        expect(balStruct4.gt(0), "erc1155 token 4").to.be.true;
    });

    it("Disallow transfer after mint to detect stolen", async function () {
        await gameContract.setPublicSaleStart(true);

        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        const after1day = now.add(3 * DAY_MULTIPLIER); // add 3 days as seconds
        await ethers.provider.send("evm_mine", [after1day.toNumber()]); // fast forward 3 days because the NFT needs to be staked for 2+ days
        await network.provider.send("evm_setAutomine", [false]);

        const tx1 = await gameContract.connect(player1).mint(1, false, { value: ethers.utils.parseEther("0.42069") });
        const tx2 = await nftContract.connect(player1).transferFrom(player1.address, player2.address, 1);
        await network.provider.send("evm_mine");
        await tx1.wait();
        await expect(tx2.wait()).to.be.reverted; // Can't check why it reverted due to how it's being mined in tests.
        // Try to peep info about the mint from another account. Should still be disallowed.
        await expect(nftContract.connect(player2).balanceOf(player1.address)).to.be.reverted; // Can't check why it reverted due to how it's being mined in tests.
        await expect(nftContract.connect(player2).ownerOf(1)).to.be.reverted; // Can't check why it reverted due to how it's being mined in tests.
        await expect(nftContract.connect(player2).getTokenTraits(1)).to.be.reverted; // Can't check why it reverted due to how it's being mined in tests.
        // Allow balance to be checked in the next block
        await network.provider.send("evm_mine");
        await expect(nftContract.connect(player2).balanceOf(player1.address)).to.not.be.reverted;
        await expect(nftContract.connect(player2).ownerOf(1)).to.not.be.reverted;
        await expect(nftContract.connect(player2).getTokenTraits(1)).to.not.be.reverted;
    });

    it("Disallow erc20 calls after claim", async function () {
        await gameContract.addToWhitelist([player1.address]);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        await expect(gameContract.connect(player1).mint(1, false, { value: ethers.utils.parseEther("0.088") }))
            .to.not.be.reverted;
        await expect(gameContract.connect(player1).mint(1, false, { value: ethers.utils.parseEther("0.088") }))
            .to.not.be.reverted;
        await stakingContract.connect(player1).addManyToTowerAndFlight(player1.address, [1, 2]);
        await erc20Contract.mint(player1.address, ethers.utils.parseEther("100"));
        await erc20Contract.connect(player1).approve(player1.address, ethers.utils.parseEther("1000000000"));
        
        await ethers.provider.send("evm_mine", [now.add(1 * 24 * 60 * 60).toNumber()]); // fast forward 1 day and 5 minutes
        const balBefore = await erc20Contract.balanceOf(player1.address);
        await network.provider.send("evm_setAutomine", [false]);
        const tx1 = await stakingContract.connect(player1).claimManyFromTowerAndFlight([1, 2], false);
        const tx2 = await erc20Contract.connect(player1).transfer(player2.address, ethers.utils.parseEther("1"));
        const tx3 = await erc20Contract.connect(player1).transfer(player2.address, ethers.utils.parseEther("1000000"));
        const tx4 = await erc20Contract.connect(player1).transferFrom(player1.address, player2.address, ethers.utils.parseEther("1"));
        const tx5 = await erc20Contract.connect(player1).transferFrom(player1.address, player2.address, ethers.utils.parseEther("1000000"));
        await network.provider.send("evm_mine");
        await tx1.wait();
        await expect(erc20Contract.connect(player2).balanceOf(player1.address)).to.be.revertedWith("hmmmm what doing?"); // Can't check why it reverted due to how it's being mined in tests.
        await expect(tx2.wait(), "same block transfer 1").to.be.reverted; // Can't check why it reverted due to how it's being mined in tests.
        await expect(tx3.wait(), "same block transfer 1000000").to.be.reverted; // Can't check why it reverted due to how it's being mined in tests.
        await expect(tx4.wait(), "same block transferFrom 1").to.be.reverted; // Can't check why it reverted due to how it's being mined in tests.
        await expect(tx5.wait(), "same block transferFrom 10000000").to.be.reverted; // Can't check why it reverted due to how it's being mined in tests.
        await network.provider.send("evm_mine");

        const tx6 = await erc20Contract.connect(player1).transfer(player2.address, ethers.utils.parseEther("1"));
        const tx7 = await erc20Contract.connect(player1).transfer(player2.address, ethers.utils.parseEther("1000000"));
        const tx8 = await erc20Contract.connect(player1).transferFrom(player1.address, player2.address, ethers.utils.parseEther("1"));
        const tx9 = await erc20Contract.connect(player1).transferFrom(player1.address, player2.address, ethers.utils.parseEther("1000000"));
        await network.provider.send("evm_mine");
        await expect(tx6.wait(), "transfer 1").to.not.be.reverted;
        await expect(tx7.wait(), "transfer 10000000").to.be.reverted; // This still doesn't have this much erc20 in balance so this should fail
        await expect(tx8.wait(), "transferFrom 1").to.not.be.reverted;
        await expect(tx9.wait(), "transferFrom 10000000").to.be.reverted; // This still doesn't have this much erc20 in balance so this should fail
    });

    it("Commit + reveal scheme works", async function () {
        await stakingContract.setContracts(nftContract.address, erc20Contract.address, gameCRContract.address, randomContract.address);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);

        const value = randomBytes(32);
        const randNum = BigNumber.from(value);

        await expect(gameCRContract.connect(player1).mintCommit(1, false), "commit 1 mint + stake")
            .to.be.revertedWith("ERC20: burn amount exceeds balance");
        await erc20Contract.mint(contractOwner.address, ethers.utils.parseEther("60000"));
        await erc20Contract.mint(player1.address, ethers.utils.parseEther("60000"));
        await erc20Contract.mint(player2.address, ethers.utils.parseEther("60000"));
        await expect(gameCRContract.connect(player1).mintCommit(2, false), "commit 2 mint + not stake")
            .to.not.be.reverted;
        await expect(gameCRContract.connect(player2).mintCommit(2, true), "commit 2 mint + stake")
            .to.not.be.reverted;
        await expect(gameCRContract.connect(player1).mintCommit(2, true), "commit 2 mint + stake fail because already pending")
            .to.be.revertedWith("Already have pending mints");
        await expect(gameCRContract.connect(player1).mintReveal(), "fail reveal 1")
            .to.be.revertedWith("random seed not set");
        await ethers.provider.send("evm_mine", [now.add(1 * 24 * 60 * 60).toNumber()]); // fast forward 1 day and 5 minutes
        await expect(gameCRContract.connect(player1).mintReveal(), "fail reveal 2")
            .to.be.revertedWith("random seed not set");
        await expect(gameCRContract.connect(player1).addCommitRandom(randNum), "add random fail 1")
            .to.be.reverted;
        await expect(gameCRContract.addCommitRandom(randNum), "add random success")
            .to.not.be.reverted;
        await expect(gameCRContract.connect(player1).mintReveal(), "mint reveal success 1")
            .to.not.be.reverted;

        // Add many commit randoms to prove people can still reveal old commit ids
        await expect(gameCRContract.addCommitRandom(randNum), "add random success")
            .to.not.be.reverted;
        await expect(gameCRContract.addCommitRandom(randNum), "add random success")
            .to.not.be.reverted;
        await expect(gameCRContract.addCommitRandom(randNum), "add random success")
            .to.not.be.reverted;
        await expect(gameCRContract.connect(player2).mintCommit(2, true), "commit 1 mint + stake fail because already pending")
            .to.be.revertedWith("Already have pending mints");
        await expect(gameCRContract.connect(player2).mintReveal(), "mint reveal success 1")
            .to.not.be.reverted;

        // ensure everyonr got their NFTs

        await ethers.provider.send("evm_mine", []);
        const bal1 = await nftContract.balanceOf(player1.address);
        const bal2 = await nftContract.balanceOf(player2.address);
        // unstaked
        expect(bal1.eq(2)).to.be.true;
        // staked
        expect(bal2.eq(0)).to.be.true;
    });

    it("GameTG: Commit + reveal scheme works", async function () {
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);

        const value = randomBytes(32);
        const randNum = BigNumber.from(value);

        await expect(gameTGContract.connect(player1).mintCommit(1, false), "commit 1 mint + stake")
            .to.be.revertedWith("ERC20: burn amount exceeds balance");
        await erc20Contract.mint(contractOwner.address, ethers.utils.parseEther("60000"));
        await erc20Contract.mint(player1.address, ethers.utils.parseEther("60000"));
        await erc20Contract.mint(player2.address, ethers.utils.parseEther("60000"));
        await erc20Contract.mint(player3.address, ethers.utils.parseEther("60000"));
        await expect(gameTGContract.connect(player1).mintCommit(2, false), "commit 2 mint + not stake")
            .to.not.be.reverted;
        await expect(gameTGContract.connect(player2).mintCommit(2, false), "commit 2 mint + stake")
            .to.not.be.reverted;
        
        // second commit didn't have enough time pass to be able to reveal first
        const bal1before = await nftContract.balanceOf(player1.address);
        expect(bal1before.eq(0), "commit 1 should not have been revealed").to.be.true;
        await ethers.provider.send("evm_mine", [now.add(6 * 60).toNumber()]); // fast forward 6 minutes

        await expect(gameTGContract.connect(player3).mintCommit(2, true), "player3 commit 2 mint + stake")
            .to.not.be.reverted;

        // third commit had enough time pass to be able to reveal the last item in the previous batch (commit #2)
        const bal2after = await nftContract.balanceOf(player2.address);
        expect(bal2after.eq(2), "commit 2 should be revealed now").to.be.true;

        await ethers.provider.send("evm_mine", [now.add(65 * 60).toNumber()]); // fast forward 1 hour and 5 minutes

        // Now someone can arbitrage the stale commit (commit #1)
        const erc20BalBefore = await erc20Contract.balanceOf(player3.address);
        await expect(gameTGContract.connect(player3).revealOldestMint(), "arb a reveal for GP")
            .to.not.be.reverted;
        await ethers.provider.send("evm_mine", []);
        const erc20BalAfter = await erc20Contract.balanceOf(player3.address);
        // 36000 GP per token mint w/ 2 token mints in commit #1
        expect(erc20BalAfter.sub(erc20BalBefore).eq(ethers.utils.parseEther("36000")), "arbitrage paid GP for the tx").to.be.true;
        await expect(gameTGContract.connect(player3).revealOldestMint(), "arb a reveal for GP")
            .to.not.be.reverted;

        // ensure everyonr got their NFTs

        await ethers.provider.send("evm_mine", []);
        const bal1 = await nftContract.balanceOf(player1.address);
        const bal2 = await nftContract.balanceOf(player2.address);
        // unstaked
        expect(bal1.eq(2)).to.be.true;
        // staked
        expect(bal2.eq(2)).to.be.true;
    });

    it("Training Grounds: Can earn GP in tower", async function () {
        await erc1155Contract.setType(6, 100);
        await erc1155Contract.mint(6, 1, player1.address);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);

        const tokenIds = [];
        for (let i = 1; i <= 20; i++) {
            const value = randomBytes(32);
            const randNum = BigNumber.from(value);
            await nftContract.mint(player1.address, randNum);
            tokenIds.push(i);
        }
        const balBefore = await nftContract.balanceOf(player1.address);
        await trainingContract.addManyToTowerAndFlight(player1.address, tokenIds);
        const balAfter = await nftContract.balanceOf(player1.address);
        expect(balBefore.eq(20)).to.be.true;
        expect(balAfter.eq(0)).to.be.true;

        let dragonId = 0;
        let wizardId = 0;
        await ethers.provider.send("evm_mine", []);
        for (let i = 1; i <= MAX_TOKENS / 4; i++) {
            const nft = await nftContract.getTokenTraits(i);
            if(nft[0]) {
                wizardId = i;
            }
            else {
                dragonId = i
            }
            if(dragonId != 0 && wizardId != 0) {
                break;
            }
        }
        const balBeforeGP = await erc20Contract.balanceOf(player1.address);
        await ethers.provider.send("evm_mine", [now.add(1 * 24 * 60 * 60).toNumber()]); // fast forward 1 day
        await expect(trainingContract.claimManyFromTowerAndFlight(player1.address, [wizardId],false), "claim after 1 day")
            .to.not.be.reverted;
        const balAfterGP = await erc20Contract.balanceOf(player1.address);
        expect(balAfterGP.sub(balBeforeGP).gt(ethers.utils.parseEther("1580")) 
            && balAfterGP.sub(balBeforeGP).lt(ethers.utils.parseEther("1620")), "earned GP at a 20% tax because they contain a whip")
        .to.be.true; // 1600 GP is 80% of the 2000 daily emission
        await expect(trainingContract.claimManyFromTowerAndFlight(player1.address, [dragonId],false), "claim dragon fee after a claim")
            .to.not.be.reverted;
        const balAfterDragonGP = await erc20Contract.balanceOf(player1.address);
        expect(balAfterDragonGP.gt(balAfterGP), "dragon earned GP from previous claim as tax").to.be.true;

    });

    it("Training Grounds: Can earn whips / runes in training grounds", async function () {
        await erc1155Contract.setType(1, 100);
        await erc1155Contract.setType(2, 100);
        await erc1155Contract.setType(3, 100);
        await erc1155Contract.setType(4, 100);
        await erc1155Contract.setType(5, 100);
        await erc1155Contract.setType(6, 100);
        await erc1155Contract.setType(7, 100);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);

        const tokenIds = [];
        for (let i = 1; i <= 20; i++) {
            const value = randomBytes(32);
            const randNum = BigNumber.from(value);
            await nftContract.mint(player1.address, randNum);
            tokenIds.push(i);
        }
        const value = randomBytes(32);
        const randNum = BigNumber.from(value);
        const balBefore = await nftContract.balanceOf(player1.address);
        await trainingContract.addManyToTrainingAndFlight(randNum, player1.address, tokenIds);
        const balAfter = await nftContract.balanceOf(player1.address);
        expect(balBefore.eq(20)).to.be.true;
        expect(balAfter.eq(0)).to.be.true;

        let dragonId = 0;
        let wizardId = 0;
        await ethers.provider.send("evm_mine", []);
        for (let i = 1; i <= MAX_TOKENS / 4; i++) {
            const nft = await nftContract.getTokenTraits(i);
            if(nft[0]) {
                wizardId = i;
            }
            else {
                dragonId = i
            }
            if(dragonId != 0 && wizardId != 0) {
                break;
            }
        }
        const balBeforeWhips = await erc1155Contract.balanceOf(player1.address, 6);
        const balBeforeRunes = await erc1155Contract.balanceOf(player1.address, 7);
        await ethers.provider.send("evm_mine", [now.add(4 * 24 * 60 * 60).add(5 * 60).toNumber()]); // fast forward 2 day + 5 minutes
        // purposefully call the wrong function to make sure nothing happens.
        await expect(trainingContract.claimManyFromTowerAndFlight(player1.address, [wizardId], false), "claim after 2 day")
            .to.be.revertedWith("Invalid token owner");
        await expect(trainingContract.claimManyFromTrainingAndFlight(randNum, player1.address, [wizardId], false), "claim wizard whip")
            .to.not.be.reverted;
        const balAfterWhips = await erc1155Contract.balanceOf(player1.address, 6);
        expect(balAfterWhips.sub(balBeforeWhips).eq(2), "wizard claimed a whip").to.be.true;

        await expect(trainingContract.claimManyFromTrainingAndFlight(randNum, player1.address, [dragonId], false), "claim dragon rune")
            .to.not.be.reverted;
        const balAfterRunes = await erc1155Contract.balanceOf(player1.address, 7);
        expect(balAfterRunes.sub(balBeforeRunes).eq(2), "dragon claimed a rune").to.be.true;
    });

    it("GameTG: claim rewards + staking/unstaking commit+reveal", async function () {
        await erc1155Contract.setType(6, 100);
        await erc1155Contract.setType(7, 100);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);

        await erc20Contract.mint(contractOwner.address, ethers.utils.parseEther("600000"));
        await erc20Contract.mint(player1.address, ethers.utils.parseEther("600000"));
        await erc20Contract.mint(player2.address, ethers.utils.parseEther("600000"));
        await erc20Contract.mint(player3.address, ethers.utils.parseEther("600000"));

        const tokenIds = [];
        for (let i = 1; i <= 20; i++) {
            const value = randomBytes(32);
            const randNum = BigNumber.from(value);
            await nftContract.mint(player1.address, randNum);
            tokenIds.push(i);
        }
        await expect(gameTGContract.connect(player1).addToTrainingCommit([1, 2, 3]), "add to training commit 1")
            .to.not.be.reverted;
        await ethers.provider.send("evm_mine", [now.add(6 * 60).toNumber()]); // fast forward 6 minutes
        const balBefore = await nftContract.balanceOf(player1.address);
        await expect(gameTGContract.connect(player1).addToTrainingCommit([4, 5, 6, 7]), "add to training commit 2")
            .to.not.be.reverted;
        const balAfter = await nftContract.balanceOf(player1.address);
        expect(balBefore.sub(balAfter).eq(3), "3 tokens should have been revealed and moved").to.be.true;

        //forward time and allow arbitrage on the add commit
        await ethers.provider.send("evm_mine", [now.add(68 * 60).toNumber()]); // fast forward 1 hour and 8 minutes
        // Now someone can arbitrage the stale commit (commit #1)
        const erc20BalBefore = await erc20Contract.balanceOf(player3.address);
        await expect(gameTGContract.connect(player3).revealOldestTraining(), "arb a reveal for GP")
            .to.not.be.reverted;
        await ethers.provider.send("evm_mine", []);
        const erc20BalAfter = await erc20Contract.balanceOf(player3.address);
        expect(erc20BalAfter.sub(erc20BalBefore).eq(ethers.utils.parseEther("36000")), "arbitrage paid GP for the tx").to.be.true;
        await expect(gameTGContract.connect(player3).revealOldestTraining(), "arb a reveal for GP")
            .to.not.be.reverted;
        await expect(gameTGContract.connect(player3).revealOldestTraining(), "arb a reveal for GP")
            .to.not.be.reverted;
        // claim commit
        await ethers.provider.send("evm_mine", [now.add(120 * 60).toNumber()]); // fast forward 2 hours
        await expect(gameTGContract.connect(player1).claimTrainingsCommit([1, 2], false, true), "claim training commit 1")
            .to.not.be.reverted;
        // forward time and second claim commit, ensure first commits were revealed
        await ethers.provider.send("evm_mine", [now.add(2 * 24 * 60 * 60).add(20 * 60).toNumber()]); // fast forward 2 days 20 minutes
        const whipBalBefore = await erc1155Contract.balanceOf(player1.address, 6);
        await expect(gameTGContract.connect(player1).claimTrainingsCommit([3, 4, 5], true, true), "claim training commit 2")
            .to.not.be.reverted;
        const whipBalAfter = await erc1155Contract.balanceOf(player1.address, 6);
        expect(whipBalAfter.sub(whipBalBefore).gt(0), "emitted whips").to.be.true;
        // forward time and allow arbitrage on the claim commit
        await ethers.provider.send("evm_mine", [now.add(4 * 24 * 60 * 60).add(20 * 60).toNumber()]); // fast forward 2 days 20 minutes
        const nftBalBefore = await nftContract.balanceOf(player1.address);
        await expect(gameTGContract.connect(player3).revealOldestTraining(), "arb a reveal for GP 1")
            .to.not.be.reverted;
        await expect(gameTGContract.connect(player3).revealOldestTraining(), "arb a reveal for GP 2")
        .to.not.be.reverted;
        await expect(gameTGContract.connect(player3).revealOldestTraining(), "arb a reveal for GP 3")
            .to.not.be.reverted;
        const nftBalAfter = await nftContract.balanceOf(player1.address);
        expect(nftBalAfter.sub(nftBalBefore).gt(0), "unstake commit was revealed").to.be.true;
    });

    it("Training Grounds: train mini game awards erc1155s, can burn wizards, and takes GP (after 2 spins if gen0)", async function () {
        
    });

    it("GameTG: training minigame commit+reveal", async function () {
        
    });
  
  });