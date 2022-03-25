pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "hardhat/console.sol";

interface IOldGardeningStakingContract is IERC20 {
    function depositsOf(address account) external returns (uint256[] memory);
}

contract MegaGardensDeveloped is ERC721URIStorage, Ownable, Pausable {
    using Strings for uint256;
    event MintFromCrop(address indexed sender, uint256 startWith, uint256 times);
    event ClaimedUpgrade(address indexed sender, uint256 startWith, uint256 times);

    //uints 
    uint256 public currentSupply;
    uint256 public totalCount = 7777;
    uint256 public maxBatch = 10;
    address public oldGardenStakingAddress;
    address public contractAddress;
    address public batchTokenAddress;
    uint256 public batchCostToMint;

    //strings 
    string public baseURI;

    mapping(address => bool) private _hasAddressClaimedTokens;

    //constructor args 
    constructor() ERC721("MegaGardensDeveloped", "FGardensDev") {
        contractAddress = address(this);
        pause();
    }
    modifier whenOldStakingAddressSet() {
        require(oldGardenStakingAddress != address(0), "oldGardenStakingAddress not set");
        _;
    }
    modifier whenCropTokenAddressSet() {
        require(batchTokenAddress != address(0), "batchTokenAddress not set");
        _;
    }
    modifier whenCropCostSet() {
        require(batchCostToMint > 0, "batchCostToMint not set");
        _;
    }

    function pause() public onlyOwner {
        _pause();
    }
    function unpause() public onlyOwner {
        _unpause();
    }
    function _baseURI() internal view virtual override returns (string memory){
        return baseURI;
    }
    function setBaseURI(string memory _newURI) public onlyOwner {
        baseURI = _newURI;
    }
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "Token does not exist.");
        
        return bytes(baseURI).length > 0
            ? string(abi.encodePacked(baseURI, tokenId.toString(), ".json")) : ".json";
    }
    function setTokenURI(uint256 tokenId, string memory uri) public onlyOwner {
        _setTokenURI(tokenId, uri);
    }
    function setOldGardenStakingAddress(address oldAddress) public onlyOwner whenPaused {
        oldGardenStakingAddress = oldAddress;
    }
    function setCropTokenAddress(address batchAddress) public onlyOwner whenPaused {
        batchTokenAddress = batchAddress;
    }
    function setCropCostToMint(uint256 batchCost) public onlyOwner whenPaused {
        batchCostToMint = batchCost;
    }
    function mintFromOldStakingAddress() public whenNotPaused whenOldStakingAddressSet {
        uint256[] memory tokenIds = IOldGardeningStakingContract(oldGardenStakingAddress).depositsOf(msg.sender);
        require(tokenIds.length > 0, "No deposited tokens to claim");
        require(!_hasAddressClaimedTokens[msg.sender], "All tokens have been claimed");
        uint256 startId = currentSupply+1;
        mint(tokenIds.length);
        emit ClaimedUpgrade(_msgSender(), startId, tokenIds.length);
    }
    function mintWithCrop(uint256 times, uint256 batchAmount) public whenNotPaused whenCropTokenAddressSet whenCropCostSet {
        require(times > 0 && times <= maxBatch, "Invalid number to mint");
        require(currentSupply + times <= totalCount, "This would mint too many tokens");
        require(batchAmount == batchCostToMint * times, "Invalid batch amount");
        uint256 allowance = IERC20(batchTokenAddress).allowance(msg.sender, address(this));
        require(batchAmount <= allowance,
            string(abi.encodePacked("batchAmount greater than allowed value of: ", allowance.toString())));

        // Transfer the required amount of tokens to this contract as payment for minting
        IERC20(batchTokenAddress).transferFrom(msg.sender, address(this), batchAmount);
        uint256 startId = currentSupply+1;
        mint(times);
        emit MintFromCrop(_msgSender(), startId, times);
    }
    function mint(uint256 times) private {
        for(uint256 i=0; i< times; i++){
            _mint(_msgSender(), ++currentSupply);
        }
    }
}