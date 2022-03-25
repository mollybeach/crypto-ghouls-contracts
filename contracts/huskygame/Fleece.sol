// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IFleece.sol";

contract FLEECE is IFleece, ERC20, Ownable {

  // a mapping from an address to whether or not it can mint / burn
  mapping(address => bool) private controllers;
  
  constructor() ERC20("FLEECE", "FLEECE") { }

  /**
   * mints $FLEECE to a recipient
   * @param to the recipient of the $FLEECE
   * @param amount the amount of $FLEECE to mint
   */
  function mint(address to, uint256 amount) external override {
    require(controllers[msg.sender], "Only controllers can mint");
    _mint(to, amount);
  }

  /**
   * burns $FLEECE from a holder
   * @param from the holder of the $FLEECE
   * @param amount the amount of $FLEECE to burn
   */
  function burn(address from, uint256 amount) external override {
    require(controllers[msg.sender], "Only controllers can burn");
    _burn(from, amount);
  }

  /**
   * enables an address to mint / burn
   * @param controller the address to enable
   */
  function addController(address controller) external onlyOwner {
    controllers[controller] = true;
  }

  /**
   * disables an address from minting / burning
   * @param controller the address to disbale
   */
  function removeController(address controller) external onlyOwner {
    controllers[controller] = false;
  }
}