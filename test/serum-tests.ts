import { BigNumber, PayableOverrides } from "@ethereum-waffle/provider/node_modules/ethers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ERC721PreMinted, TestERC20Token, SerumStaking } from "../typechain";

describe("Serum Staking", function () {

    const DAY_MULTIPLIER = 24 * 60 * 60;
    const SERUM = 1;

    let accounts: SignerWithAddress[];
    let contractOwner: SignerWithAddress;
    let staker1: SignerWithAddress;
    let staker2: SignerWithAddress;
    let staker3: SignerWithAddress;
    
    let stakingContract: SerumStaking;
    let erc20Contract: TestERC20Token;
    let erc721Contract: ERC721PreMinted;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        contractOwner = accounts[0];
        staker1 = accounts[1];
        staker2 = accounts[2];
        staker3 = accounts[3];

        const erc20Factory = await ethers.getContractFactory("TestERC20Token", contractOwner);
        erc20Contract = await (await erc20Factory.deploy(BigNumber.from(1000000000))).deployed();

        const erc721Factory = await ethers.getContractFactory("ERC721PreMinted", contractOwner);
        erc721Contract = await (await erc721Factory.deploy()).deployed();

        const contractFactory = await ethers.getContractFactory("SerumStaking", contractOwner);
        stakingContract = await (await contractFactory.deploy("")).deployed();

        await stakingContract.setContracts(erc721Contract.address, erc20Contract.address);
        await (await erc20Contract.approve(stakingContract.address, "30000000000000000000000000")).wait();
        await stakingContract.unpause();

        await (await erc20Contract.connect(staker1).approve(stakingContract.address, "30000000000000000000000000")).wait();
        await (await erc20Contract.connect(staker2).approve(stakingContract.address, "30000000000000000000000000")).wait();
        await (await erc20Contract.connect(staker3).approve(stakingContract.address, "30000000000000000000000000")).wait();

        await erc721Contract.connect(staker1).setApprovalForAll(stakingContract.address, true);
        await erc721Contract.connect(staker2).setApprovalForAll(stakingContract.address, true);
        await erc721Contract.connect(staker3).setApprovalForAll(stakingContract.address, true);
    });

    it("Can only claim 1 elixir after 60 days", async function () {
        await erc20Contract.transfer(staker1.address, ethers.utils.parseEther("100000"));
        await erc721Contract.connect(staker1).mintFree(1);
        await stakingContract.connect(staker1).deposit([BigNumber.from(1)]);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        const after30days = now.add(30 * DAY_MULTIPLIER); // add 30 days as seconds
        const after60days = now.add(60 * DAY_MULTIPLIER); // add 60 days as seconds

        await ethers.provider.send("evm_mine", [after30days.toNumber()]); // fast forward 30 days

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.be.revertedWith("No elixir to claim");

        await ethers.provider.send("evm_mine", [after60days.toNumber()]); // fast forward 60 days

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.not.be.reverted;
        const elixirBal = await stakingContract.balanceOf(staker1.address, SERUM);
        expect(elixirBal).to.equal(BigNumber.from(1));
    });

    it("Can claim 1 elixir in 30 days with 51 fish", async function () {
        await erc20Contract.transfer(staker1.address, ethers.utils.parseEther("100000"));
        await erc721Contract.connect(staker1).mintFree(1);
        await stakingContract.connect(staker1).deposit([BigNumber.from(1)]);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        const after29days = now.add(29 * DAY_MULTIPLIER); // add 29 days as seconds
        const after30days = now.add(30 * DAY_MULTIPLIER); // add 30 days as seconds
        const fish = ethers.utils.parseEther("51");
        await stakingContract.connect(staker1).feedGorilla(BigNumber.from(1), fish);

        await ethers.provider.send("evm_mine", [after29days.toNumber()]); // fast forward 29 days

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.be.revertedWith("No elixir to claim");

        await ethers.provider.send("evm_mine", [after30days.toNumber()]); // fast forward 30 days

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.not.be.reverted;

        const elixirBal = await stakingContract.balanceOf(staker1.address, SERUM);
        expect(elixirBal).to.equal(BigNumber.from(1));
    });

    it("Can claim 1 elixir in 45 days with 26 fish", async function () {
        await erc20Contract.transfer(staker1.address, ethers.utils.parseEther("100000"));
        await erc721Contract.connect(staker1).mintFree(1);
        await stakingContract.connect(staker1).deposit([BigNumber.from(1)]);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        const after44days = now.add(44 * DAY_MULTIPLIER); // add 44 days as seconds
        const after45days = now.add(45 * DAY_MULTIPLIER); // add 45 days as seconds
        const fish = ethers.utils.parseEther("26");
        
        await expect(stakingContract.connect
            (staker1).getClaimableSerumAmt(staker1.address))
            .to.not.be.reverted;

        expect(await stakingContract.connect
            (staker1).getClaimableSerumAmt(staker1.address)).to.equal(BigNumber.from(0));

        await stakingContract.connect(staker1).feedGorilla(BigNumber.from(1), fish);
        
        await expect(stakingContract.connect
            (staker1).getClaimableSerumAmt(staker1.address))
            .to.not.be.reverted;

        await ethers.provider.send("evm_mine", [after44days.toNumber()]); // fast forward 44 days

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.be.revertedWith("No elixir to claim");

        await ethers.provider.send("evm_mine", [after45days.toNumber()]); // fast forward 45 days

        expect(await stakingContract.connect
            (staker1).getClaimableSerumAmt(staker1.address)).to.equal(BigNumber.from(1));

        await expect(stakingContract.connect
            (staker1).getClaimableSerumAmt(staker1.address))
            .to.not.be.reverted;

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.not.be.reverted;

        const elixirBal = await stakingContract.balanceOf(staker1.address, SERUM);
        expect(elixirBal).to.equal(BigNumber.from(1));
    });

    it("Can claim 1 elixir in 52 days with 11 fish", async function () {
        await erc20Contract.transfer(staker1.address, ethers.utils.parseEther("100000"));
        await erc721Contract.connect(staker1).mintFree(1);
        await stakingContract.connect(staker1).deposit([BigNumber.from(1)]);
        const blockNumber = ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber)
        const now = BigNumber.from(block.timestamp);
        const after52days = now.add(52 * DAY_MULTIPLIER); // add 52 days as seconds
        const after53days = now.add(53 * DAY_MULTIPLIER); // add 53 days as seconds
        const fish = ethers.utils.parseEther("11");
        await stakingContract.connect(staker1).feedGorilla(BigNumber.from(1), fish);

        await ethers.provider.send("evm_mine", [after52days.toNumber()]); // fast forward 52 days

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.be.revertedWith("No elixir to claim");

        await ethers.provider.send("evm_mine", [after53days.toNumber()]); // fast forward 53 days

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.not.be.reverted;

        const elixirBal = await stakingContract.balanceOf(staker1.address, SERUM);
        expect(elixirBal).to.equal(BigNumber.from(1));

        // make sure going for a second elixir works after 60 days since the fish should be removed

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.be.revertedWith("No elixir to claim");

        const after59Moredays = after53days.add(59 * DAY_MULTIPLIER); // add 59 days as seconds
        const after60Moredays = after53days.add(60 * DAY_MULTIPLIER); // add 60 days as seconds

        await ethers.provider.send("evm_mine", [after59Moredays.toNumber()]); // fast forward 44 days

        await expect(stakingContract.connect
            (staker1).claimSerum())
            .to.be.revertedWith("No elixir to claim");

            await ethers.provider.send("evm_mine", [after60Moredays.toNumber()]); // fast forward 53 days
    
            await expect(stakingContract.connect
                (staker1).claimSerum())
                .to.not.be.reverted;
    
            const elixirBal2 = await stakingContract.balanceOf(staker1.address, SERUM);
            expect(elixirBal2).to.equal(BigNumber.from(2));

    });


  });