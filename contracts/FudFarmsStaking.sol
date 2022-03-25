// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import '@openzeppelin/contracts/utils/math/Math.sol';
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

interface ICropToken is IERC20 {
    function depositsOf(address account) external view returns (uint256[] memory);
    function _depositBlocks(address addr, uint256 id) external view returns (uint256);
    function claimRewards(uint256[] calldata tokenIds) external;
}

contract MegaGardensStaking is Ownable, IERC721Receiver, ReentrancyGuard, Pausable {
    using EnumerableSet for EnumerableSet.UintSet; 
    
    //addresses 
    IERC721 public bigGardenToken;
    ICropToken public batchToken;

    address public contractAddress;

    //uint256's 
    uint256 public expiration;
    //rate governs how often you receive your token
    uint256 public rate;
  
    // mappings 
    mapping(address => EnumerableSet.UintSet) private _deposits;
    mapping(address => mapping(uint256 => uint256)) public _depositBlocks;

    constructor() {
        contractAddress = address(this);
        _pause();
    }

    modifier requireCropToken() {
        require(address(batchToken) != address(0), "batchToken not set");
        _;
    }

    modifier requireMegaGardenToken() {
        require(address(bigGardenToken) != address(0), "bigGardenToken not set");
        _;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function arrayContains(uint256[] memory arr, uint256 value) private pure returns(bool) {
      for (uint256 i = 0; i < arr.length; i++) {
        if(arr[i] == value) {
          return true;
        }
      }
      return false;
    }

/* STAKING MECHANICS */

    // Set a multiplier for how many tokens to earn each time a block passes.
    function setRate(uint256 _rate) public onlyOwner() {
      rate = _rate;
    }

    // Set this to a block to disable the ability to continue accruing tokens past that block number.
    function setExpiration(uint256 _expiration) public onlyOwner() {
      expiration = block.number + _expiration;
    }

    function setCropTokenAddress(address batchTokenAddr) public onlyOwner() {
      batchToken = ICropToken(batchTokenAddr);
    }

    function setMegaGardenTokenAddress(address bigGardenAddr) public onlyOwner() {
      bigGardenToken = IERC721(bigGardenAddr);
    }

    //check deposit amount. 
    function depositsOf(address account)
      external 
      view 
      requireCropToken
      returns (uint256[] memory)
    {
      EnumerableSet.UintSet storage depositSet = _deposits[account];
      uint256[] memory depositSetOtherContract = batchToken.depositsOf(account);
      uint256[] memory tokenIds = new uint256[] (depositSet.length() + depositSetOtherContract.length);

      for (uint256 i; i < depositSet.length(); i++) {
        tokenIds[i] = depositSet.at(i);
      }
      // Check deposits from the other contract
      for (uint256 i = depositSet.length(); i < depositSet.length() + depositSetOtherContract.length; i++) {
        tokenIds[i] = depositSetOtherContract[i - depositSet.length()];
      }

      return tokenIds;
    }

    function calculateRewards(address account, uint256[] memory tokenIds) 
      public 
      view 
      requireCropToken
      returns (uint256[] memory rewards) 
    {
      uint256[] memory tokensInOldContract = batchToken.depositsOf(account);
      return calculateRewards(account, tokenIds, tokensInOldContract);
    }

    function calculateRewards(address account, uint256[] memory tokenIds, uint256[] memory tokensInOldContract) 
      private 
      view 
      requireCropToken
      returns (uint256[] memory rewards) 
    {
      rewards = new uint256[](tokenIds.length);

      for (uint256 i; i < tokenIds.length; i++) {
        uint256 tokenId = tokenIds[i];
        uint256 lastBlock = arrayContains(tokensInOldContract, tokenId) ? 
          batchToken._depositBlocks(account, tokenId) 
          : _depositBlocks[account][tokenId];
        if(lastBlock < _depositBlocks[account][tokenId]) {
          lastBlock = _depositBlocks[account][tokenId]; 
        }

        rewards[i] = 
          rate * 
          (_deposits[account].contains(tokenId) || arrayContains(tokensInOldContract, tokenId) ? 1 : 0) * 
          (Math.min(block.number, expiration) - lastBlock);
      }

      return rewards;
    }

    //reward amount by address/tokenIds[]
    function calculateReward(address account, uint256 tokenId, uint256[] memory tokensInOldContract) 
      private 
      view 
      requireCropToken
      returns (uint256) 
    {
      require(Math.min(block.number, expiration) > _depositBlocks[account][tokenId], "Invalid blocks");
      uint256 lastBlock = arrayContains(tokensInOldContract, tokenId) ? 
        batchToken._depositBlocks(account, tokenId) 
        : _depositBlocks[account][tokenId];
      if(lastBlock < _depositBlocks[account][tokenId]) {
        lastBlock = _depositBlocks[account][tokenId]; 
      }
      return rate * 
          (_deposits[account].contains(tokenId) || arrayContains(tokensInOldContract, tokenId) ? 1 : 0) * 
          (Math.min(block.number, expiration) - lastBlock);
    }

    //reward claim function 
    function claimRewards(uint256[] calldata tokenIds) public whenNotPaused requireCropToken {
      uint256 reward; 
      uint256 blockCur = Math.min(block.number, expiration);
      uint256[] memory tokensInOldContract = batchToken.depositsOf(msg.sender);

      for (uint256 i; i < tokenIds.length; i++) {
        reward += calculateReward(msg.sender, tokenIds[i], tokensInOldContract);
        _depositBlocks[msg.sender][tokenIds[i]] = blockCur;
      }
      // Reset the block from the old contract. They do not receive rewards from there, but will from here
      batchToken.claimRewards(tokensInOldContract);

      if (reward > 0) {
        batchToken.transfer(msg.sender, reward);
      }
    }

    //deposit function. 
    function deposit(uint256[] calldata tokenIds) external whenNotPaused requireMegaGardenToken requireCropToken {
        require(msg.sender != address(batchToken), "Invalid address");
        claimRewards(tokenIds);
        for (uint256 i; i < tokenIds.length; i++) {
            bigGardenToken.safeTransferFrom(
                msg.sender,
                address(this),
                tokenIds[i],
                ""
            );

            _deposits[msg.sender].add(tokenIds[i]);
        }
    }

    //withdrawal function.
    function withdraw(uint256[] calldata tokenIds) external whenNotPaused requireMegaGardenToken requireCropToken nonReentrant() {
        claimRewards(tokenIds);

        for (uint256 i; i < tokenIds.length; i++) {
            require(
                _deposits[msg.sender].contains(tokenIds[i]),
                "Staking: token not deposited"
            );

            _deposits[msg.sender].remove(tokenIds[i]);

            bigGardenToken.safeTransferFrom(
                address(this),
                msg.sender,
                tokenIds[i],
                ""
            );
        }
    }

    //withdrawal function.
    function withdrawTokens() external onlyOwner {
        uint256 tokenSupply = batchToken.balanceOf(address(this));
        batchToken.transfer(msg.sender, tokenSupply);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}