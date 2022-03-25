// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract ERC20Mintable is ERC20Burnable, Ownable, Pausable {
    event AddToDestinationWhitelist(uint256 numberAdded);
    event AddToWhitelist(uint256 numberAdded);
    event RemoveFromDestinationWhitelist(uint256 numberRemoved);
    event RemoveFromWhitelist(uint256 numberRemoved);
    event Mint(address addressFrom, address addressTo, uint256 amount);

    address public contractAddress;

    constructor() ERC20("TokenName", "TokenSymbol") {
        contractAddress = address(this);
        pause();
    }

    mapping(address => bool) private whitelistAddresses;
    mapping(address => bool) private whitelistDestinationAddresses;

    modifier onlyWhitelist() {
        require(whitelistAddresses[msg.sender], "Not on whitelist");
        _;
    }

    modifier onlyWhitelistDestinations() {
        require(whitelistDestinationAddresses[msg.sender], "Not on whitelist");
        _;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function addToDestinationWhitelist(address[] calldata addressesToAdd) public onlyOwner {
        for (uint256 i = 0; i < addressesToAdd.length; i++) {
            whitelistDestinationAddresses[addressesToAdd[i]] = true;
        }
        emit AddToDestinationWhitelist(addressesToAdd.length);
    }

    function removeFromDestinationWhitelist(address[] calldata addressesToRemove) public onlyOwner {
        for (uint256 i = 0; i < addressesToRemove.length; i++) {
            whitelistDestinationAddresses[addressesToRemove[i]] = false;
        }
        emit RemoveFromDestinationWhitelist(addressesToRemove.length);
    }

    function addToWhitelist(address[] calldata addressesToAdd) public onlyOwner {
        for (uint256 i = 0; i < addressesToAdd.length; i++) {
            whitelistAddresses[addressesToAdd[i]] = true;
        }
        emit AddToWhitelist(addressesToAdd.length);
    }

    function removeFromWhitelist(address[] calldata addressesToRemove) public onlyOwner {
        for (uint256 i = 0; i < addressesToRemove.length; i++) {
            whitelistAddresses[addressesToRemove[i]] = false;
        }
        emit RemoveFromWhitelist(addressesToRemove.length);
    }

    function mint(address destinationAddress, uint256 amount) public whenNotPaused {
        _mint(destinationAddress, amount);
        emit Mint(msg.sender, destinationAddress, amount);
    }
}