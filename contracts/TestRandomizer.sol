// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "./bndgame/interfaces/IRandomizer.sol";

contract TestRandomizer is IRandomizer {

    uint256 private callSeed;

    function random() external override returns (uint256) {
        callSeed += 1;
        return uint256(keccak256(abi.encodePacked(
            tx.origin,
            blockhash(block.number - 1),
            block.timestamp,
            callSeed
        )));
    }
}