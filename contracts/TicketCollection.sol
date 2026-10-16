// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title Per-event ERC-721 ticket collection
/// @notice Minted into the event marketplace. Transfers only succeed when the
///         marketplace is msg.sender — no private gifts or wallet-to-wallet
///         transferFrom. tokenURI is a Pinata/IPFS JSON (one URI per tier).
contract TicketCollection is ERC721 {
    address public organizer;
    address public operator;
    address public marketplace;
    bool public frozen;
    mapping(uint256 => bool) public used;
    mapping(uint256 => uint32) public tierOf;
    mapping(uint32 => string) public tierURI;

    event Frozen(bool on);
    event TierURI(uint32 indexed tierId, string uri);
    event CheckedIn(uint256 indexed id);

    modifier onlyMarket() {
        require(msg.sender == marketplace, "mkt");
        _;
    }

    modifier onlyOp() {
        require(msg.sender == operator || msg.sender == organizer, "op");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address organizer_,
        address operator_,
        address marketplace_
    ) ERC721(name_, symbol_) {
        require(organizer_ != address(0) && marketplace_ != address(0), "zero");
        organizer = organizer_;
        operator = operator_;
        marketplace = marketplace_;
    }

    function setFrozen(bool on) external onlyOp {
        frozen = on;
        emit Frozen(on);
    }

    function setTierURI(uint32 tierId, string calldata uri) external onlyMarket {
        require(bytes(uri).length > 0, "uri");
        tierURI[tierId] = uri;
        emit TierURI(tierId, uri);
    }

    function mint(uint256 id, uint32 tierId) external onlyMarket {
        require(bytes(tierURI[tierId]).length > 0, "uri");
        tierOf[id] = tierId;
        _mint(marketplace, id);
    }

    function marketTransfer(address from, address to, uint256 id) external onlyMarket {
        require(!frozen, "frz");
        _transfer(from, to, id);
    }

    function burn(uint256 id) external onlyMarket {
        _burn(id);
    }

    function checkIn(uint256 id) external onlyMarket {
        require(_ownerOf(id) != address(0), "st");
        require(!used[id], "used");
        used[id] = true;
        emit CheckedIn(id);
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        string memory u = tierURI[tierOf[id]];
        require(bytes(u).length > 0, "uri");
        return u;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            require(msg.sender == marketplace, "escrow");
            require(!frozen, "frz");
        }
        return super._update(to, tokenId, auth);
    }
}
