import { BigNumber, PayableOverrides } from "@ethereum-waffle/provider/node_modules/ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SpookyCreatures, TestERC20Token, ERC721Stakable, Staking, ERC721PreMinted } from "../typechain";

describe("SpookyCreatures", function () {
    this.timeout(100000);
    
    let hcContract: SpookyCreatures;
    let erc20Contract: TestERC20Token;
    let stakingContract: Staking;
    let erc721Stakable: ERC721Stakable;
    let erc721: ERC721PreMinted;
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
        const contractFactory = await ethers.getContractFactory("SpookyCreatures", contractOwner);
        hcContract = await (await contractFactory.deploy()).deployed();
        const stakableFactory = await ethers.getContractFactory("ERC721Stakable", contractOwner);
        erc721Stakable = await (await stakableFactory.deploy()).deployed();
        const erc20Factory = await ethers.getContractFactory("TestERC20Token", contractOwner);
        erc20Contract = await (await erc20Factory.deploy(BigNumber.from(1000000000))).deployed();
        const preMintFactory = await ethers.getContractFactory("ERC721PreMinted", contractOwner);
        erc721 = await (await preMintFactory.deploy()).deployed();
        await erc721Stakable.unpause();

        const RATE = ethers.utils
            .parseUnits('5', 18)
            .div(ethers.BigNumber.from('6000'));
        const EXPIRATION = ethers.BigNumber.from('42000');

        const stakingFactory = await ethers.getContractFactory("Staking", contractOwner);
        stakingContract = await (await stakingFactory.deploy(erc721Stakable.address,RATE,EXPIRATION,erc20Contract.address)).deployed();
        await stakingContract.unpause();
    });

    async function performSetup() {
        await hcContract.setContracts(erc721.address, erc721Stakable.address, stakingContract.address);
        await hcContract.unpause();
    }

    it("Does't allow minting when not set up, only allow public mint when enabled", async function () {
        await expect(hcContract.mintPublic(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.be.revertedWith("Pausable: paused");
        await expect(hcContract.unpause()).to.be.revertedWith("creaturesNFT not set");
        await performSetup();
        await hcContract.setSales(false, true);
        expect(await hcContract.mintPublic(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        }), "allow public mint after setup").to.emit(hcContract, "Transfer");
    });

    it("PreSale won't work when not enabled, whitelist mint only works if added to whitelist", async function () {
        await performSetup();
        await expect(hcContract.mintWhitelistPresale(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.be.revertedWith("Presale is not live");
        await hcContract.setSales(true, false);
        await expect(hcContract.mintWhitelistPresale(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.be.revertedWith("Not on whitelist");
        await hcContract.addToWhitelist([contractOwner.address]);
        await expect(hcContract.mintWhitelistPresale(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.emit(hcContract, "Transfer");
    });

    it("PreSale holder mint only if holding an NFT in contract1", async function () {
        await performSetup();
        await hcContract.setSales(true, false);
        await expect(hcContract.mintHolderPresale(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.be.revertedWith("Must hold a creature or bigGarden");
        await erc721Stakable.mint(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.02"),
        });
        await expect(hcContract.mintHolderPresale(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.emit(hcContract, "Transfer");
    });

    it("PreSale holder mint only if holding an NFT in contract2", async function () {
        await performSetup();
        await hcContract.setSales(true, false);
        await erc721.mintFree(BigNumber.from(1));
        await expect(hcContract.mintHolderPresale(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.emit(hcContract, "Transfer");
    });

    it("PreSale holder mint only if staking an NFT in staking contract", async function () {
        await performSetup();
        await hcContract.setSales(true, false);
        await erc721Stakable.mint(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.02"),
        });
        await erc721Stakable.setApprovalForAll(stakingContract.address, true);
        await stakingContract.deposit([BigNumber.from(1)]);
        await expect(hcContract.mintHolderPresale(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.emit(hcContract, "Transfer");
    });

    it("Public sale, disallow more than max wallet mints", async function () {
        await performSetup();
        await hcContract.setSales(false, true);
        await expect(hcContract.mintPublic(BigNumber.from(6), {
            value: ethers.utils.parseEther("0.0666").mul(6),
        })).to.be.revertedWith("Too many mints for this wallet");
        await hcContract.mintPublic(BigNumber.from(5), {
            value: ethers.utils.parseEther("0.0666").mul(5),
        });
        await expect(hcContract.mintPublic(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.be.revertedWith("Too many mints for this wallet");
    });

    it("Total supplies are correct", async function () {
        await performSetup();
        await hcContract.teamMint();
        const teamMintAmt = BigNumber.from(50); // Value of the MAX_TEAM_SUPPLY variable
        expect(await hcContract.balanceOf(contractOwner.address), "Should have team mint amount").to.equal(teamMintAmt);
        await hcContract.setSales(true, false);
        await hcContract.setMaxMintsPerWallet(BigNumber.from(10000));
        await hcContract.addToWhitelist([contractOwner.address]);
        expect(await hcContract.currentSupply(), "current supply should equal dev mint")
            .to.equal(BigNumber.from(teamMintAmt));
        for (let i = 0; i < 6969; i += 10) {
            const numMints = Math.min(10, 6969 - i);
            await expect(hcContract.mintWhitelistPresale(BigNumber.from(numMints), {
                value: ethers.utils.parseEther("0.0666").mul(numMints),
            })).to.emit(hcContract, "Transfer");
        }
        expect(await hcContract.currentSupply(), "current supply should equal dev mint + presale")
            .to.equal(BigNumber.from(6969 + 50));
        const supplyRemaining = 9696 - 6969 - 50; //TOTAL_SUPPLY - MAX_PRESALE_SUPPLY - MAX_TEAM_SUPPLY
        await hcContract.setSales(false, true);
        for (let i = 0; i < supplyRemaining; i += 10) {
            const numMints = Math.min(10, supplyRemaining - i);
            await expect(hcContract.mintPublic(BigNumber.from(numMints), {
                value: ethers.utils.parseEther("0.0666").mul(numMints),
            })).to.emit(hcContract, "Transfer");
        }
        expect(await hcContract.currentSupply(), "current supply should equal total supply")
            .to.equal(BigNumber.from(9696));
        await expect(hcContract.mintPublic(BigNumber.from(1), {
            value: ethers.utils.parseEther("0.0666"),
        })).to.be.revertedWith("This mint would pass max supply");
        expect(await hcContract.balanceOf(contractOwner.address), "Should have total supply").to.equal(BigNumber.from(9696));
    });
  
  });