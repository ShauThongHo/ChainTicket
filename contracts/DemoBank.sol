// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Dev-mode circulating test currency (DxDAI, 18 decimals)
/// @notice Admin deploys this to mint a 10_000 DxDAI pool. Attendees claim a
///         drip with their own signed transaction. Turn it off to settle in
///         native xDAI. Event marketplaces must be allow-listed to pull.
contract DemoBank {
    string public constant name = "Demo xDAI";
    string public constant symbol = "DxDAI";
    uint8 public constant decimals = 18;
    uint256 public constant POOL = 10_000 ether;
    uint256 public constant DRIP = 100 ether;

    address public admin;
    address public operator;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => bool) public dripped;
    mapping(address => bool) public markets;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Drip(address indexed to, uint256 amount);
    event MarketSet(address indexed market, bool ok);

    modifier onlyAdmin() {
        require(msg.sender == admin, "admin");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator || msg.sender == admin, "op");
        _;
    }

    constructor(address admin_, address operator_) {
        require(admin_ != address(0), "admin");
        admin = admin_;
        operator = operator_;
        balanceOf[address(this)] = POOL;
        totalSupply = POOL;
        emit Transfer(address(0), address(this), POOL);
    }

    function setOperator(address operator_) external onlyAdmin {
        operator = operator_;
    }

    function setMarket(address market, bool ok) external onlyOperator {
        markets[market] = ok;
        emit MarketSet(market, ok);
    }

    function claim() external {
        require(!dripped[msg.sender], "once");
        require(balanceOf[address(this)] >= DRIP, "pool");
        dripped[msg.sender] = true;
        balanceOf[address(this)] -= DRIP;
        balanceOf[msg.sender] += DRIP;
        emit Drip(msg.sender, DRIP);
        emit Transfer(address(this), msg.sender, DRIP);
    }

    function drip(address to, uint256 amount) external onlyOperator {
        require(balanceOf[address(this)] >= amount, "pool");
        balanceOf[address(this)] -= amount;
        balanceOf[to] += amount;
        emit Drip(to, amount);
        emit Transfer(address(this), to, amount);
    }

    function transfer(address to, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
    }

    function pull(address from, address to, uint256 amount) external {
        require(msg.sender == operator || msg.sender == admin || markets[msg.sender], "op");
        require(balanceOf[from] >= amount, "bal");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
