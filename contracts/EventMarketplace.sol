// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IEventVault {
    function organizer() external view returns (address);
    function refund(address to, uint256 amount) external;
    function markCancelled() external;
    function openProposal(uint256 sold, uint64 deadline) external;
    function recordObjection() external;
    function passIfQuorum() external;
    function escalate(string calldata uri) external;
    function withdraw() external;
    function withdrawToken(address token) external;
    receive() external payable;
}

interface IDemoBank {
    function pull(address from, address to, uint256 amount) external;
}

interface ITicketCollection {
    function mint(uint256 id, uint32 tierId) external;
    function marketTransfer(address from, address to, uint256 id) external;
    function burn(uint256 id) external;
    function checkIn(uint256 id) external;
    function ownerOf(uint256 id) external view returns (address);
    function setTierURI(uint32 tierId, string calldata uri) external;
}

/// @title Per-event ticket venue
/// @notice Inventory, Buy Now, 90–110% resale cap. Money goes to the event vault
///         (primary + royalty). ERC-721 tickets only move through this contract.
///         The buyer’s own wallet sends buy() — that transaction is the signature.
contract EventMarketplace {
    struct Ticket {
        uint32 tierId;
        uint32 serial;
        uint256 face;
        address owner;
        address seller;
        uint256 price;
        uint8 status; // 0 vault/listed, 1 owned, 2 listed, 3 used, 4 refunded
    }

    IEventVault public vault;
    IDemoBank public bank;
    ITicketCollection public collection;
    address public organizer;
    address public operator;
    uint16 public royaltyBps;
    uint64 public endsAt;
    uint256 public nextId;
    bool public frozen;
    uint32 public proposalId;
    mapping(uint256 => Ticket) public tickets;
    mapping(address => uint256) public held;
    mapping(uint256 => uint32) public votedOn;

    event Minted(uint256 indexed id, uint32 tierId, uint32 serial, uint256 face);
    event Bought(uint256 indexed id, address indexed buyer, uint256 price, bool primary);
    event Listed(uint256 indexed id, address indexed seller, uint256 price);
    event Delisted(uint256 indexed id);
    event CheckedIn(uint256 indexed id, address indexed owner);
    event Refunded(uint256 indexed id, address indexed owner, uint256 face);
    event Frozen(bool on);
    event CollectionSet(address collection);
    event WithdrawRequested(uint32 proposalId, uint256 sold, uint64 deadline);
    event Voted(uint256 indexed id, address indexed voter, uint32 proposalId);

    modifier onlyOrganizer() {
        require(msg.sender == organizer || msg.sender == operator, "org");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == organizer, "op");
        _;
    }

    constructor(
        address organizer_,
        address payable vault_,
        address operator_,
        address bank_,
        uint16 royaltyBps_,
        uint64 endsAt_
    ) {
        require(organizer_ != address(0) && vault_ != address(0), "zero");
        require(royaltyBps_ <= 2000, "bps");
        organizer = organizer_;
        vault = IEventVault(vault_);
        operator = operator_;
        bank = IDemoBank(bank_);
        royaltyBps = royaltyBps_;
        endsAt = endsAt_;
    }

    function setCollection(address collection_) external onlyOperator {
        require(address(collection) == address(0), "set");
        require(collection_ != address(0), "zero");
        collection = ITicketCollection(collection_);
        emit CollectionSet(collection_);
    }

    function setTierURI(uint32 tierId, string calldata uri) external onlyOrganizer {
        require(address(collection) != address(0), "col");
        collection.setTierURI(tierId, uri);
    }

    function mintTier(uint32 tierId, uint32 supply, uint256 face) external onlyOrganizer {
        require(supply > 0 && supply <= 200, "supply");
        require(face > 0, "face");
        for (uint32 s = 1; s <= supply; s++) {
            nextId += 1;
            tickets[nextId] = Ticket({
                tierId: tierId,
                serial: s,
                face: face,
                owner: address(this),
                seller: address(this),
                price: face,
                status: 0
            });
            if (address(collection) != address(0)) {
                collection.mint(nextId, tierId);
            }
            emit Minted(nextId, tierId, s, face);
        }
    }

    /// @notice Buyer pays from their own wallet. The sent transaction is the signature.
    function buy(uint256 id) external payable {
        require(!frozen, "frz");
        _buy(id, msg.sender, msg.value);
    }

    function list(uint256 id, uint256 price) external {
        require(!frozen, "frz");
        Ticket storage t = tickets[id];
        require(t.owner == msg.sender, "own");
        require(t.status == 1, "st");
        if (address(collection) != address(0)) {
            require(collection.ownerOf(id) == msg.sender, "own");
        }
        _bound(t.face, price);
        t.status = 2;
        t.seller = t.owner;
        t.price = price;
        emit Listed(id, t.owner, price);
    }

    function delist(uint256 id) external {
        require(!frozen, "frz");
        Ticket storage t = tickets[id];
        require(t.owner == msg.sender, "own");
        require(t.status == 2, "st");
        t.status = 1;
        t.price = 0;
        emit Delisted(id);
    }

    function setFrozen(bool on) external onlyOperator {
        frozen = on;
        emit Frozen(on);
    }

    function checkIn(uint256 id) external onlyOperator {
        Ticket storage t = tickets[id];
        require(t.status == 1 || t.status == 2, "st");
        t.status = 3;
        t.price = 0;
        if (address(collection) != address(0)) {
            collection.checkIn(id);
        }
        emit CheckedIn(id, t.owner);
    }

    function refundFace(uint256 id) external onlyOrganizer {
        require(block.timestamp < endsAt, "ended");
        Ticket storage t = tickets[id];
        require(t.status == 1 || t.status == 2 || t.status == 3, "st");
        address holder = t.owner;
        uint256 face = t.face;
        t.status = 4;
        t.price = 0;
        held[holder] -= 1;
        if (address(collection) != address(0)) {
            collection.burn(id);
        }
        if (address(bank) == address(0)) {
            vault.refund(holder, face);
        } else {
            bank.pull(address(vault), holder, face);
        }
        emit Refunded(id, holder, face);
    }

    function markCancelled() external onlyOrganizer {
        require(block.timestamp < endsAt, "ended");
        vault.markCancelled();
    }

    function requestWithdraw() external onlyOrganizer {
        require(!frozen, "frz");
        require(block.timestamp >= endsAt, "early");
        uint256 sold;
        for (uint256 i = 1; i <= nextId; i++) {
            uint8 st = tickets[i].status;
            if (st == 1 || st == 2 || st == 3) sold += 1;
        }
        proposalId += 1;
        uint64 deadline = uint64(block.timestamp + 7 days);
        vault.openProposal(sold, deadline);
        emit WithdrawRequested(proposalId, sold, deadline);
    }

    function vote(uint256 id) external {
        require(!frozen, "frz");
        require(proposalId != 0, "no");
        Ticket storage t = tickets[id];
        require(t.status == 1 || t.status == 2 || t.status == 3, "st");
        require(t.owner == msg.sender, "own");
        if (address(collection) != address(0)) {
            require(collection.ownerOf(id) == msg.sender, "own");
        }
        require(votedOn[id] != proposalId, "voted");
        votedOn[id] = proposalId;
        vault.recordObjection();
        emit Voted(id, msg.sender, proposalId);
    }

    function executeWithdraw(address token) external onlyOrganizer {
        require(!frozen, "frz");
        vault.passIfQuorum();
        if (token == address(0)) vault.withdraw();
        else vault.withdrawToken(token);
    }

    function escalate(string calldata uri) external onlyOrganizer {
        vault.escalate(uri);
    }

    function _buy(uint256 id, address buyer, uint256 value) internal {
        Ticket storage t = tickets[id];
        require(t.status == 0 || t.status == 2, "st");
        require(block.timestamp <= endsAt, "ended");
        require(held[buyer] == 0, "one");
        uint256 price = t.price;
        bool primary = t.seller == address(this);
        address from = t.owner;
        _takePayment(buyer, t.seller, price, primary, value);
        if (t.status == 2 && t.owner != address(this) && t.owner != buyer) {
            held[t.owner] -= 1;
        }
        t.owner = buyer;
        t.seller = address(0);
        t.price = 0;
        t.status = 1;
        held[buyer] += 1;
        if (address(collection) != address(0)) {
            collection.marketTransfer(from, buyer, id);
        }
        emit Bought(id, buyer, price, primary);
    }

    function _takePayment(
        address buyer,
        address seller,
        uint256 price,
        bool primary,
        uint256 value
    ) internal {
        if (address(bank) == address(0)) {
            require(value == price, "val");
            if (primary) {
                (bool ok, ) = address(vault).call{value: price}("");
                require(ok, "vault");
            } else {
                uint256 royalty = (price * royaltyBps) / 10000;
                (bool a, ) = address(vault).call{value: royalty}("");
                require(a, "roy");
                (bool b, ) = seller.call{value: price - royalty}("");
                require(b, "sel");
            }
        } else {
            require(value == 0, "token");
            if (primary) {
                bank.pull(buyer, address(vault), price);
            } else {
                uint256 royalty = (price * royaltyBps) / 10000;
                bank.pull(buyer, address(vault), royalty);
                bank.pull(buyer, seller, price - royalty);
            }
        }
    }

    function _bound(uint256 face, uint256 price) internal pure {
        uint256 minP = (face * 90) / 100;
        uint256 maxP = (face * 110) / 100;
        require(price >= minP && price <= maxP, "bound");
    }
}
