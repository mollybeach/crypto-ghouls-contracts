pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";

contract DutchAuctionMint is ERC721URIStorage, Ownable {
    event Mint(address indexed sender, uint256 startWith, uint256 times);
    using Strings for uint256;
    address public contractAddress;
    
    uint256 public constant MAX_SUPPLY = 5555;
    uint256 public constant maxBatch = 10;
    uint256 public currentSupply;
    string public baseURI;

    uint256 private maxPrice = 0.3 ether;
    uint256 private minPrice = 0.03 ether;
    uint256 private priceDecrementAmt = 0.05 ether;
    uint256 private timeToDecrementPrice = 10 minutes;
    bool private hasStarted;
    uint256 private startedTime;

    constructor() ERC721("DutchAuctionMintContract", "DAMC") {
        contractAddress = address(this);
    }

    function _baseURI() internal view virtual override returns (string memory){
        return baseURI;
    }
    function setBaseURI(string memory _newURI) public onlyOwner {
        baseURI = _newURI;
    }
    
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token.");
        
        return bytes(baseURI).length > 0
            ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json")) : ".json";
    }
    function setTokenURI(uint256 _tokenId, string memory _tokenURI) public onlyOwner {
        _setTokenURI(_tokenId, _tokenURI);
    }

    function toggleStart() public onlyOwner {
        hasStarted = !hasStarted;
        if(hasStarted) {
            startedTime = block.timestamp;
        }
    }

    function currentPriceToMint() view public returns(uint256) {
        uint256 numDecrements = (block.timestamp - startedTime) / timeToDecrementPrice;
        uint256 decrementAmt = (priceDecrementAmt * numDecrements);
        if(decrementAmt > maxPrice) {
            return minPrice;
        }
        uint256 adjPrice = maxPrice - decrementAmt;
        return adjPrice;
    }

    function mint(uint256 _times) payable public {
        require(hasStarted, "Contract has not been started");
        require(_times > 0 && _times <= maxBatch, "Invalid number of mints");
        require(currentSupply + _times <= MAX_SUPPLY, "Max supply has been reached");
        require(msg.value == _times * currentPriceToMint(), "Insufficient ethereum");
        payable(owner()).transfer(msg.value);
        emit Mint(_msgSender(), currentSupply+1, _times);
        for(uint256 i=0; i< _times; i++){
            _mint(_msgSender(), ++currentSupply);
        }
    }
    

    
}