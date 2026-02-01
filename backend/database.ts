/**
 * SQLite Database Service
 * 使用 better-sqlite3 实现遗嘱数据持久化
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM 兼容：获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据目录
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'silene.db');

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据库
const db = new Database(DB_PATH);

// 启用 WAL 模式提升性能
db.pragma('journal_mode = WAL');

// 创建表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS wills (
    willId TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    beneficiaries TEXT NOT NULL,
    totalAmount TEXT NOT NULL,
    validUntil INTEGER NOT NULL,
    signature TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    useStablecoin INTEGER NOT NULL DEFAULT 0,
    spendingLimits TEXT NOT NULL,
    aaWallet TEXT,
    kitepassAddress TEXT,
    useKitepass INTEGER NOT NULL DEFAULT 0,
    spendingRulesConfigured INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_wills_owner ON wills(owner);
  CREATE INDEX IF NOT EXISTS idx_wills_status ON wills(status);

  -- 交易记录表 (新增)
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    txHash TEXT NOT NULL UNIQUE,
    willId TEXT NOT NULL,
    owner TEXT NOT NULL,
    beneficiaryAddress TEXT NOT NULL,
    beneficiaryName TEXT,
    amount TEXT NOT NULL,
    tokenSymbol TEXT DEFAULT 'KITE',
    txType TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed',
    createdAt INTEGER NOT NULL,
    FOREIGN KEY (willId) REFERENCES wills(willId)
  );

  CREATE INDEX IF NOT EXISTS idx_tx_owner ON transactions(owner);
  CREATE INDEX IF NOT EXISTS idx_tx_willId ON transactions(willId);
  CREATE INDEX IF NOT EXISTS idx_tx_hash ON transactions(txHash);

  -- Twitter 好友表 (新增)
  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    screen_name TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    profile_image TEXT,
    statuses_count INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    friends_count INTEGER DEFAULT 0,
    media_count INTEGER DEFAULT 0,
    wallet_address TEXT,
    owner_wallet TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_friends_owner ON friends(owner_wallet);
  CREATE INDEX IF NOT EXISTS idx_friends_screen_name ON friends(screen_name);

  -- 多钱包关联表 (新增: 多钱包聚合分配功能)
  CREATE TABLE IF NOT EXISTS linked_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    willId TEXT NOT NULL,
    address TEXT NOT NULL,
    signature TEXT NOT NULL,
    approvedAt INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    lastBalance TEXT,
    FOREIGN KEY (willId) REFERENCES wills(willId),
    UNIQUE(willId, address)
  );

  CREATE INDEX IF NOT EXISTS idx_linked_wallets_willId ON linked_wallets(willId);
  CREATE INDEX IF NOT EXISTS idx_linked_wallets_address ON linked_wallets(address);
`);

console.log('✅ [Database] SQLite initialized at:', DB_PATH);

// ==================== 接口定义 ====================

interface Beneficiary {
  address: string;
  percentage: number;
  name: string;
}

interface SpendingLimits {
  perTxLimit: string;
  dailyLimit: string;
  dailySpent: string;
  lastResetDate: string;
}

export interface StoredWillAuthorization {
  willId: string;
  owner: string;
  beneficiaries: Beneficiary[];
  totalAmount: string;
  validUntil: number;
  signature: string;
  createdAt: number;
  status: 'pending' | 'executed' | 'expired';
  useStablecoin: boolean;
  spendingLimits: SpendingLimits;
  // KitePass 相关字段
  aaWallet?: string;
  kitepassAddress?: string;
  useKitepass: boolean;
  spendingRulesConfigured: boolean;
}

// ==================== 数据库操作 ====================

/**
 * 保存遗嘱
 */
export function saveWill(will: StoredWillAuthorization): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO wills 
    (willId, owner, beneficiaries, totalAmount, validUntil, signature, createdAt, status, useStablecoin, spendingLimits, aaWallet, kitepassAddress, useKitepass, spendingRulesConfigured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    will.willId,
    will.owner,
    JSON.stringify(will.beneficiaries),
    will.totalAmount,
    will.validUntil,
    will.signature,
    will.createdAt,
    will.status,
    will.useStablecoin ? 1 : 0,
    JSON.stringify(will.spendingLimits),
    will.aaWallet || null,
    will.kitepassAddress || null,
    will.useKitepass ? 1 : 0,
    will.spendingRulesConfigured ? 1 : 0
  );

  console.log(`💾 [Database] Will saved: ${will.willId}`);
}

/**
 * 根据 willId 获取遗嘱
 */
export function getWillById(willId: string): StoredWillAuthorization | null {
  const stmt = db.prepare('SELECT * FROM wills WHERE willId = ?');
  const row = stmt.get(willId) as any;

  if (!row) return null;

  return parseWillRow(row);
}

/**
 * 根据 owner 获取遗嘱
 */
export function getWillByOwner(owner: string): StoredWillAuthorization | null {
  const stmt = db.prepare('SELECT * FROM wills WHERE owner = ? ORDER BY createdAt DESC LIMIT 1');
  const row = stmt.get(owner.toLowerCase()) as any;

  if (!row) {
    // 尝试不区分大小写查找
    const stmtCI = db.prepare('SELECT * FROM wills WHERE LOWER(owner) = LOWER(?) ORDER BY createdAt DESC LIMIT 1');
    const rowCI = stmtCI.get(owner) as any;
    if (!rowCI) return null;
    return parseWillRow(rowCI);
  }

  return parseWillRow(row);
}

function parseWillRow(row: any): StoredWillAuthorization {
  return {
    willId: row.willId,
    owner: row.owner,
    beneficiaries: JSON.parse(row.beneficiaries),
    totalAmount: row.totalAmount,
    validUntil: row.validUntil,
    signature: row.signature,
    createdAt: row.createdAt,
    status: row.status,
    useStablecoin: row.useStablecoin === 1,
    spendingLimits: JSON.parse(row.spendingLimits),
    aaWallet: row.aaWallet || undefined,
    kitepassAddress: row.kitepassAddress || undefined,
    useKitepass: row.useKitepass === 1,
    spendingRulesConfigured: row.spendingRulesConfigured === 1,
  };
}

/**
 * 更新遗嘱状态
 */
export function updateWillStatus(willId: string, status: 'pending' | 'executed' | 'expired'): void {
  const stmt = db.prepare('UPDATE wills SET status = ? WHERE willId = ?');
  stmt.run(status, willId);
  console.log(`📝 [Database] Will ${willId} status updated to: ${status}`);
}

/**
 * 更新遗嘱支付限额
 */
export function updateWillSpendingLimits(willId: string, spendingLimits: SpendingLimits): void {
  const stmt = db.prepare('UPDATE wills SET spendingLimits = ? WHERE willId = ?');
  stmt.run(JSON.stringify(spendingLimits), willId);
}

/**
 * 获取所有遗嘱
 */
export function getAllWills(): StoredWillAuthorization[] {
  const stmt = db.prepare('SELECT * FROM wills ORDER BY createdAt DESC');
  const rows = stmt.all() as any[];
  return rows.map(parseWillRow);
}

/**
 * 删除遗嘱
 */
export function deleteWill(willId: string): void {
  const stmt = db.prepare('DELETE FROM wills WHERE willId = ?');
  stmt.run(willId);
  console.log(`🗑️ [Database] Will deleted: ${willId}`);
}

// ==================== 交易记录操作 ====================

export interface TransactionRecord {
  id?: number;
  txHash: string;
  willId: string;
  owner: string;
  beneficiaryAddress: string;
  beneficiaryName?: string;
  amount: string;
  tokenSymbol: string;
  txType: 'DEATH_DECLARATION' | 'DISTRIBUTION';
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: number;
}

/**
 * 保存交易记录
 */
export function saveTransaction(tx: TransactionRecord): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO transactions 
    (txHash, willId, owner, beneficiaryAddress, beneficiaryName, amount, tokenSymbol, txType, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    tx.txHash,
    tx.willId,
    tx.owner,
    tx.beneficiaryAddress,
    tx.beneficiaryName || null,
    tx.amount,
    tx.tokenSymbol,
    tx.txType,
    tx.status,
    tx.createdAt
  );

  console.log(`💾 [Database] Transaction saved: ${tx.txHash.slice(0, 10)}... (${tx.txType})`);
}

/**
 * 根据交易哈希获取交易
 */
export function getTransactionByHash(txHash: string): TransactionRecord | null {
  const stmt = db.prepare('SELECT * FROM transactions WHERE txHash = ?');
  const row = stmt.get(txHash) as any;
  return row ? parseTransactionRow(row) : null;
}

/**
 * 根据钱包地址获取交易列表
 */
export function getTransactionsByWallet(owner: string): TransactionRecord[] {
  const stmt = db.prepare('SELECT * FROM transactions WHERE LOWER(owner) = LOWER(?) ORDER BY createdAt DESC');
  const rows = stmt.all(owner) as any[];
  return rows.map(parseTransactionRow);
}

/**
 * 根据遗嘱ID获取交易列表
 */
export function getTransactionsByWillId(willId: string): TransactionRecord[] {
  const stmt = db.prepare('SELECT * FROM transactions WHERE willId = ? ORDER BY createdAt DESC');
  const rows = stmt.all(willId) as any[];
  return rows.map(parseTransactionRow);
}

/**
 * 获取所有交易
 */
export function getAllTransactions(limit: number = 100): TransactionRecord[] {
  const stmt = db.prepare('SELECT * FROM transactions ORDER BY createdAt DESC LIMIT ?');
  const rows = stmt.all(limit) as any[];
  return rows.map(parseTransactionRow);
}

function parseTransactionRow(row: any): TransactionRecord {
  return {
    id: row.id,
    txHash: row.txHash,
    willId: row.willId,
    owner: row.owner,
    beneficiaryAddress: row.beneficiaryAddress,
    beneficiaryName: row.beneficiaryName,
    amount: row.amount,
    tokenSymbol: row.tokenSymbol,
    txType: row.txType,
    status: row.status,
    createdAt: row.createdAt,
  };
}

// ==================== 好友记录操作 ====================

export interface FriendRecord {
  id?: number;
  user_id: string;
  screen_name: string;
  name: string;
  description: string;
  profile_image: string;
  statuses_count: number;
  followers_count: number;
  friends_count: number;
  media_count: number;
  wallet_address: string | null;
  owner_wallet: string;
  created_at: number;
  updated_at: number;
}

/**
 * 批量保存好友
 */
export function saveFriends(friends: FriendRecord[]): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO friends 
    (user_id, screen_name, name, description, profile_image, statuses_count, followers_count, friends_count, media_count, wallet_address, owner_wallet, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((friendsList: FriendRecord[]) => {
    for (const friend of friendsList) {
      stmt.run(
        friend.user_id,
        friend.screen_name,
        friend.name,
        friend.description || '',
        friend.profile_image || '',
        friend.statuses_count || 0,
        friend.followers_count || 0,
        friend.friends_count || 0,
        friend.media_count || 0,
        friend.wallet_address,
        friend.owner_wallet.toLowerCase(),
        friend.created_at,
        friend.updated_at
      );
    }
  });

  insertMany(friends);
  console.log(`💾 [Database] Saved ${friends.length} friends`);
}

/**
 * 根据用户钱包获取好友列表
 */
export function getFriendsByOwner(ownerWallet: string): FriendRecord[] {
  const stmt = db.prepare('SELECT * FROM friends WHERE LOWER(owner_wallet) = LOWER(?) ORDER BY followers_count DESC');
  const rows = stmt.all(ownerWallet) as any[];
  return rows.map(parseFriendRow);
}

/**
 * 更新好友的钱包地址
 */
export function updateFriendWallet(userId: string, walletAddress: string): void {
  const stmt = db.prepare('UPDATE friends SET wallet_address = ?, updated_at = ? WHERE user_id = ?');
  stmt.run(walletAddress, Date.now(), userId);
  console.log(`📝 [Database] Updated wallet for friend ${userId}`);
}

/**
 * 根据 user_id 获取好友
 */
export function getFriendByUserId(userId: string): FriendRecord | null {
  const stmt = db.prepare('SELECT * FROM friends WHERE user_id = ?');
  const row = stmt.get(userId) as any;
  return row ? parseFriendRow(row) : null;
}

/**
 * 清空用户的好友缓存
 */
export function clearFriends(ownerWallet: string): void {
  const stmt = db.prepare('DELETE FROM friends WHERE LOWER(owner_wallet) = LOWER(?)');
  stmt.run(ownerWallet);
  console.log(`🗑️ [Database] Cleared friends for wallet ${ownerWallet.slice(0, 10)}...`);
}

function parseFriendRow(row: any): FriendRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    screen_name: row.screen_name,
    name: row.name,
    description: row.description,
    profile_image: row.profile_image,
    statuses_count: row.statuses_count,
    followers_count: row.followers_count,
    friends_count: row.friends_count,
    media_count: row.media_count,
    wallet_address: row.wallet_address,
    owner_wallet: row.owner_wallet,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ==================== 多钱包关联操作 ====================

export interface LinkedWallet {
  id?: number;
  willId: string;
  address: string;
  signature: string;
  approvedAt: number;
  status: 'pending' | 'approved' | 'removed';
  lastBalance?: string;
}

/**
 * 保存关联钱包
 */
export function saveLinkedWallet(wallet: LinkedWallet): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO linked_wallets 
    (willId, address, signature, approvedAt, status, lastBalance)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    wallet.willId,
    wallet.address.toLowerCase(),
    wallet.signature,
    wallet.approvedAt,
    wallet.status,
    wallet.lastBalance || null
  );
  console.log(`💾 [Database] Linked wallet saved: ${wallet.address.slice(0, 10)}... for will ${wallet.willId}`);
}

/**
 * 根据遗嘱 ID 获取所有已授权的关联钱包
 */
export function getLinkedWalletsByWillId(willId: string): LinkedWallet[] {
  const stmt = db.prepare(`
    SELECT * FROM linked_wallets 
    WHERE willId = ? AND status = 'approved'
    ORDER BY approvedAt ASC
  `);
  const rows = stmt.all(willId) as any[];
  return rows.map(parseLinkedWalletRow);
}

/**
 * 获取遗嘱的所有关联钱包（包括非 approved 状态）
 */
export function getAllLinkedWalletsByWillId(willId: string): LinkedWallet[] {
  const stmt = db.prepare(`
    SELECT * FROM linked_wallets 
    WHERE willId = ?
    ORDER BY approvedAt ASC
  `);
  const rows = stmt.all(willId) as any[];
  return rows.map(parseLinkedWalletRow);
}

/**
 * 根据钱包地址和 willId 获取关联钱包
 */
export function getLinkedWallet(willId: string, address: string): LinkedWallet | null {
  const stmt = db.prepare(`
    SELECT * FROM linked_wallets 
    WHERE willId = ? AND LOWER(address) = LOWER(?)
  `);
  const row = stmt.get(willId, address) as any;
  return row ? parseLinkedWalletRow(row) : null;
}

/**
 * 移除关联钱包（标记为 removed 状态）
 */
export function removeLinkedWallet(willId: string, address: string): void {
  const stmt = db.prepare(`
    UPDATE linked_wallets SET status = 'removed' 
    WHERE willId = ? AND LOWER(address) = LOWER(?)
  `);
  stmt.run(willId, address);
  console.log(`🗑️ [Database] Linked wallet removed: ${address.slice(0, 10)}... from will ${willId}`);
}

/**
 * 更新关联钱包余额
 */
export function updateLinkedWalletBalance(willId: string, address: string, balance: string): void {
  const stmt = db.prepare(`
    UPDATE linked_wallets SET lastBalance = ? 
    WHERE willId = ? AND LOWER(address) = LOWER(?)
  `);
  stmt.run(balance, willId, address);
}

/**
 * 删除遗嘱的所有关联钱包
 */
export function deleteLinkedWalletsByWillId(willId: string): void {
  const stmt = db.prepare('DELETE FROM linked_wallets WHERE willId = ?');
  stmt.run(willId);
  console.log(`🗑️ [Database] Deleted all linked wallets for will ${willId}`);
}

function parseLinkedWalletRow(row: any): LinkedWallet {
  return {
    id: row.id,
    willId: row.willId,
    address: row.address,
    signature: row.signature,
    approvedAt: row.approvedAt,
    status: row.status,
    lastBalance: row.lastBalance,
  };
}

// 导出数据库实例（用于高级操作）
export { db };

