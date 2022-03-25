// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";

contract DAORoyaltiesDistribution is Ownable {
    using Strings for uint256;

    //uints 
    address payable public daoAddress;
    address payable public devTeamAddress;
    address public royaltiesWallet;
    address public contractAddress;

    //constructor args 
    constructor(address payable _daoAddress, address payable _devTeamAddress, address _royaltiesWallet) {
        daoAddress = _daoAddress;
        devTeamAddress = _devTeamAddress;
        royaltiesWallet = _royaltiesWallet;
        contractAddress = address(this);
    }

    function transferRoyalties() payable external onlyOwner {
        require(msg.sender == royaltiesWallet, "can only be ran from royalties wallet");
        require(msg.value > 0, "value error");
        
        uint256 devAmt = msg.value / 4; // 25% of what is being transferred
        uint256 daoAmt = msg.value - devAmt; // needed to ensure no loss of funds

        daoAddress.transfer(daoAmt);
        devTeamAddress.transfer(devAmt);

    }
    
}