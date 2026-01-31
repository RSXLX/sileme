import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  initKiteSDK, 
  getWalletSigner, 
  getAAWalletAddress, 
  getNativeBalance,
  formatBalance,
  getNetworkStatus,
  getTransactions,
  shortenAddress,
  KITE_CONFIG
} from '../services/kiteService';
import { AppStatus, KiteAgent, Wallet } from '../types';
import { Skull, Activity, Share2, Wallet as WalletIcon } from 'lucide-react';

// --- Helper Components ---
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'outline' | 'purple' | 'twitter' }> = ({ className, variant = 'primary', ...props }) => {
  const baseStyle = "px-6 py-3 rounded font-mono uppercase tracking-wider text-sm font-bold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-kite-neon text-black hover:bg-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.4)]",
    danger: "bg-kite-danger text-white hover:bg-red-600 shadow-[0_0_15px_rgba(255,0,60,0.4)]",
    purple: "bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)]",
    twitter: "bg-[#1DA1F2] text-white hover:bg-[#1a91da] shadow-[0_0_15px_rgba(29,161,242,0.4)]",
    outline: "border border-gray-600 text-gray-300 hover:border-kite-neon hover:text-kite-neon bg-transparent"
  };
  return <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props} />;
};

const generateMockWallet = (index: number): Wallet => {
  const ethAmount = Number((Math.random() * 5).toFixed(4));
  const usdcAmount = Math.floor(Math.random() * 10000) + 500;
  const kiteAmount = Math.floor(Math.random() * 50000);
  
  return {
    id: `w-${Date.now()}-${index}`,
    address: `0x${Math.random().toString(16).substr(2, 4)}...${Math.random().toString(16).substr(2, 4)}`,
    label: index === 0 ? "Primary Vault" : `Sub-Account ${index}`,
    tokens: [
      { symbol: 'ETH', amount: ethAmount, price: 3200 },
      { symbol: 'USDC', amount: usdcAmount, price: 1 },
      { symbol: 'KITE', amount: kiteAmount, price: 0.15 },
    ]
  };
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { 
    isLoading, 
    setIsLoading,
    setStatus,
    setData,
    setKiteAgent,
    setWalletSigner,
    setWalletProvider,
    setRealBalance,
    setNetworkStatus,
    setTransactionHistory,
    addLog
  } = useApp();

  // Social Login Handler
  const handleSocialLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      const mockProfile = {
        id: 'user-twitter-123',
        handle: '@crypto_Reeeece',
        platform: 'twitter' as const,
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
      };
      
      setData(prev => ({ 
        ...prev, 
        userProfile: mockProfile,
        wallets: [], 
        status: AppStatus.ONBOARDING
      }));
      setStatus(AppStatus.ONBOARDING);
      
      addLog('HEARTBEAT', `Identity Verified: ${mockProfile.handle}`);
      setIsLoading(false);
      navigate('/configure');
    }, 1500);
  };

  // Wallet Login Handler
  const handleWalletLogin = async () => {
    setIsLoading(true);
    try {
      initKiteSDK();
      
      const { provider, signer, address } = await getWalletSigner();
      setWalletSigner(signer);
      setWalletProvider(provider);
      
      let aaAddress: string;
      try {
        aaAddress = await getAAWalletAddress(signer);
      } catch (aaError) {
        console.warn('AA Wallet creation fallback to EOA:', aaError);
        aaAddress = address;
      }
      
      const agent: KiteAgent = {
        aaAddress: aaAddress,
        ownerAddress: address,
        createdAt: Date.now(),
      };
      setKiteAgent(agent);
      
      const balance = await getNativeBalance(aaAddress, provider);
      setRealBalance(balance);
      
      const netStatus = await getNetworkStatus(provider);
      setNetworkStatus(netStatus);
      
      const savedTxs = getTransactions();
      setTransactionHistory(savedTxs);
      
      const shortAddress = shortenAddress(aaAddress);
      const mockProfile = {
        id: `agent-${aaAddress.slice(0, 8)}`,
        handle: shortAddress,
        platform: 'wallet' as const,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${aaAddress}`
      };
      
      const initialWallet = generateMockWallet(0);
      initialWallet.address = shortAddress;
      const kiteBalance = parseFloat(formatBalance(balance));
      initialWallet.tokens.push({ symbol: 'KITE (Real)', amount: kiteBalance, price: 0.15 });

      setData(prev => ({ 
        ...prev, 
        userProfile: mockProfile,
        wallets: [initialWallet],
        status: AppStatus.ONBOARDING
      }));
      setStatus(AppStatus.ONBOARDING);
      
      addLog('HEARTBEAT', `Kite Agent Created: ${shortAddress}`);
      addLog('WALLET_LINK', `AA Wallet Linked: ${aaAddress}`);
      addLog('CHAIN_TX', `Balance Synced: ${formatBalance(balance)} KITE`);
      addLog('HEARTBEAT', `Network Connected: ${KITE_CONFIG.chainId} (Testnet)`);
      
      navigate('/configure');
      
    } catch (error: any) {
      console.error('Wallet login failed:', error);
      if (error.message === 'WALLET_NOT_FOUND') {
        addLog('ALERT', 'Error: Please install MetaMask or a compatible wallet');
      } else if (error.code === 4001 || error.message?.includes('rejected')) {
        addLog('ALERT', 'Error: Wallet connection was rejected by user');
      } else {
        addLog('ALERT', `Error: ${error.message || 'Failed to connect wallet'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 gap-8">
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-kite-neon/20 via-purple-500/20 to-kite-danger/20 rounded-full blur-xl animate-pulse"></div>
          <div className="relative p-6 rounded-full border-2 border-gray-700 bg-kite-900">
            <Skull className="text-gray-300" size={48} />
          </div>
        </div>
        <div className="space-y-4 max-w-lg">
          <h2 className="text-4xl font-bold text-white tracking-tighter whitespace-pre-line">{t('home.title')}</h2>
          <p className="text-gray-400 text-lg whitespace-pre-line">
            {t('home.subtitle')}
          </p>
          <div className="flex flex-col gap-4 mt-8 w-full max-w-xs mx-auto">
            <Button variant="twitter" onClick={handleSocialLogin} disabled={isLoading}>
              {isLoading ? <Activity className="animate-spin" /> : <Share2 size={16} />}
              {t('home.login')}
            </Button>
            <Button variant="outline" onClick={handleWalletLogin} disabled={isLoading} className="border-gray-500 hover:border-white text-white">
              {isLoading ? <Activity className="animate-spin" /> : <WalletIcon size={16} />} 
              {t('home.connect')}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LandingPage;
