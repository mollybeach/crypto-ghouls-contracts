import { BigNumber, PayableOverrides } from "@ethereum-waffle/provider/node_modules/ethers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Vesting, TestERC20Token } from "../typechain";

describe("Vesting", function () {

    let accounts: SignerWithAddress[];
    let contractOwner: SignerWithAddress;
    let vestor1: SignerWithAddress;
    let vestor2: SignerWithAddress;
    let vestor3: SignerWithAddress;
    
    let vestingContract: Vesting;
    let erc20Contract: TestERC20Token;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        contractOwner = accounts[0];
        vestor1 = accounts[1];
        vestor2 = accounts[2];

        const erc20Factory = await ethers.getContractFactory("TestERC20Token", contractOwner);
        erc20Contract = await (await erc20Factory.deploy(BigNumber.from(1000000000))).deployed();

        const contractFactory = await ethers.getContractFactory("Vesting", contractOwner);
        vestingContract = await (await contractFactory.deploy(erc20Contract.address)).deployed();

        await (await erc20Contract.approve(vestingContract.address, "30000000000000000000000000")).wait();
        await erc20Contract.transfer(vestingContract.address, ethers.utils.parseEther("100000"));
    });

    it("Setting up a schedule and claiming vestings", async function () {
        await expect(vestingContract.connect(vestor1).claimVestingRewards())
            .to.be.revertedWith("Sender not in any schedules");
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        // const now = BigNumber.from((new Date().getTime() / 1000).toFixed(0));
        const now = BigNumber.from(block.timestamp);
        const numVests = BigNumber.from(3);
        const startTime = now;
        let endTime = now;
        await expect(vestingContract.createNewVestingSchedule(startTime, endTime, numVests))
            .to.be.revertedWith("endTime must be after startTime");
        endTime = endTime.add(3600 * 3); // Add 3 hours
        await expect(vestingContract.createNewVestingSchedule(startTime, endTime, numVests))
            .to.not.be.reverted;
        await expect(vestingContract.createNewVestingSchedule(startTime, endTime, numVests))
            .to.be.revertedWith("Vesting schedule already exists");
        const allSchedules = await vestingContract.getAllVestingSchedules();
        expect(allSchedules.length > 0 && allSchedules[0].eq(startTime), "Schedule was not created")
            .to.equal(true);
        // add a vestor
        const vestor1TotalTokenAmt = ethers.utils.parseEther("30");
        await expect(vestingContract.addToVestings(startTime.add(1), vestor1.address, vestor1TotalTokenAmt))
            .to.be.revertedWith("Invalid vesting schedule");
        await expect(vestingContract.addToVestings(startTime, vestor1.address, vestor1TotalTokenAmt))
            .to.not.be.reverted;
        const vestor1Schedules = await vestingContract.getSchedulesForVestor(vestor1.address);
        expect(vestor1Schedules.length > 0 && vestor1Schedules[0].eq(startTime), "Vestor1 was not assigned to schedule")
            .to.equal(true);
        // Start schedule
        await vestingContract.startVestingSchedule(startTime);
        // claim before time expect revert
        await expect(vestingContract.connect
            (vestor1).claimVestingRewards())
            .to.be.revertedWith("No rewards to claim");
        // forward time
        await ethers.provider.send("evm_mine", [startTime.add(3601).toNumber()]); // fast forward 1 hour and 1 minute
        // claim and expect success + expect 1 vest
        await expect(vestingContract.connect
            (vestor1).claimVestingRewards())
            .to.not.be.reverted;
        const vestor1tokens = await erc20Contract.balanceOf(vestor1.address);
        expect(vestor1tokens, "Vestor should have 1/3 of the vesting schedule")
            .to.equal(vestor1TotalTokenAmt.div(3), "Wrong token amount claimed for vestor1");
        // forward time past end
        await ethers.provider.send("evm_mine", [endTime.add(3601).toNumber()]); // ffast forward way past the end of the schedule
        // claim and expect success + retreived 2 vests at once
        await expect(vestingContract.connect
            (vestor1).claimVestingRewards())
            .to.not.be.reverted;
        const vestor1tokens2 = await erc20Contract.balanceOf(vestor1.address);
        expect(vestor1tokens2, "Vestor should have 3/3 of the vesting schedule")
            .to.equal(vestor1TotalTokenAmt, "Wrong token amount claimed for vestor1");
    });

    it("Multiple vestors in a schedule and a vestor in multiple schedules", async function () {
        // set up 2 schedules
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        // const now = BigNumber.from((new Date().getTime() / 1000).toFixed(0));
        const now = BigNumber.from(block.timestamp);
        const numVests = BigNumber.from(3);
        const startTime1 = now;
        const startTime2 = now.add(1800); // Stagger schedule2 by 30 minutes 
        let endTime1 = now.add(3600 * 3); // Add 3 hours
        let endTime2 = now.add(3600 * 3 + 1800); // Add 3.5 hours
        await expect(vestingContract.createNewVestingSchedule(startTime1, endTime1, numVests))
            .to.not.be.reverted;
        await expect(vestingContract.createNewVestingSchedule(startTime2, endTime2, numVests))
            .to.not.be.reverted;
        // add 2 vestors to 1, and one of the same to 2
        const vestor1TotalTokenAmt = ethers.utils.parseEther("30");
        const vestor2TotalTokenAmt = ethers.utils.parseEther("60");
        const vestor2TotalTokenAmt2 = ethers.utils.parseEther("90");
        await expect(vestingContract.addToVestings(startTime1, vestor1.address, vestor1TotalTokenAmt))
            .to.not.be.reverted;
        await expect(vestingContract.addToVestings(startTime1, vestor2.address, vestor2TotalTokenAmt))
            .to.not.be.reverted;
        await expect(vestingContract.addToVestings(startTime2, vestor2.address, vestor2TotalTokenAmt2))
            .to.not.be.reverted;
        // start schedules
        await expect(vestingContract.startVestingSchedule(startTime1))
            .to.not.be.reverted;
        await expect(vestingContract.startVestingSchedule(startTime2))
            .to.not.be.reverted;
        // Forward time to have both in 1 claim 1 vest
        await ethers.provider.send("evm_mine", [startTime1.add(3601).toNumber()]); // fast forward 1 hour and 1 minute
        await expect(vestingContract.connect
            (vestor1).claimVestingRewards())
            .to.not.be.reverted;
        await expect(vestingContract.connect
            (vestor2).claimVestingRewards())
            .to.not.be.reverted;
        const vestor1tokens = await erc20Contract.balanceOf(vestor1.address);
        const vestor2tokens = await erc20Contract.balanceOf(vestor2.address);
        expect(vestor1tokens, "Vestor1 should have 1/3 of the vesting schedule")
            .to.equal(vestor1TotalTokenAmt.div(3), "Wrong token amount claimed for vestor1");
        expect(vestor2tokens, "Vestor2 should have 1/3 of the vesting schedule")
            .to.equal(vestor2TotalTokenAmt.div(3), "Wrong token amount claimed for vestor2");
        // Forward time to have the 1 in both schedules claim both
        await ethers.provider.send("evm_mine", [startTime1.add(3600 * 2 + 1).toNumber()]); // fast forward 2 hours and 1 minute
        await expect(vestingContract.connect
            (vestor2).claimVestingRewards())
            .to.not.be.reverted;
        const vestor2tokensNew = await erc20Contract.balanceOf(vestor2.address);
        expect(vestor2tokensNew.sub(vestor2tokens), "Vestor2 should have 1/3 of the vesting schedule")
            .to.equal(vestor2TotalTokenAmt.div(3).add(vestor2TotalTokenAmt2.div(3)), "Wrong token amount claimed for vestor2");
        // fast forward to the end and have everyone vest
        await ethers.provider.send("evm_mine", [startTime1.add(3600 * 4 + 1).toNumber()]); // fast forward 4 hours and 1 minute
        await expect(vestingContract.connect
            (vestor1).claimVestingRewards())
            .to.not.be.reverted;
        await expect(vestingContract.connect
            (vestor2).claimVestingRewards())
            .to.not.be.reverted;
        // assert that both vestors have the correct token amounts
        const vestor1tokensFinal = await erc20Contract.balanceOf(vestor1.address);
        const vestor2tokensFinal = await erc20Contract.balanceOf(vestor2.address);
        expect(vestor1tokensFinal, "Vestor1 should have 3/3 of the vesting schedule")
            .to.equal(vestor1TotalTokenAmt, "Wrong token amount claimed for vestor1");
        expect(vestor2tokensFinal, "Vestor2 should have 3/3 of BOTH of the vesting schedules")
            .to.equal(vestor2TotalTokenAmt.add(vestor2TotalTokenAmt2), "Wrong token amount claimed for vestor2");
    });
  
  });