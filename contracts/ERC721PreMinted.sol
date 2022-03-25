pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ERC721PreMinted is ERC721URIStorage, Ownable {
    using Strings for uint256;
    event MintToad (address indexed sender, uint256 startWith, uint256 times);

    //uints 
    uint256 public totalBatz;
    uint256 public totalCount = 7777;
    // uint256 public maxBatch = 10;
    // uint256 public price = 20000000000000000; // 0.02 eth
    address public contractAddress;

    //strings 
    string public baseURI;

    //bool
    bool private started;

    //constructor args 
    constructor() ERC721("ERC721PreMint", "ERCPreMint") {
        contractAddress = address(this);
    }
    function totalSupply() public view virtual returns (uint256) {
        return totalBatz;
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
            ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json")) : '.json';
    }
    function setTokenURI(uint256 _tokenId, string memory _tokenURI) public onlyOwner {
        _setTokenURI(_tokenId, _tokenURI);
    }
    function setStart(bool _start) public onlyOwner {
        started = _start;
    }

    function mintAll() public onlyOwner {
        for(uint256 i=1; i <= totalCount; i++){
            _mint(address(this), i);
            totalBatz = i;
        }
    }

    function mintAllToAddress(address addr) public onlyOwner {
        for(uint256 i=1; i <= totalCount; i++){
            _mint(addr, i);
            totalBatz = i;
        }
    }

    function mintFree(uint256 times) public {
        for(uint256 i=1; i <= times; i++){
            _mint(msg.sender, ++totalBatz);
        }
    }
}