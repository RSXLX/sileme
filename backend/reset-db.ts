#!/usr/bin/env node
/**
 * 清空数据库脚本
 * 用法: npm run db:reset
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'silene.db');
const DB_SHM = DB_PATH + '-shm';
const DB_WAL = DB_PATH + '-wal';

console.log('🗑️  Resetting database...');

// 删除所有数据库相关文件
[DB_PATH, DB_SHM, DB_WAL].forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`   ✅ Deleted: ${path.basename(file)}`);
  }
});

console.log('✨ Database reset complete! Restart the backend to recreate.');
