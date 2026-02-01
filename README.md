<div align="center">
  <img src="./silene_logo.png" alt="Silene Logo" width="180" />
  
  # Silene (死了呢)
  
  ### AI Digital Legacy Protocol
  
  **基于 Kite AI Chain 的数字遗产智能分配协议**

[![Kite AI Chain](https://img.shields.io/badge/Chain-Kite_AI_Testnet-purple?style=flat-square)](https://testnet.kitescan.ai)
[![Built with](https://img.shields.io/badge/Built_with-gokite_aa_sdk-blue?style=flat-square)](https://github.com/AliensZone/gokite-aa-sdk)
[![AI](https://img.shields.io/badge/AI-Gemini_API-orange?style=flat-square)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

</div>

---

## 🌟 项目简介

**Silene** 是一个 **AI 驱动的数字遗嘱执行协议**，让用户以自然语言编写遗嘱，通过 Dead Man's Switch 机制自动触发链上支付，将加密资产安全分配给受益人。

### 核心痛点解决

| 问题           | 传统方案         | Silene 方案                |
| -------------- | ---------------- | -------------------------- |
| 私钥不能分享   | 写纸条、记忆密码 | ERC-20 Approve 授权模式    |
| 何时执行遗嘱？ | 依赖遗嘱执行人   | Dead Man's Switch 自动触发 |
| 如何分配资产？ | 手动计算百分比   | AI 解析自然语言遗嘱        |
| 意图验证       | 无法确认真意     | 社交媒体哨兵 + AI 分析     |

---

## 🔧 核心功能

### 1. 🤖 AI 驱动的遗嘱解析

用户可以使用自然语言编写遗嘱，AI 自动解析受益人和分配比例：

```
用户输入：
"我希望把我所有的资产，30% 给我妻子 Alice，
 50% 给我儿子 Bob，20% 捐给红十字会。"

AI 解析输出：
- Alice (妻子): 30%
- Bob (儿子): 50%
- 红十字会: 20%
```

### 2. ⏰ Dead Man's Switch

智能死亡触发机制：

- 用户设置心跳周期（如 30 天）
- 每次登录/签到重置倒计时
- 倒计时归零 → 自动触发遗嘱执行
- 支持社交媒体哨兵辅助验证

### 3. 💼 多钱包聚合分配

支持关联多个钱包到同一遗嘱账户：

- 每个钱包独立签名授权（EIP-712 + ERC-20 Approve）
- 执行时自动遍历所有已授权钱包
- 按比例从每个钱包分配资产
- 某钱包余额不足时跳过，继续处理其他钱包

### 4. 🧠 意图验证与加权分配

当检测到遗嘱与社交信号不一致时：

- AI 扫描用户 Twitter 动态
- 分析提取用户真实意图
- 当匹配度 < 50% 时，启用加权分配公式：
  ```
  调整后分配 = 原遗嘱比例 × 遗嘱权重 + 社交意图 × 社交权重
  ```
- 保护机制：遗嘱始终保留至少 20% 权重

### 5. 📜 链上死亡证明

- `DeathCertificateRegistry` 合约永久记录死亡声明
- 任何人可验证遗嘱执行状态
- 不可篡改、透明可追溯

### 6. 💰 自动链上支付

```
执行流程：
1. Dead Man's Switch 激活
2. 死亡证明上链 (DeathCertificateRegistry)
3. 遍历所有授权钱包
4. 按比例 TransferFrom 到受益人地址
5. 交易记录持久化到数据库
```

**用户只需签名一次，后续执行完全自动化！**

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 前端依赖
cd frontend
npm install

# 后端依赖
cd ../backend
npm install
```

### 2. 配置环境变量

**前端** `frontend/.env.local`:

```env
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_BACKEND_URL=http://localhost:3001
```

**后端** `backend/.env`:

```env
# 托管钱包私钥 (用于代发交易)
CUSTODY_PRIVATE_KEY=你的钱包私钥

# 稳定币合约地址 (可选，默认 Kite Settlement Token)
SETTLEMENT_TOKEN=0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63

# 死亡证明合约地址
DEATH_CERTIFICATE_REGISTRY=0x...
```

### 3. 获取测试代币

1. 访问 https://faucet.gokite.ai
2. 输入托管钱包地址
3. 领取 KITE 测试代币
4. 如需稳定币，同样充值到托管钱包

### 4. 启动服务

```bash
# 终端 1: 启动后端
cd backend
npm run dev

# 终端 2: 启动前端
cd frontend
npm run dev
```

访问 http://localhost:5173

---

## 📋 完整流程演示

```
1. 连接钱包
   → MetaMask 连接 Kite Testnet
   → 后端 gokite-aa-sdk 计算 AA 地址

2. 编写遗嘱
   → 用户输入自然语言遗嘱
   → AI 解析受益人和分配比例

3. 关联多钱包（可选）
   → 点击 "Link New Wallet"
   → 每个钱包独立签名验证

4. 封存遗嘱 (Seal)
   → 每个钱包授权 ERC-20 Approve
   → 签署 EIP-712 消息
   → 后端存储授权 + 额度限制

5. 触发执行
   → Dead Man's Switch 倒计时结束
   → 或手动确认死亡触发

6. 自动转账 ⭐
   → 死亡证明上链
   → 后端托管钱包代发交易
   → 稳定币/KITE 自动分发给受益人
   → 用户无需再次签名
```

---

## 🏗️ 项目结构

```
silene/
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── App.tsx             # 主应用组件
│   │   ├── services/
│   │   │   ├── kiteService.ts          # Kite 链上服务
│   │   │   ├── agentService.ts         # AI Agent 服务
│   │   │   └── backendProxyService.ts  # 后端 API 客户端
│   │   └── components/          # UI 组件
│   └── ...
├── backend/                     # Express 后端
│   ├── server.ts               # API 服务入口
│   ├── willService.ts          # 遗嘱服务 + 额度控制
│   ├── kiteSDKService.ts       # gokite-aa-sdk 集成
│   └── database.ts             # SQLite 持久化
├── contracts/                   # 智能合约
│   ├── DeathCertificateRegistry.sol  # 死亡证明合约
│   └── WillVault.sol                 # 遗嘱保险库合约 （未启用）
├── docs/                        # 项目文档
│   ├── 01_需求设计/
│   ├── 02_开发计划/
│   └── 03_演示材料/
└── scripts/                     # 部署脚本
```

---

## 🔐 核心技术

### Agent 身份 (gokite-aa-sdk)

```typescript
// backend/kiteSDKService.ts
const aa = await GokiteAASDK.create({
  chain: "kite_testnet",
  privateKey: ownerPrivateKey,
});
const aaAddress = aa.getAAAddress();
```

### 稳定币转账 (ERC-20)

```typescript
// backend/willService.ts
const tokenContract = new ethers.Contract(SETTLEMENT_TOKEN, ERC20_ABI, wallet);
await tokenContract.transferFrom(ownerWallet, beneficiary.address, amount);
```

### 支付额度控制

```typescript
// backend/willService.ts
const DEFAULT_SPENDING_LIMITS = {
  perTxLimit: ethers.parseEther("100"), // 单笔 100
  dailyLimit: ethers.parseEther("1000"), // 每日 1000
};
```

### 死亡证明上链

```typescript
// backend/willService.ts
const registry = new ethers.Contract(
  DEATH_CERTIFICATE_REGISTRY,
  DEATH_CERTIFICATE_ABI,
  wallet,
);
await registry.recordDeath(willId, ownerAddress, timestamp);
```

---

## 📊 技术架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Connect     │  │ Write Will  │  │ Dead Man's Switch   │  │
│  │ Wallet      │  │ (NL Input)  │  │ Timer               │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express.js)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ gokite-aa   │  │ Gemini AI   │  │ willService         │  │
│  │ -sdk        │  │ Parser      │  │ (Spending Limits)   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │              │
│         │         ┌──────┴──────┐             │              │
│         │         │ SQLite DB   │             │              │
│         │         └─────────────┘             │              │
└─────────┼─────────────────────────────────────┼─────────────┘
          │                                     │
          ▼                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Kite AI Chain (Testnet)                   │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │ AA Wallet       │  │ DeathCertificateRegistry       │   │
│  │ (Account        │  │ (On-chain Death Proof)         │   │
│  │  Abstraction)   │  │                                 │   │
│  └─────────────────┘  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Kite Settlement Token (USDT-like Stablecoin)        │    │
│  │ 0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛡️ 安全特性

| 特性             | 说明                                       |
| ---------------- | ------------------------------------------ |
| **无私钥暴露**   | 用户资产始终在自己钱包，仅授权 ERC-20 转账 |
| **支付额度限制** | 单笔 + 每日额度双重保护                    |
| **意图验证**     | 社交媒体哨兵防止误触发                     |
| **加权分配保护** | 遗嘱权重最低 20%，防止社交劫持             |
| **链上可验证**   | 死亡证明永久记录，任何人可审计             |

---

## 📚 技术栈

| 层级     | 技术                          |
| -------- | ----------------------------- |
| 前端     | React 19 + TypeScript + Vite  |
| 后端     | Node.js + Express + ethers.js |
| 数据库   | SQLite (better-sqlite3)       |
| AI       | Google Gemini API             |
| 区块链   | Kite Chain (EVM)              |
| SDK      | gokite-aa-sdk                 |
| 智能合约 | Solidity                      |

---

## 🔗 相关链接

- **区块浏览器**: https://testnet.kitescan.ai
- **水龙头**: https://faucet.gokite.ai

---

## 📝 License

MIT
