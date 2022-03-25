// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IFleecef is IERC721Enumerable {

  // struct to store each token's traits
  struct SheepWolf {
    bool isSheep;
    uint8 fur;
    uint8 head;
    uint8 ears;
    uint8 eyes;
    uint8 nose;
    uint8 mouth;
    uint8 neck;
    uint8 feet;
    uint8 alphaIndex;
  }


  function getPaidTokens() external view returns (uint256);
  function getTokenTraits(uint256 tokenId) external view returns (SheepWolf memory);
  function tokenTraits(uint256 tokenId) external view returns (bool a, uint8 b, uint8 c, uint8 d, uint8 e, uint8 f, uint8 g, uint8 h, uint8 i, uint8 j);
  
}