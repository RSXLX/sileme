
import { GokiteAASDK } from 'gokite-aa-sdk';
import { getAAWalletAddress } from './kiteSDKService.js';
import dotenv from 'dotenv';
dotenv.config();

const OWNER_EOA = '0x53C1844Af058fE3B3195e49fEC8f97E0a4F87772'; // User's EOA

async function main() {
  console.log('--- Checking AA Address Generation ---');
  console.log(`EOA: ${OWNER_EOA}`);

  // 1. Get address with default salt (Should be 1 now)
  const addressDefault = await getAAWalletAddress(OWNER_EOA);
  console.log(`Address (Default Salt): ${addressDefault}`);

  // 2. Get address with explicit salt 0 (Old broken one)
  const addressSalt0 = await getAAWalletAddress(OWNER_EOA, 0n);
  console.log(`Address (Salt 0):       ${addressSalt0}`);

  // 3. Get address with explicit salt 1 (Target)
  const addressSalt1 = await getAAWalletAddress(OWNER_EOA, 1n);
  console.log(`Address (Salt 1):       ${addressSalt1}`);

  if (addressDefault === addressSalt0) {
      console.error('❌ FAIL: Default address matches Salt 0 address. Change not effective.');
  } else if (addressDefault === addressSalt1) {
      console.log('✅ PASS: Default address matches Salt 1 address.');
  } else {
      console.warn('⚠️ UNEXPECTED: Default matches neither 0 nor 1?');
  }
}

main().catch(console.error);
