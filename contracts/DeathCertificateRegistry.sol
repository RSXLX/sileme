// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DeathCertificateRegistry
 * @dev 死亡证明注册表 - 存储遗嘱触发的死亡确认信息
 * @notice 部署在 Kite AI Testnet (ChainID: 2368)
 * 
 * 功能：
 * - 存储死亡证明信息（willId, owner, timestamp, message）
 * - 仅授权地址可写入
 * - 每个 willId 只能记录一次
 * - 提供查询接口供验证
 */
contract DeathCertificateRegistry {
    
    // ==================== 状态变量 ====================
    
    address public admin;           // 管理员地址
    address public recorder;        // 授权记录者地址 (Custody Wallet)
    
    struct Certificate {
        bytes32 willId;             // 遗嘱 ID (keccak256 hash)
        address owner;              // 遗嘱所有者
        uint256 timestamp;          // 死亡确认时间
        uint256 beneficiaryCount;   // 受益人数量
        string message;             // 死亡声明消息
        address recordedBy;         // 记录者地址
    }
    
    // willId => Certificate
    mapping(bytes32 => Certificate) public certificates;
    
    // owner => willId (一个地址只能有一个死亡证明)
    mapping(address => bytes32) public ownerToWillId;
    
    // 证明数量统计
    uint256 public totalCertificates;
    
    // ==================== 事件 ====================
    
    event DeathRecorded(
        bytes32 indexed willId,
        address indexed owner,
        uint256 timestamp,
        uint256 beneficiaryCount,
        string message
    );
    
    event RecorderUpdated(address indexed oldRecorder, address indexed newRecorder);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    
    // ==================== 修饰符 ====================
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    modifier onlyRecorder() {
        require(msg.sender == recorder || msg.sender == admin, "Not authorized");
        _;
    }
    
    // ==================== 构造函数 ====================
    
    /**
     * @dev 构造函数
     * @param _recorder 授权记录者地址（通常是后端 Custody Wallet）
     */
    constructor(address _recorder) {
        require(_recorder != address(0), "Invalid recorder");
        admin = msg.sender;
        recorder = _recorder;
    }
    
    // ==================== 核心功能 ====================
    
    /**
     * @dev 记录死亡证明
     * @param _willId 遗嘱 ID (bytes32，建议使用 keccak256(willIdString))
     * @param _owner 遗嘱所有者地址
     * @param _beneficiaryCount 受益人数量
     * @param _message 死亡声明消息
     */
    function recordDeath(
        bytes32 _willId,
        address _owner,
        uint256 _beneficiaryCount,
        string calldata _message
    ) external onlyRecorder {
        require(_willId != bytes32(0), "Invalid willId");
        require(_owner != address(0), "Invalid owner");
        require(certificates[_willId].timestamp == 0, "Already recorded");
        
        certificates[_willId] = Certificate({
            willId: _willId,
            owner: _owner,
            timestamp: block.timestamp,
            beneficiaryCount: _beneficiaryCount,
            message: _message,
            recordedBy: msg.sender
        });
        
        ownerToWillId[_owner] = _willId;
        totalCertificates++;
        
        emit DeathRecorded(_willId, _owner, block.timestamp, _beneficiaryCount, _message);
    }
    
    // ==================== 查询功能 ====================
    
    /**
     * @dev 根据 willId 获取死亡证明
     * @param _willId 遗嘱 ID
     * @return owner 遗嘱所有者
     * @return timestamp 死亡确认时间
     * @return beneficiaryCount 受益人数量
     * @return message 死亡声明消息
     * @return recordedBy 记录者地址
     */
    function getCertificate(bytes32 _willId) external view returns (
        address owner,
        uint256 timestamp,
        uint256 beneficiaryCount,
        string memory message,
        address recordedBy
    ) {
        Certificate memory cert = certificates[_willId];
        return (cert.owner, cert.timestamp, cert.beneficiaryCount, cert.message, cert.recordedBy);
    }
    
    /**
     * @dev 检查某地址是否已有死亡证明
     * @param _owner 要检查的地址
     * @return 是否已死亡
     */
    function isDeceased(address _owner) external view returns (bool) {
        bytes32 willId = ownerToWillId[_owner];
        return certificates[willId].timestamp > 0;
    }
    
    /**
     * @dev 根据 owner 获取 willId
     * @param _owner 遗嘱所有者地址
     * @return 对应的 willId
     */
    function getWillIdByOwner(address _owner) external view returns (bytes32) {
        return ownerToWillId[_owner];
    }
    
    /**
     * @dev 检查 willId 是否已记录
     * @param _willId 遗嘱 ID
     * @return 是否已记录
     */
    function isRecorded(bytes32 _willId) external view returns (bool) {
        return certificates[_willId].timestamp > 0;
    }
    
    // ==================== 管理功能 ====================
    
    /**
     * @dev 更新授权记录者
     * @param _newRecorder 新的记录者地址
     */
    function setRecorder(address _newRecorder) external onlyAdmin {
        require(_newRecorder != address(0), "Invalid address");
        emit RecorderUpdated(recorder, _newRecorder);
        recorder = _newRecorder;
    }
    
    /**
     * @dev 转移管理员
     * @param _newAdmin 新管理员地址
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        emit AdminTransferred(admin, _newAdmin);
        admin = _newAdmin;
    }
}
