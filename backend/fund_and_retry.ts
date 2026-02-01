
import { deployKitepass } from './kitepassService.js';
import { getAAWalletAddress } from './kiteSDKService.js';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const RPC_URL = process.env.KITE_RPC || 'https://rpc-testnet.gokite.ai';

// Mock console.log
const originalLog = console.log;
console.log = (...args) => {
    originalLog('[CAPTURED]', ...args);
};

async function main() {
    originalLog('--- Funding & Retrying Deployment ---');
    const privateKey = process.env.CUSTODY_PRIVATE_KEY;
    if (!privateKey) {
        originalLog('❌ No private key');
        return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const eoa = wallet.address;
    originalLog(`Signer EOA: ${eoa}`);

    const balance = await provider.getBalance(eoa);
    originalLog(`EOA Balance: ${ethers.formatEther(balance)} KITE`);

    if (balance === 0n) {
        originalLog('❌ EOA has 0 balance. Cannot fund AA.');
        return;
    }

    // Get Target AA (Salt=1)
    const aaAddress = await getAAWalletAddress(eoa);
    originalLog(`Target AA: ${aaAddress}`);

    const aaBalance = await provider.getBalance(aaAddress);
    originalLog(`AA Balance: ${ethers.formatEther(aaBalance)} KITE`);

    // Fund it if empty
    if (aaBalance < ethers.parseEther('0.005')) {
        originalLog('💸 Funding AA wallet with 0.01 KITE...');
        try {
            const tx = await wallet.sendTransaction({
                to: aaAddress,
                value: ethers.parseEther('0.01')
            });
            await tx.wait();
            originalLog(`✅ Funded! Tx: ${tx.hash}`);
        } catch (e) {
            originalLog('❌ Funding failed:', e.message);
        }
    } else {
        originalLog('✅ AA already has funds.');
    }

    // Now try deploy (Dry run logic from service)
    originalLog('🚀 Retrying deployKitepass...');
    try {
        const result = await deployKitepass(eoa, privateKey);
        originalLog('Result:', result);
    } catch (e) {
        originalLog('❌ Deploy still failed:', e.message);
        if (e.message.includes('AA33')) {
             originalLog('🔴 AA33 Persists even with funds.');
        }
    }
}

main().catch(console.error);
