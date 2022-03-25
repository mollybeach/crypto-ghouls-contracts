pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "hardhat/console.sol";

contract ERC721Stakable is ERC721URIStorage, Ownable, Pausable {
    using Strings for uint256;
    using Counters for Counters.Counter;

    
    Counters.Counter private _tokenIdCounter;

    uint256 public constant MAX_SUPPLY = 7777;
    uint256 public constant MAX_BATCH_SIZE = 10;
    uint256 public constant MINT_PRICE = 0.02 ether;
    address public _contractAddress;

    string public baseURI;
    
    mapping(uint256 => address) private _stakedTokens;

    constructor() ERC721("ERC721Stakable", "ERCSTAKE") {
        _contractAddress = address(this);
        // make it 1-based instead of 0-based
        _tokenIdCounter.increment();
        _pause();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _baseURI() internal view virtual override returns (string memory){
        return baseURI;
    }
    function setBaseURI(string memory _newURI) public onlyOwner {
        baseURI = _newURI;
    }
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "token doesn't exist.");
        
        return bytes(baseURI).length > 0
            ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json")) : ".json";
    }
    function setTokenURI(uint256 _tokenId, string memory _tokenURI) public onlyOwner {
        _setTokenURI(_tokenId, _tokenURI);
    }

    function _beforeTokenTransfer(address from, address to,uint256 tokenId) internal virtual override {
        require(_stakedTokens[tokenId] == address(0), "Token is currently staked");
    }

    function isTokenStaked(uint256 tokenId) external view returns (bool){
        return _stakedTokens[tokenId] != address(0);
    }

    function stake(uint256[] calldata tokens) external whenNotPaused {
        for (uint256 i = 0; i < tokens.length; i++) {
            _stakedTokens[tokens[i]] = _msgSender();
        }
    }

    function unstake(uint256[] calldata tokens) external whenNotPaused {
        for (uint256 i = 0; i < tokens.length; i++) {
            require(_stakedTokens[tokens[i]] == _msgSender(), "Must own all given tokens");
            _stakedTokens[tokens[i]] = address(0);
        }
    }

    function mint(uint256 times) public payable whenNotPaused {
        require(times >0 && times <= MAX_BATCH_SIZE, "wake wrong number");
        require(_tokenIdCounter.current() + times <= MAX_SUPPLY, "wake too much");
        require(msg.value == times * MINT_PRICE, "value error");
        for(uint256 i=0; i< times; i++){
            _mint(_msgSender(), _tokenIdCounter.current());
            _tokenIdCounter.increment();
        }
    }
}