// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WillVault
 * @dev 遗嘱金库合约 - 允许用户存入资金，设置受益人，并在延迟后自动分配
 * @notice 部署在 Kite AI Testnet (ChainID: 2368)
 */
contract WillVault {
    // ==================== 状态变量 ====================
    
    address public owner;           // 金库所有者
    uint256 public unlockTime;      // 解锁时间戳
    uint256 public inactivityPeriod; // 不活跃期限（秒）
    uint256 public lastHeartbeat;   // 最后心跳时间
    bool public isSealed;           // 是否已封存
    bool public isExecuted;         // 是否已执行
    
    // 受益人结构
    struct Beneficiary {
        address wallet;
        uint256 percentage;  // 以 100 为基数 (e.g., 50 = 50%)
        string name;         // 受益人名称
    }
    
    Beneficiary[] public beneficiaries;
    
    // ==================== 事件 ====================
    
    event Deposited(address indexed from, uint256 amount);
    event BeneficiariesSet(uint256 count);
    event WillSealed(uint256 unlockTime);
    event Heartbeat(uint256 timestamp);
    event WillExecuted(uint256 totalDistributed);
    event FundsDistributed(address indexed beneficiary, uint256 amount);
    
    // ==================== 修饰符 ====================
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    modifier notSealed() {
        require(!isSealed, "Will is already sealed");
        _;
    }
    
    modifier onlySealed() {
        require(isSealed, "Will must be sealed first");
        _;
    }
    
    modifier notExecuted() {
        require(!isExecuted, "Will already executed");
        _;
    }
    
    // ==================== 构造函数 ====================
    
    constructor() {
        owner = msg.sender;
        lastHeartbeat = block.timestamp;
        inactivityPeriod = 180 days; // 默认 180 天
    }
    
    // ==================== 核心功能 ====================
    
    /**
     * @dev 存入资金
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit something");
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @dev 设置受益人列表
     * @param _beneficiaries 受益人数组
     */
    function setBeneficiaries(Beneficiary[] memory _beneficiaries) external onlyOwner notSealed {
        require(_beneficiaries.length > 0, "At least one beneficiary required");
        
        // 验证百分比总和
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            require(_beneficiaries[i].wallet != address(0), "Invalid beneficiary address");
            require(_beneficiaries[i].percentage > 0, "Percentage must be > 0");
            totalPercentage += _beneficiaries[i].percentage;
        }
        require(totalPercentage == 100, "Total percentage must equal 100");
        
        // 清空并设置新受益人
        delete beneficiaries;
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            beneficiaries.push(_beneficiaries[i]);
        }
        
        emit BeneficiariesSet(_beneficiaries.length);
    }
    
    /**
     * @dev 设置不活跃期限
     * @param _seconds 不活跃秒数
     */
    function setInactivityPeriod(uint256 _seconds) external onlyOwner notSealed {
        require(_seconds >= 1 days, "Minimum 1 day");
        inactivityPeriod = _seconds;
    }
    
    /**
     * @dev 封存遗嘱
     */
    function seal() external onlyOwner notSealed {
        require(beneficiaries.length > 0, "Set beneficiaries first");
        require(address(this).balance > 0, "Deposit funds first");
        
        isSealed = true;
        lastHeartbeat = block.timestamp;
        unlockTime = block.timestamp + inactivityPeriod;
        
        emit WillSealed(unlockTime);
    }
    
    /**
     * @dev 心跳续期 - 重置解锁时间
     */
    function heartbeat() external onlyOwner onlySealed notExecuted {
        lastHeartbeat = block.timestamp;
        unlockTime = block.timestamp + inactivityPeriod;
        
        emit Heartbeat(block.timestamp);
    }
    
    /**
     * @dev 执行遗嘱分配 - 任何人可调用，但需满足时间条件
     */
    function execute() external onlySealed notExecuted {
        require(block.timestamp >= unlockTime, "Unlock time not reached");
        
        isExecuted = true;
        uint256 balance = address(this).balance;
        uint256 totalDistributed = 0;
        
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            uint256 share = (balance * beneficiaries[i].percentage) / 100;
            
            (bool success, ) = beneficiaries[i].wallet.call{value: share}("");
            if (success) {
                totalDistributed += share;
                emit FundsDistributed(beneficiaries[i].wallet, share);
            }
        }
        
        emit WillExecuted(totalDistributed);
    }
    
    // ==================== 视图函数 ====================
    
    /**
     * @dev 获取金库余额
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev 获取受益人数量
     */
    function getBeneficiaryCount() external view returns (uint256) {
        return beneficiaries.length;
    }
    
    /**
     * @dev 获取受益人信息
     */
    function getBeneficiary(uint256 index) external view returns (
        address wallet,
        uint256 percentage,
        string memory name
    ) {
        require(index < beneficiaries.length, "Invalid index");
        Beneficiary memory b = beneficiaries[index];
        return (b.wallet, b.percentage, b.name);
    }
    
    /**
     * @dev 获取遗嘱状态
     */
    function getStatus() external view returns (
        bool _isSealed,
        bool _isExecuted,
        uint256 _balance,
        uint256 _unlockTime,
        uint256 _lastHeartbeat,
        uint256 _timeUntilUnlock
    ) {
        _isSealed = isSealed;
        _isExecuted = isExecuted;
        _balance = address(this).balance;
        _unlockTime = unlockTime;
        _lastHeartbeat = lastHeartbeat;
        _timeUntilUnlock = unlockTime > block.timestamp ? unlockTime - block.timestamp : 0;
    }
    
    /**
     * @dev 检查是否可以执行
     */
    function canExecute() external view returns (bool) {
        return isSealed && !isExecuted && block.timestamp >= unlockTime;
    }
    
    // ==================== 接收 ETH ====================
    
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
}
