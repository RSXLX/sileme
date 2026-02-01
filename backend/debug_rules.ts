
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const RPC_URL = process.env.KITE_RPC || 'https://rpc-testnet.gokite.ai';
const KITE_PASS_ADDRESS = '0x3CFd308aEF7413410Fc6073cB102EfeB43C34a6A'; // From user log
const EXPECTED_IMPL = '0xB5AAFCC6DD4DFc2B80fb8BCcf406E1a2Fd559e23';

const ERC1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  console.log(`Checking KitePass at: ${KITE_PASS_ADDRESS}`);
  
  // 1. Check Code
  const code = await provider.getCode(KITE_PASS_ADDRESS);
  console.log(`Code length: ${code.length} bytes`);
  if (code === '0x') {
    console.error('❌ Contract code is empty! Address is not a contract.');
    return;
  }

  // 2. Check Proxy Implementation
  const implSlot = await provider.getStorage(KITE_PASS_ADDRESS, ERC1967_IMPL_SLOT);
  const implAddress = ethers.getAddress('0x' + implSlot.slice(26));
  
  console.log('--- Address Check ---');
  console.log(`Current Impl (Storage): ${implAddress}`);
  console.log(`Expected Impl (Config): ${EXPECTED_IMPL}`);

  // Check if current impl has code
  const implCode = await provider.getCode(implAddress);
  console.log(`Current Impl Code Length: ${implCode.length}`);

  if (implAddress.toLowerCase() === ethers.ZeroAddress) {
      console.error('❌ Implementation is ZERO ADDRESS. Proxy is uninitialized or storage is empty.');
  } else if (implAddress.toLowerCase() !== EXPECTED_IMPL.toLowerCase()) {
      console.warn('⚠️ Implementation ADDRESS MISMATCH.');
  } else {
      console.log('✅ Implementation matches.');
  }

  // 3. Try calling getSpendingRules
  const contract = new ethers.Contract(
    KITE_PASS_ADDRESS,
    ['function getSpendingRules() view returns (tuple(tuple(uint256 timeWindow, uint160 budget, uint96 initialWindowStartTime, bytes32[] targetProviders) rule, tuple(uint128 amountUsed, uint128 currentTimeWindowStartTime) usage)[])'],
    provider
  );

  console.log('Attemping getSpendingRules()...');
  try {
    const rules = await contract.getSpendingRules();
    console.log('✅ Success:', rules);
  } catch (error: any) {
    console.error('❌ getSpendingRules Logic Failed:', error.shortMessage || error.message);
    if (error.data) console.error('   Data:', error.data);
  }
}

main().catch(console.error);
