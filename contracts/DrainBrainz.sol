// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IStaking is IERC20 {
    function deposit(uint256[] calldata tokenIds) external;
    function depositsOf(address account) external view returns (uint256[] memory);
    function EXPIRATION() external view returns (uint256);
    function claimRewards(uint256[] calldata tokenIds) external;
    function setRate(uint256 _rate) external;
    function setExpiration(uint256 _expiration) external;
    function transferOwnership(address newOwner) external;
}

contract DrainVampire is Ownable, IERC721Receiver {
    using Strings for uint256;

    //uints 
    address public _stakingAddr;
    address public _brainzAddr;
    address public _zbatzAddr;

    //constructor args 
    constructor() { }

    function setAddresses(address stakingAddr, address brainzAddr, address zbatzAddr) external onlyOwner {
        _stakingAddr = stakingAddr;
        _brainzAddr = brainzAddr;
        _zbatzAddr = zbatzAddr;
    }

    function depositToad(uint256 tokenId) external onlyOwner {
        uint[] memory idSingle = new uint[](1);
        idSingle[0] = tokenId;
        IERC721(_zbatzAddr).setApprovalForAll(_stakingAddr, true);
        IStaking(_stakingAddr).deposit(idSingle);
    }

    function transferStakingOwner() external onlyOwner {
        IStaking(_stakingAddr).transferOwnership(_msgSender());
    }

    function withdrawVampire(uint256 zombieToadId, uint256 expirationBlock) external onlyOwner {
        // Set the rate to the total amount of brainz to be withdrawn
        IStaking(_stakingAddr).setRate(IERC20(_brainzAddr).balanceOf(_stakingAddr));
        // Save the old expiration to set back to once done withdrawing the brainz
        uint256 exp = IStaking(_stakingAddr).EXPIRATION();
        // Set expiration to the block after the deposited toad
        IStaking(_stakingAddr).setExpiration(expirationBlock);
        uint[] memory idSingle = new uint[](1);
        idSingle[0] = zombieToadId;
        // Collect all of the brainz for the given toad (must be deposited)
        IStaking(_stakingAddr).claimRewards(idSingle);
        // Reset the rate and expirations
        IStaking(_stakingAddr).setRate(0);
        IStaking(_stakingAddr).setExpiration(exp);
        // Send all erc20 tokens to owner
        IERC20(_brainzAddr).transfer(_msgSender(), IERC20(_brainzAddr).balanceOf(address(this)));
        //Lastly, transfer ownership of the staking contract back to the caller
        IStaking(_stakingAddr).transferOwnership(_msgSender());
    }

    function transferVampire() public onlyOwner {
        uint256 brainzSupply = IERC20(_brainzAddr).balanceOf(address(this));
        IERC20(_brainzAddr).transfer(_msgSender(), brainzSupply);
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