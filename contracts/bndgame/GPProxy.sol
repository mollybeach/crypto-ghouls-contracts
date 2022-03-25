// SPDX-License-Identifier: MIT LICENSE

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IGP.sol";

contract GPProxy is IGP, Ownable {

  struct MintCommit {
    address recipient;
    uint16 amount;
    uint64 blockNum;
  }

  // Tracks the last block that a caller has written to state.
  // Disallow some access to functions if they occur while a change is being written.
  mapping(address => uint256) private lastWrite;

  // address => allowedToCallFunctions
  mapping(address => bool) private admins;
  uint256 private pendingAmts;
  // commitId -> array of all pending commits
  mapping(uint16 => MintCommit[]) private commitQueue;
  // Track when a commitId started accepting commits
  mapping(uint16 => uint256) private commitIdStartTime;
  // Tracks the current commitId batch to put new commits into
  uint16 private _commitIdCur = 1;
  // tracks the oldest commitId that has commits needing to be revealed
  uint16 private _commitIdGardending = 0;
  // Time from starting a commit batch to allow new commits to enter
  uint64 private timePerCommitBatch = 5 minutes;
  // Time from starting a commit batch to allow users to reveal these in exchange for $GP
  uint64 private timeToAllowArb = 10 minutes;

  IGP public gpToken;
  
  constructor() { }

  function setContract(address _gp) external onlyOwner {
    gpToken = IGP(_gp);
  }

  /**
   * enables an address to mint / burn
   * @param addr the address to enable
   */
  function addAdmin(address addr) external onlyOwner {
    admins[addr] = true;
  }

  /**
   * disables an address from minting / burning
   * @param addr the address to disbale
   */
  function removeAdmin(address addr) external onlyOwner {
    admins[addr] = false;
  }

  function transferFrom(
      address,
      address,
      uint256
  ) public virtual override disallowIfStateIsChanging returns (bool) {
    // A user should never call this function, since it is a proxy and doesn't control anything (NFTs, erc20s etc)
    revert("OOPS! Try GP.transferFrom?");
  }

  /**
   * mints $GP to a recipient
   * @param to the recipient of the $GP
   * @param amount the amount of $GP to mint
   */
  function mint(address to, uint256 amount) external override {
    require(admins[msg.sender], "Only admins can transfer");
    // Check if current commit batch is past the threshold for time and increment commitId if so
    if(commitIdStartTime[_commitIdCur] < block.timestamp - timePerCommitBatch) {
      // increment commitId to start a new batch
      _commitIdCur += 1;
    }
    // Add this mint request to the commit queue for the current commitId
    // Check if the revealable commitId has anything to commit and increment it until it does, or is the same as the current commitId
    // Check if there is a commit in a revealable batch and pop/reveal it
    // If there was a commit that was revealed, check to see if that commit is completely and delete/increment it if empty
  }

  function revealOldestCommits(uint256 numReveals) external {
    // Ensure EOA accounts only
    // Increment the revealable commitId until finding revealable commits. Revert if it gets to the current commitId unless that commitId is past the threshold
    // If the reveal commitId is past the time threshold for arb, 
    //  loop through and process the minimum amount between the numReveals and the number of commits able to be revealed
    // Increment the reveal commitId and delete empty commitId batches as needed
    // Pay the sender the amount of GP times the number of reveals they did.
  }

  /**
   * burns $GP from a holder
   * @param from the holder of the $GP
   * @param amount the amount of $GP to burn
   */
  function burn(address from, uint256 amount) external override {
    require(admins[msg.sender], "Only admins can burn");
    gpToken.burn(from, amount);
  }
  /** SECURITEEEEEEEEEEEEEEEEE */

  modifier disallowIfStateIsChanging() {
    // frens can always call whenever they want :)
    require(admins[_msgSender()] || lastWrite[tx.origin] < block.number, "hmmmm what doing?");
    _;
  }

  function updateOriginAccess() external override {
    require(admins[_msgSender()], "Only admins can call this");
    lastWrite[tx.origin] = block.number;
    gpToken.updateOriginAccess();
  }
}