import { BigNumber, PayableOverrides } from "@ethereum-waffle/provider/node_modules/ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { AuctionMint, TestERC20Token, ERC721Stakable, Staking } from "../typechain";

describe("AuctionMints", function () {
    
    let auctionContract: AuctionMint;
    let erc20Contract: TestERC20Token;
    let stakingContract: Staking;
    let erc721Stakable: ERC721Stakable;
    let accounts: SignerWithAddress[];
    let contractOwner: SignerWithAddress;
    let bidder1: SignerWithAddress;
    let bidder2: SignerWithAddress;
    let bidder3: SignerWithAddress;
    let bidder4: SignerWithAddress;

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        contractOwner = accounts[0];
        bidder1 = accounts[1];
        bidder2 = accounts[2];
        bidder3 = accounts[3];
        bidder4 = accounts[4];
        const contractFactory = await ethers.getContractFactory("AuctionMint", contractOwner);
        auctionContract = await (await contractFactory.deploy(BigNumber.from(3))).deployed();
        const erc20Factory = await ethers.getContractFactory("TestERC20Token", contractOwner);
        erc20Contract = await (await erc20Factory.deploy(BigNumber.from(1000000000))).deployed();
        const stakableFactory = await ethers.getContractFactory("ERC721Stakable", contractOwner);
        erc721Stakable = await (await stakableFactory.deploy()).deployed();
        await erc721Stakable.unpause();

        const RATE = ethers.utils
            .parseUnits('5', 18)
            .div(ethers.BigNumber.from('6000'));
        const EXPIRATION = ethers.BigNumber.from('42000');

        const stakingFactory = await ethers.getContractFactory("Staking", contractOwner);
        stakingContract = await (await stakingFactory.deploy(erc721Stakable.address,RATE,EXPIRATION,erc20Contract.address)).deployed();
        await stakingContract.unpause();
    });

    it("Bid cannot be placed until contract is set up", async function () {
        await expect(auctionContract.connect(bidder1).bid(1, {
            value: "50000000000000000"
        })).to.be.revertedWith("Pausable: paused");
        await expect(auctionContract.startCurrentAuction()).to.be.revertedWith("Contracts not set");
        await auctionContract.setContracts(erc20Contract.address, stakingContract.address);
        await auctionContract.startCurrentAuction();
        await expect(auctionContract.connect(bidder1).bid(1, {
            value: "50000000000000000"
        })).to.emit(auctionContract, "BidPlaced");
    });

    it("Bid cannot be placed after an auction ends", async function () {
        await auctionContract.setContracts(erc20Contract.address, stakingContract.address);
        await auctionContract.startCurrentAuction();
        await auctionContract.endCurrentAuction();
        await expect(auctionContract.connect(bidder1).bid(1, {
            value: "50000000000000000"
        })).to.be.revertedWith("Pausable: paused");
    });

    it("Cannot start an ended auction", async function () {
        await auctionContract.setContracts(erc20Contract.address, stakingContract.address);
        await auctionContract.startCurrentAuction();
        await auctionContract.endCurrentAuction();
        await expect(auctionContract.startCurrentAuction()).to.be.revertedWith("Auction cannot be started again");
    });

    it("Cannot go past the maximum number of auctions", async function () {
        await auctionContract.setContracts(erc20Contract.address, stakingContract.address);
        const maxAuctions = await auctionContract.NUM_AUCTIONS();
        for (let i = 0; BigNumber.from(i) < maxAuctions; i++) {
            await auctionContract.startCurrentAuction();
            await auctionContract.endCurrentAuction();
            if(BigNumber.from(i) < maxAuctions.sub(1)) {
                await auctionContract.incrementAuction();
            }
        }
        await expect(auctionContract.startCurrentAuction()).to.be.revertedWith("Auction cannot be started again");
        await expect(auctionContract.incrementAuction()).to.be.revertedWith("Max number of auctions reached.");
    });

    it("Auction accepts 19 bids", async function () {
        await auctionContract.setContracts(erc20Contract.address, stakingContract.address);
        await auctionContract.startCurrentAuction();
        for (let i = 0; i < 19; i++) {
            if(i % 100 == 0) {
                console.log(i);
            }
            const addrCur = accounts[i];
            const times = (Math.floor(Math.random() * 6) + 1);
            const ethAmt = (Math.floor(Math.random() * 6) + 1) * 0.05 * 100 * times; // Give a random eth amount in intervals of .05 as a wei amount
            const payable1: PayableOverrides = {
                value: `${Math.floor(ethAmt)}0000000000000000`,
            };
            (await auctionContract.connect(addrCur).bid(times, payable1)).wait();
        }
    });

    async function performAuction(optionalBidCallback?: () => Promise<void>) {
        await auctionContract.startCurrentAuction();
        (await auctionContract.connect(bidder1).bid(4, {
            value: ethers.utils.parseEther("0.04"),
        })).wait();
        (await auctionContract.connect(bidder2).bid(1, {
            value: ethers.utils.parseEther("0.02"),
        })).wait();
        (await auctionContract.connect(bidder3).bid(1, {
            value: ethers.utils.parseEther("0.01"),
        })).wait();
        if(optionalBidCallback) {
            await optionalBidCallback();
        }
        await auctionContract.endCurrentAuction();
        await auctionContract.pickWinners([bidder2.address, bidder1.address, bidder3.address]);
        await auctionContract.incrementAuction();
        await auctionContract.startCurrentAuction();
        await auctionContract.endCurrentAuction();
        await auctionContract.incrementAuction();
        await auctionContract.startCurrentAuction();
        await auctionContract.endCurrentAuction();
    }

    it("Auction takes the highest 3 mints", async function () {
        await auctionContract.setContracts(erc20Contract.address, stakingContract.address);
        await performAuction();
        await auctionContract.connect(bidder1).claimAuctionMints();
        await auctionContract.connect(bidder2).claimAuctionMints();
        // expect mints to be claimable
        expect(await auctionContract.connect(bidder1).balanceOf(bidder1.address), "bidder1 should have 2 nfts")
            .to.equal(BigNumber.from(2));
        expect(await auctionContract.connect(bidder2).balanceOf(bidder2.address), "bidder2 should have 1 nft")
            .to.equal(BigNumber.from(1));

        //expect failed mints for losing bids
        await expect(auctionContract.connect(bidder1).claimAuctionMints(), "bidder3 should not mint")
        .to.be.revertedWith("Address didn't win auction");

        //expect refunds not allowed until enabled
        await expect(auctionContract.connect(bidder3).claimRefund()).to.be.revertedWith("Refunds currently not allowed.");
        await auctionContract.setAllowRefunds(true);

        //expect losing bids to be refundable
        const bidder3bal = await bidder3.getBalance();
        await auctionContract.connect(bidder3).claimRefund();
        const bidder3balNew = await bidder3.getBalance();
        expect(bidder3bal < bidder3balNew, "claimRefund should put eth in the bidder3's balance").to.equal(true);

        const bidder1bal = await bidder1.getBalance();
        await auctionContract.connect(bidder1).claimRefund();
        const bidder1balNew = await bidder1.getBalance();
        expect(bidder1bal < bidder1balNew, "claimRefund should put eth in the bidder1's balance").to.equal(true);
    });

    it("Auction owner can refund all losing bids", async function () {
        await auctionContract.setContracts(erc20Contract.address, stakingContract.address);
        await performAuction();

        //expect losing bids to be refundable
        const bidder1bal = await bidder1.getBalance();
        const bidder2bal = await bidder2.getBalance();
        const bidder3bal = await bidder3.getBalance();
        await auctionContract.refundBidders([bidder1.address,bidder2.address,bidder3.address]);
        const bidder1balNew = await bidder1.getBalance();
        const bidder2balNew = await bidder2.getBalance();
        const bidder3balNew = await bidder3.getBalance();
        expect(bidder3bal < bidder3balNew, "refundBidders should put eth in the bidder3's balance").to.equal(true);
        expect(bidder1bal < bidder1balNew, "refundBidders should put eth in the bidder1's balance").to.equal(true);
        expect(bidder2bal.toBigInt() == bidder2balNew.toBigInt(), "refundBidders should NOT put eth in the bidder2's balance").to.equal(true);
    });

    it("Auction requiring erc20 payment takes and gives back erc20s when appropriate", async function () {
        await auctionContract.setContracts(erc20Contract.address, stakingContract.address);
        await auctionContract.setERC20HoldingAmount(BigNumber.from(10));
        // give everyone enough ERC20 tokens to bid except bidder4
        await (await erc20Contract.connect(bidder1).approve(auctionContract.address, "30000000000000000000000000")).wait();
        await (await erc20Contract.connect(bidder2).approve(auctionContract.address, "30000000000000000000000000")).wait();
        await (await erc20Contract.connect(bidder3).approve(auctionContract.address, "30000000000000000000000000")).wait();
        await (await erc20Contract.connect(bidder4).approve(auctionContract.address, "30000000000000000000000000")).wait();
        erc20Contract.transfer(bidder1.address, BigNumber.from(10));
        erc20Contract.transfer(bidder2.address, BigNumber.from(10));
        erc20Contract.transfer(bidder3.address, BigNumber.from(10));
        erc20Contract.transfer(bidder4.address, BigNumber.from(2));

        await erc721Stakable.connect(bidder1).mint(1, {
            value: ethers.utils.parseEther("0.02"),
        });
        await erc721Stakable.connect(bidder1).setApprovalForAll(stakingContract.address, true);
        await stakingContract.connect(bidder1).deposit([BigNumber.from(1)]);
        
        await erc721Stakable.connect(bidder2).mint(1, {
            value: ethers.utils.parseEther("0.02"),
        });
        await erc721Stakable.connect(bidder2).setApprovalForAll(stakingContract.address, true);
        await stakingContract.connect(bidder2).deposit([BigNumber.from(2)]);
        
        await erc721Stakable.connect(bidder3).mint(1, {
            value: ethers.utils.parseEther("0.02"),
        });
        await erc721Stakable.connect(bidder3).setApprovalForAll(stakingContract.address, true);
        await stakingContract.connect(bidder3).deposit([BigNumber.from(3)]);

        await performAuction(async () => {
            await expect(auctionContract.connect(bidder4).bid(2, {
                value: ethers.utils.parseEther("0.04"),
            })).to.be.revertedWith("Not enough ERC20 tokens");
        });

        //expect losing bids to be refundable
        const bidder1bal = await erc20Contract.connect(bidder1).balanceOf(bidder1.address);
        const bidder2bal = await erc20Contract.connect(bidder2).balanceOf(bidder2.address);
        const bidder3bal = await erc20Contract.connect(bidder3).balanceOf(bidder3.address);
        await auctionContract.refundBidders([bidder1.address,bidder2.address,bidder3.address]);
        const bidder1balNew = await erc20Contract.connect(bidder1).balanceOf(bidder1.address);
        const bidder2balNew = await erc20Contract.connect(bidder2).balanceOf(bidder2.address);
        const bidder3balNew = await erc20Contract.connect(bidder3).balanceOf(bidder3.address);
        expect(bidder3bal < bidder3balNew, "refundBidders should give ERC20 tokens back in the bidder3's balance").to.equal(true);
        expect(bidder1bal < bidder1balNew, "refundBidders should give ERC20 tokens back in the bidder1's balance").to.equal(true);
        expect(bidder2bal.toBigInt() == bidder2balNew.toBigInt(), "refundBidders should NOT give ERC20 tokens back in the bidder2's balance").to.equal(true);
    });
  
  });