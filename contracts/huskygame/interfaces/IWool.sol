// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.0;

interface IFleece {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}