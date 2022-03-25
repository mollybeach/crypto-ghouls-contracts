// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20Token is ERC20 {

    address public contractAddress;

    constructor(uint32 mintAmt) ERC20("TestERC20Token", "TERC") {
        contractAddress = address(this);
        _mint(msg.sender, mintAmt * 10**uint(decimals()));
    }
}