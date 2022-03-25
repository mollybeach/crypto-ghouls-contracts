// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IFleecef.sol";
import "./interfaces/IFleece.sol";

contract Barn is Ownable, IERC721Receiver, Pausable {
  
  // maximum alpha score for a Wolf
  uint8 public constant MAX_ALPHA = 8;

  // struct to store a stake's token, owner, and earning values
  struct Stake {
    uint16 tokenId;
    uint80 value;
    address owner;
  }

  event TokenStaked(address owner, uint256 tokenId, uint256 value);
  event SheepClaimed(uint256 tokenId, uint256 earned, bool unstaked);
  event WolfClaimed(uint256 tokenId, uint256 earned, bool unstaked);

  // reference to the Fleecef NFT contract
  IFleecef huskie;
  // reference to the $FLEECE contract for minting $FLEECE earnings
  IFleece fleece;

  // maps tokenId to stake
  mapping(uint256 => Stake) public sty; 
  // maps alpha to all Wolf stakes with that alpha
  mapping(uint256 => Stake[]) public pack; 
  // tracks location of each Wolf in Pack
  mapping(uint256 => uint256) public packIndices; 
  // total alpha scores staked
  uint256 public totalAlphaStaked = 0; 
  // any rewards distributed when no wolves are staked
  uint256 public unaccountedRewards = 0; 
  // amount of $FLEECE due for each alpha point staked
  uint256 public fleecePerAlpha = 0; 

  // sheep earn 10000 $FLEECE per day
  uint256 public constant DAILY_FLEECE_RATE = 10000 ether;
  // sheep must have 2 days worth of $FLEECE to unstake or else it's too cold
  uint256 public constant MINIMUM_TO_EXIT = 2 days;
  // wolves take a 20% tax on all $FLEECE claimed
  uint256 public constant FLEECE_CLAIM_TAX_PERCENTAGE = 20;
  // there will only ever be (roughly) 2.4 billion $FLEECE earned through staking
  uint256 public constant MAXIMUM_GLOBAL_FLEECE = 2400000000 ether;

  // amount of $FLEECE earned so far
  uint256 public totalFleeceEarned;
  // number of Sheep staked in the Barn
  uint256 public totalSheepStaked;
  // the last time $FLEECE was claimed
  uint256 public lastClaimTimestamp;

  // emergency rescue to allow unstaking without any checks but without $FLEECE
  bool public rescueEnabled = false;

  /**
   * @param _huskie reference to the Fleecef NFT contract
   * @param _fleece reference to the $FLEECE token
   */
  constructor(address _huskie, address _fleece) { 
    huskie = IFleecef(_huskie);
    fleece = IFleece(_fleece);
  }

  /** STAKING */

  /**
   * adds Sheep and Wolves to the Barn and Pack
   * @param account the address of the staker
   * @param tokenIds the IDs of the Sheep and Wolves to stake
   */
  function addManyToBarnAndPack(address account, uint16[] calldata tokenIds) external {
    require(account == _msgSender() || _msgSender() == address(huskie), "DONT GIVE YOUR TOKENS AWAY");
    for (uint i = 0; i < tokenIds.length; i++) {
      if (_msgSender() != address(huskie)) { // dont do this step if its a mint + stake
        require(huskie.ownerOf(tokenIds[i]) == _msgSender(), "AINT YO TOKEN");
        huskie.transferFrom(_msgSender(), address(this), tokenIds[i]);
      } else if (tokenIds[i] == 0) {
        continue; // there may be gaps in the array for stolen tokens
      }

      if (isSheep(tokenIds[i])) 
        _addSheepToBarn(account, tokenIds[i]);
      else 
        _addWolfToPack(account, tokenIds[i]);
    }
  }

  /**
   * adds a single Sheep to the Barn
   * @param account the address of the staker
   * @param tokenId the ID of the Sheep to add to the Barn
   */
  function _addSheepToBarn(address account, uint256 tokenId) internal whenNotPaused _updateEarnings {
    sty[tokenId] = Stake({
      owner: account,
      tokenId: uint16(tokenId),
      value: uint80(block.timestamp)
    });
    totalSheepStaked += 1;
    emit TokenStaked(account, tokenId, block.timestamp);
  }

  /**
   * adds a single Wolf to the Pack
   * @param account the address of the staker
   * @param tokenId the ID of the Wolf to add to the Pack
   */
  function _addWolfToPack(address account, uint256 tokenId) internal {
    uint256 alpha = _alphaForWolf(tokenId);
    totalAlphaStaked += alpha; // Portion of earnings ranges from 8 to 5
    packIndices[tokenId] = pack[alpha].length; // Store the location of the husky in the Pack
    pack[alpha].push(Stake({
      owner: account,
      tokenId: uint16(tokenId),
      value: uint80(fleecePerAlpha)
    })); // Add the husky to the Pack
    emit TokenStaked(account, tokenId, fleecePerAlpha);
  }

  /** CLAIMING / UNSTAKING */

  /**
   * realize $FLEECE earnings and optionally unstake tokens from the Barn / Pack
   * to unstake a Sheep it will require it has 2 days worth of $FLEECE unclaimed
   * @param tokenIds the IDs of the tokens to claim earnings from
   * @param unstake whether or not to unstake ALL of the tokens listed in tokenIds
   */
  function claimManyFromBarnAndPack(uint16[] calldata tokenIds, bool unstake) external whenNotPaused _updateEarnings {
    uint256 owed = 0;
    for (uint i = 0; i < tokenIds.length; i++) {
      if (isSheep(tokenIds[i]))
        owed += _claimSheepFromBarn(tokenIds[i], unstake);
      else
        owed += _claimWolfFromPack(tokenIds[i], unstake);
    }
    if (owed == 0) return;
    fleece.mint(_msgSender(), owed);
  }

  /**
   * realize $FLEECE earnings for a single Sheep and optionally unstake it
   * if not unstaking, pay a 20% tax to the staked Wolves
   * if unstaking, there is a 50% chance all $FLEECE is stolen
   * @param tokenId the ID of the Sheep to claim earnings from
   * @param unstake whether or not to unstake the Sheep
   * @return owed - the amount of $FLEECE earned
   */
  function _claimSheepFromBarn(uint256 tokenId, bool unstake) internal returns (uint256 owed) {
    Stake memory stake = sty[tokenId];
    require(stake.owner == _msgSender(), "SWIPER, NO SWIPING");
    require(!(unstake && block.timestamp - stake.value < MINIMUM_TO_EXIT), "GONNA BE COLD WITHOUT TWO DAY'S FLEECE");
    if (totalFleeceEarned < MAXIMUM_GLOBAL_FLEECE) {
      owed = (block.timestamp - stake.value) * DAILY_FLEECE_RATE / 1 days;
    } else if (stake.value > lastClaimTimestamp) {
      owed = 0; // $FLEECE production stopped already
    } else {
      owed = (lastClaimTimestamp - stake.value) * DAILY_FLEECE_RATE / 1 days; // stop earning additional $FLEECE if it's all been earned
    }
    if (unstake) {
      if (random(tokenId) & 1 == 1) { // 50% chance of all $FLEECE stolen
        _payWolfTax(owed);
        owed = 0;
      }
      huskie.safeTransferFrom(address(this), _msgSender(), tokenId, ""); // send back Sheep
      delete sty[tokenId];
      totalSheepStaked -= 1;
    } else {
      _payWolfTax(owed * FLEECE_CLAIM_TAX_PERCENTAGE / 100); // percentage tax to staked wolves
      owed = owed * (100 - FLEECE_CLAIM_TAX_PERCENTAGE) / 100; // remainder goes to Sheep owner
      sty[tokenId] = Stake({
        owner: _msgSender(),
        tokenId: uint16(tokenId),
        value: uint80(block.timestamp)
      }); // reset stake
    }
    emit SheepClaimed(tokenId, owed, unstake);
  }

  /**
   * realize $FLEECE earnings for a single Wolf and optionally unstake it
   * Wolves earn $FLEECE proportional to their Alpha rank
   * @param tokenId the ID of the Wolf to claim earnings from
   * @param unstake whether or not to unstake the Wolf
   * @return owed - the amount of $FLEECE earned
   */
  function _claimWolfFromPack(uint256 tokenId, bool unstake) internal returns (uint256 owed) {
    require(huskie.ownerOf(tokenId) == address(this), "AINT A PART OF THE PACK");
    uint256 alpha = _alphaForWolf(tokenId);
    Stake memory stake = pack[alpha][packIndices[tokenId]];
    require(stake.owner == _msgSender(), "SWIPER, NO SWIPING");
    owed = (alpha) * (fleecePerAlpha - stake.value); // Calculate portion of tokens based on Alpha
    if (unstake) {
      totalAlphaStaked -= alpha; // Remove Alpha from total staked
      huskie.safeTransferFrom(address(this), _msgSender(), tokenId, ""); // Send back Wolf
      Stake memory lastStake = pack[alpha][pack[alpha].length - 1];
      pack[alpha][packIndices[tokenId]] = lastStake; // Shuffle last Wolf to current position
      packIndices[lastStake.tokenId] = packIndices[tokenId];
      pack[alpha].pop(); // Remove duplicate
      delete packIndices[tokenId]; // Delete old mapping
    } else {
      pack[alpha][packIndices[tokenId]] = Stake({
        owner: _msgSender(),
        tokenId: uint16(tokenId),
        value: uint80(fleecePerAlpha)
      }); // reset stake
    }
    emit WolfClaimed(tokenId, owed, unstake);
  }

  /**
   * emergency unstake tokens
   * @param tokenIds the IDs of the tokens to claim earnings from
   */
  function rescue(uint256[] calldata tokenIds) external {
    require(rescueEnabled, "RESCUE DISABLED");
    uint256 tokenId;
    Stake memory stake;
    Stake memory lastStake;
    uint256 alpha;
    for (uint i = 0; i < tokenIds.length; i++) {
      tokenId = tokenIds[i];
      if (isSheep(tokenId)) {
        stake = sty[tokenId];
        require(stake.owner == _msgSender(), "SWIPER, NO SWIPING");
        huskie.safeTransferFrom(address(this), _msgSender(), tokenId, ""); // send back Sheep
        delete sty[tokenId];
        totalSheepStaked -= 1;
        emit SheepClaimed(tokenId, 0, true);
      } else {
        alpha = _alphaForWolf(tokenId);
        stake = pack[alpha][packIndices[tokenId]];
        require(stake.owner == _msgSender(), "SWIPER, NO SWIPING");
        totalAlphaStaked -= alpha; // Remove Alpha from total staked
        huskie.safeTransferFrom(address(this), _msgSender(), tokenId, ""); // Send back Wolf
        lastStake = pack[alpha][pack[alpha].length - 1];
        pack[alpha][packIndices[tokenId]] = lastStake; // Shuffle last Wolf to current position
        packIndices[lastStake.tokenId] = packIndices[tokenId];
        pack[alpha].pop(); // Remove duplicate
        delete packIndices[tokenId]; // Delete old mapping
        emit WolfClaimed(tokenId, 0, true);
      }
    }
  }

  /** ACCOUNTING */

  /** 
   * add $FLEECE to claimable pot for the Pack
   * @param amount $FLEECE to add to the pot
   */
  function _payWolfTax(uint256 amount) internal {
    if (totalAlphaStaked == 0) { // if there's no staked wolves
      unaccountedRewards += amount; // keep track of $FLEECE due to wolves
      return;
    }
    // makes sure to include any unaccounted $FLEECE 
    fleecePerAlpha += (amount + unaccountedRewards) / totalAlphaStaked;
    unaccountedRewards = 0;
  }

  /**
   * tracks $FLEECE earnings to ensure it stops once 2.4 billion is eclipsed
   */
  modifier _updateEarnings() {
    if (totalFleeceEarned < MAXIMUM_GLOBAL_FLEECE) {
      totalFleeceEarned += 
        (block.timestamp - lastClaimTimestamp)
        * totalSheepStaked
        * DAILY_FLEECE_RATE / 1 days; 
      lastClaimTimestamp = block.timestamp;
    }
    _;
  }

  /** ADMIN */

  /**
   * allows owner to enable "rescue mode"
   * simplifies accounting, prioritizes tokens out in emergency
   */
  function setRescueEnabled(bool _enabled) external onlyOwner {
    rescueEnabled = _enabled;
  }

  /**
   * enables owner to pause / unpause minting
   */
  function setPaused(bool _paused) external onlyOwner {
    if (_paused) _pause();
    else _unpause();
  }

  /** READ ONLY */

  /**
   * checks if a token is a Sheep
   * @param tokenId the ID of the token to check
   * @return sheep - whether or not a token is a Sheep
   */
  function isSheep(uint256 tokenId) public view returns (bool sheep) {
    (sheep, , , , , , , , , ) = huskie.tokenTraits(tokenId);
  }

  /**
   * gets the alpha score for a Wolf
   * @param tokenId the ID of the Wolf to get the alpha score for
   * @return the alpha score of the Wolf (5-8)
   */
  function _alphaForWolf(uint256 tokenId) internal view returns (uint8) {
    ( , , , , , , , , , uint8 alphaIndex) = huskie.tokenTraits(tokenId);
    return MAX_ALPHA - alphaIndex; // alpha index is 0-3
  }

  /**
   * chooses a random Wolf thief when a newly minted token is stolen
   * @param seed a random value to choose a Wolf from
   * @return the owner of the randomly selected Wolf thief
   */
  function randomWolfOwner(uint256 seed) external view returns (address) {
    if (totalAlphaStaked == 0) return address(0x0);
    uint256 bucket = (seed & 0xFFFFFFFF) % totalAlphaStaked; // choose a value from 0 to total alpha staked
    uint256 cumulative;
    seed >>= 32;
    // loop through each bucket of Wolves with the same alpha score
    for (uint i = MAX_ALPHA - 3; i <= MAX_ALPHA; i++) {
      cumulative += pack[i].length * i;
      // if the value is not inside of that bucket, keep going
      if (bucket >= cumulative) continue;
      // get the address of a random Wolf with that alpha score
      return pack[i][seed % pack[i].length].owner;
    }
    return address(0x0);
  }

  /**
   * generates a pseudorandom number
   * @param seed a value ensure different outcomes for different sources in the same block
   * @return a pseudorandom value
   */
  function random(uint256 seed) internal view returns (uint256) {
    return uint256(keccak256(abi.encodePacked(
      tx.origin,
      blockhash(block.number - 1),
      block.timestamp,
      seed
    )));
  }

  function onERC721Received(
        address,
        address from,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
      require(from == address(0x0), "Cannot send to Barn directly");
      return IERC721Receiver.onERC721Received.selector;
    }

  
}