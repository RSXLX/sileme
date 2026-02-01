
import { deployKitepass } from './kitepassService.js';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Mock console.log to capture output
const originalLog = console.log;
console.log = (...args) => {
    originalLog('[CAPTURED]', ...args);
};

async function main() {
    originalLog('--- Verifying deployKitepass Logic on Disk ---');
    const privateKey = process.env.CUSTODY_PRIVATE_KEY;
    if (!privateKey) {
        originalLog('❌ No private key found');
        return;
    }

    const wallet = new ethers.Wallet(privateKey);
    const eoa = wallet.address;
    originalLog(`Signer: ${eoa}`);

    // We expect this to fail (no Paymaster on script, or just dry run)
    // But we strictly want to see the LOGS regarding AA Address calculation
    try {
        await deployKitepass(eoa, privateKey);
    } catch (e) {
        // Ignore error, we just want logs
        originalLog('Expected error during execution (ignore):', e.message);
    }
}

main().catch(console.error);
