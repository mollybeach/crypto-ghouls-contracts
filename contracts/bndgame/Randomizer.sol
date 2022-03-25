// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRandomizer.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * Request testnet LINK and ETH here: https://faucets.chain.link/
 * Find information on LINK Token Contracts and get the latest ETH and LINK faucets here: https://docs.chain.link/docs/link-token-contracts/
 */
 
contract Randomizer is IRandomizer, VRFConsumerBase, Ownable {
    using EnumerableSet for EnumerableSet.UintSet; 
    
    bytes32 internal keyHash;
    uint256 internal fee;
    
    uint256 public randomResult;
    uint256 public rand; 

    EnumerableSet.UintSet private values;

    // address => allowedToCallFunctions
    mapping(address => bool) private admins;
    
    /**
     * Constructor inherits VRFConsumerBase
     * 
     * Network: Kovan
     * Chainlink VRF Coordinator address: 0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9
     * LINK token address:                0xa36085F69e2889c224210F603D836748e7dC0088
     * Key Hash: 0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4
     */
    /**
    * Network: Mainnet
    * Chainlink VRF Coordinator address: 0xf0d54349aDdcf704F77AE15b96510dEA15cb7952
    * LINK token address: 0x514910771AF9Ca656af840dff83E8264EcF986CA
    * Key Hash: 0xAA77729D3466CA35AE8D28B3BBAC7CC36A5031EFDC430821C02BC31A238AF445
    * Price: 2 LINK (varies)
    *
    * Network: Rinkeby
    * Chainlink VRF Coordinator address: 0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B
    * LINK token address: 0x01BE23585060835E02B77ef475b0Cc51aA1e0709
    * Key Hash: 0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311
    * Price: 0.1 LINK
    */
    constructor() 
        VRFConsumerBase(
            0xf0d54349aDdcf704F77AE15b96510dEA15cb7952,
            0x514910771AF9Ca656af840dff83E8264EcF986CA
        )
    {
        keyHash = 0xAA77729D3466CA35AE8D28B3BBAC7CC36A5031EFDC430821C02BC31A238AF445;
        fee = 2 * 10 ** 18; // 2 LINK (Varies by network)
    }

    // ADMIN // 

    /**
    * Changes fee if LINK fee changes for mainnet
    */
    function setFee(uint256 amount) public onlyOwner {
        fee = amount;
    }

    /**
    * Set's keyhash if keyhash changes 
    */
    function setKeyHash(bytes32 _hash) public onlyOwner {
        keyHash = _hash;
    }
    
    /** 
     * Requests randomness 
     */
    function getRandomNumber() internal returns (bytes32 requestId) {
        require(LINK.balanceOf(address(this)) >= fee, "Not enough LINK - fill contract with faucet");
        return requestRandomness(keyHash, fee);
    }

    /**
     * Callback function used by VRF Coordinator
     */
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        randomResult = randomness;
    }

    /**
    * Expands single random result to n results.
    */
    function setValues(uint256 numRandNumbers, uint256 numExpands) public onlyOwner {
        for (uint256 i = 0; i < numRandNumbers; i++) {
            getRandomNumber();
            for (uint256 j = 0; j < numExpands; j++) {
                values.add(uint256(keccak256(abi.encode(randomResult, j, gasleft()))));
            }
        }
    }

    /**
    * Selects one of the multiple generated random numbers from expand
    */
    function random() external override returns (uint256) {
        require(admins[msg.sender], "Only admins can call random");
        // select a single random number to use for minting purposes etc from an array of random numbers, then pop the used random number from the array
        require(values.length() >= 1, "must init random values");
        uint16 indexSeed = uint16(uint256(keccak256(abi.encode(randomResult, gasleft()))) & 0xFFFF);
        rand = values.at((indexSeed >> 2) % values.length() - 1);
        return uint256(keccak256(abi.encode(rand, gasleft(), tx.origin)));
    }

    // function withdrawLink() external {} - Implement a withdraw function to avoid locking your LINK in the contract
    function withdrawLink() public onlyOwner {
        uint256 supply = IERC20(0x514910771AF9Ca656af840dff83E8264EcF986CA).balanceOf(address(this));
        IERC20(0x514910771AF9Ca656af840dff83E8264EcF986CA).transfer(msg.sender, supply);
    }

    /**
    * enables an address to mint / burn
    * @param addr the address to enable
    */
    function addAdmin(address addr) external onlyOwner {
        admins[addr] = true;
    }

    /**
    * disables an address from minting / burning
    * @param addr the address to disbale
    */
    function removeAdmin(address addr) external onlyOwner {
        admins[addr] = false;
    }
}