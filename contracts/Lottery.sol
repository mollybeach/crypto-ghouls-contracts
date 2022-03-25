// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract Lottery is Ownable {
    
    //events 
    event JoinEvent(uint256 _length, uint _qty);
    event DrawEvent(address winner);

    //uint256
    uint256 public MAX_TICKETS = 999;
    uint256 public PRICE = 5000000000000000000; //the price is 50 stack                          
    
        //addresses
    address public TOKEN_ADDRESS;
    address public WINNER;
    address[] public TICKETBAG;
    IERC20 public stackAddress;

    //bools
    bool public LOTTO_LIVE;

    //mappings 
    mapping(address => uint256) public AMOUNT_MAPPING;

    //constructor
    constructor(address _stackAddress) public {
        LOTTO_LIVE = false;
        stackAddress = IERC20(_stackAddress);
    }

    //functions
    function startLotto() public onlyOwner(){
        require(!LOTTO_LIVE);
        LOTTO_LIVE = true;
    }

    //all stack users can buy tickets
    function buyTickets(uint256 _qty, uint256 amount) public {
        require(LOTTO_LIVE);
        require(amount >= PRICE * _qty);
        require(_qty > 0);
        require(TICKETBAG.length + _qty <= MAX_TICKETS);
        require(TICKETBAG.length < MAX_TICKETS);
        AMOUNT_MAPPING[msg.sender] = _qty;
        stackAddress.transferFrom(_msgSender(), address(this), PRICE * _qty);
        for (uint256 i = 0; i < _qty; i++) {
        TICKETBAG.push(msg.sender);
        }
        emit JoinEvent (TICKETBAG.length, _qty);
        if(TICKETBAG.length == MAX_TICKETS) {
            endLotto();
        }
    }

    //roll for a winner
    function draw() public onlyOwner returns(address){
        require(TICKETBAG.length > 0);
        require(LOTTO_LIVE);
        uint256 randomNum = uint256(block.timestamp) % uint256(TICKETBAG.length-1);
        WINNER = TICKETBAG[randomNum];
        emit DrawEvent(WINNER);
        return WINNER;
    }

    //pay out the winner and reset the lottery
    function endLotto() public onlyOwner returns(address){
        require(LOTTO_LIVE);
        WINNER = draw();
        LOTTO_LIVE = false;
        return WINNER;
        //reset the ticket bag with Array() constructor 
        delete TICKETBAG;
    }
    function withdrawTokens() external onlyOwner {
        uint256 tokenSupply = stackAddress.balanceOf(address(this));
        stackAddress.transferFrom(address(this), msg.sender, tokenSupply);
    }
}
