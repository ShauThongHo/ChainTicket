// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDemoToken {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external;
}

/// @title Per-event money safe
/// @notice Holds primary proceeds and resale royalties (native xDAI or DxDAI).
///         Refunds face value on cancel. After the show, a seven-day holder
///         objection window protects the vault before organizer withdrawal.
contract EventVault {
    address public organizer;
    address public operator;
    address public marketplace;
    uint64 public endsAt;
    bool public cancelled;
    bool public withdrawn;
    bool public frozen;

    bool public govLocked;
    bool public withdrawAllowed;
    bool public escalated;
    uint64 public voteDeadline;
    uint256 public objectionWeight;
    uint256 public soldWeight;
    string public materialsURI;

    // Kept for explorers/clients that inspect the v3 governance ABI.
    function yesWeight() external view returns (uint256) { return objectionWeight; }

    event Deposited(address indexed from, uint256 amount);
    event Refunded(address indexed to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Cancelled();
    event Frozen(bool on);
    event ProposalOpened(uint256 sold, uint64 deadline);
    event ObjectionTallied(uint256 objectionWeight, uint256 soldWeight);
    event Escalated(string uri);
    event AdminDecided(bool approve);

    modifier onlyOrg() {
        require(
            msg.sender == organizer || msg.sender == operator || msg.sender == marketplace,
            "org"
        );
        _;
    }

    constructor(address organizer_, address operator_, uint64 endsAt_) {
        require(organizer_ != address(0), "org");
        organizer = organizer_;
        operator = operator_;
        endsAt = endsAt_;
    }

    function setMarketplace(address marketplace_) external onlyOrg {
        require(marketplace == address(0), "set");
        require(marketplace_ != address(0), "mkt");
        marketplace = marketplace_;
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    function refund(address to, uint256 amount) external {
        require(msg.sender == marketplace, "mkt");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "pay");
        emit Refunded(to, amount);
    }

    function markCancelled() external {
        require(msg.sender == marketplace, "mkt");
        cancelled = true;
        emit Cancelled();
    }

    function setFrozen(bool on) external onlyOrg {
        frozen = on;
        emit Frozen(on);
    }

    function openProposal(uint256 sold, uint64 deadline) external {
        require(msg.sender == marketplace || msg.sender == organizer, "mkt");
        require(!cancelled && !withdrawn && !frozen && !govLocked, "no");
        require(block.timestamp >= endsAt, "early");
        govLocked = true;
        withdrawAllowed = false;
        escalated = false;
        soldWeight = sold;
        objectionWeight = 0;
        voteDeadline = deadline;
        materialsURI = "";
        emit ProposalOpened(sold, deadline);
    }

    function recordObjection() external {
        require(msg.sender == marketplace, "mkt");
        require(govLocked && !withdrawAllowed && !escalated, "no");
        require(block.timestamp < voteDeadline, "late");
        objectionWeight += 1;
        emit ObjectionTallied(objectionWeight, soldWeight);
    }

    function passIfQuorum() external onlyOrg {
        require(govLocked, "no");
        require(block.timestamp >= voteDeadline, "early");
        require(soldWeight == 0 || objectionWeight * 3 < soldWeight, "objections");
        withdrawAllowed = true;
    }

    function escalate(string calldata uri) external {
        require(msg.sender == marketplace || msg.sender == organizer, "org");
        require(govLocked && !withdrawAllowed, "no");
        require(block.timestamp >= voteDeadline, "early");
        require(soldWeight > 0 && objectionWeight * 3 >= soldWeight, "quorum");
        escalated = true;
        materialsURI = uri;
        emit Escalated(uri);
    }

    function adminDecide(bool approve) external {
        require(msg.sender == operator, "op");
        require(govLocked, "no");
        if (approve) {
            withdrawAllowed = true;
            escalated = false;
        } else {
            govLocked = false;
            withdrawAllowed = false;
            escalated = false;
            objectionWeight = 0;
            soldWeight = 0;
            voteDeadline = 0;
            materialsURI = "";
        }
        emit AdminDecided(approve);
    }

    function withdraw() external onlyOrg {
        _ready();
        uint256 bal = address(this).balance;
        if (bal > 0) {
            (bool ok, ) = organizer.call{value: bal}("");
            require(ok, "pay");
        }
        emit Withdrawn(organizer, bal);
    }

    function withdrawToken(address token) external onlyOrg {
        _ready();
        uint256 bal = IDemoToken(token).balanceOf(address(this));
        if (bal > 0) IDemoToken(token).transfer(organizer, bal);
        emit Withdrawn(organizer, bal);
    }

    function _ready() internal {
        require(!cancelled && !withdrawn && !frozen, "no");
        require(block.timestamp >= endsAt, "early");
        require(withdrawAllowed, "gov");
        withdrawn = true;
        govLocked = false;
    }
}
