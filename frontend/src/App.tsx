import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TerminalLog } from './components/TerminalLog';
import { Simulator } from './components/Simulator';
import { NetworkIndicator } from './components/NetworkIndicator';
import { KiteBadge } from './components/KiteBadge';
import { TransactionHistory } from './components/TransactionHistory';
import { ExecutePreviewModal } from './components/ExecutePreviewModal';
import { SuccessModal } from './components/SuccessModal';
import { CountdownTimer } from './components/CountdownTimer';
import { AIAnalysisModal } from './components/AIAnalysisModal';
import { SettingsModal } from './components/SettingsModal';
import { WillExecutionTimeline } from './components/WillExecutionTimeline';
import { TransactionQueryPanel } from './components/TransactionQueryPanel';
import { FriendsList } from './components/FriendsList';
import { WeightedDistributionModal } from './components/WeightedDistributionModal';
import { FriendInfo } from './services/agentService';
import { AgentSettings } from './services/socialDataService';
import { usePendingWill } from './hooks/usePendingWill';
import { interpretSoul, scanSocialSentinel, verifyWillIntent, calculateWeightedDistribution, AdjustmentEntry } from './services/agentService';
import { 
  initKiteSDK, 
  getWalletSigner, 
  getAAWalletAddress, 
  sendPayment, 
  getExplorerUrl,
  getNativeBalance,
  formatBalance,
  saveTransaction,
  getTransactions,
  calculateDistribution,
  getNetworkStatus,
  shortenAddress,
  getAddressExplorerUrl,
  isValidAddress,
  signTransactionForLater,
  broadcastSignedTransaction,
  saveSignedTransactions,
  getSignedTransactions,
  clearSignedTransactions,
  getPendingNonce,
  signWillAuthorization,
  approveUSDT,
  getUSDTBalance,
  getUSDTAllowance,
  KITE_CONFIG
} from './services/kiteService';
import {
  checkBackendHealth,
  getAAAddressFromBackend,
  isBackendAvailable,
  submitWillAuthorization,
  executeWillViaBackend,
  getWillStatusFromBackend,
  getCustodyAddress
} from './services/backendProxyService';
import {
  depositToVault,
  getVaultStatus,
  getVaultExplorerUrl,
  VaultStatus
} from './services/vaultService';
import { AppStatus, SarcophagusState, TransactionLog, Beneficiary, Wallet, Token, KiteAgent, TransactionRecord, DistributionPlan, NetworkStatus, SignedTransactionData } from './types';
import { Signer, BrowserProvider } from 'ethers';
import { Circle, Heart, Skull, Shield, Activity, Lock, Wallet as WalletIcon, Clock, Zap, Play, Share2, Link, Plus, Coins, User, RefreshCw, ExternalLink, Settings, Twitter, AlertTriangle } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

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

const Card: React.FC<{ children: React.ReactNode; title: string; icon?: React.ReactNode, className?: string, action?: React.ReactNode }> = ({ children, title, icon, className, action }) => (
  <div className={`bg-kite-800/50 border border-gray-700/50 rounded-xl p-6 backdrop-blur-md ${className}`}>
    <div className="flex items-center justify-between mb-4 border-b border-gray-700/50 pb-2">
      <div className="flex items-center gap-2 text-gray-400 uppercase text-xs font-bold tracking-widest">
        {icon}
        <span>{title}</span>
      </div>
      {action}
    </div>
    {children}
  </div>
);

// --- Mock Generators ---

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

const calculateNetWorth = (wallets: Wallet[]) => {
  return wallets.reduce((total, wallet) => {
    return total + wallet.tokens.reduce((wTotal, t) => wTotal + (t.amount * t.price), 0);
  }, 0);
};

// --- Main App Component ---


const App: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  
  // --- State ---
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  
  // URL <-> Status 同步
  // 当 status 变化时，更新 URL
  useEffect(() => {
    const statusToPath: Record<AppStatus, string> = {
      [AppStatus.IDLE]: '/',
      [AppStatus.ONBOARDING]: '/configure',
      [AppStatus.MONITORING]: '/dashboard',
      [AppStatus.ACTIVATED]: '/execute',
      [AppStatus.EXECUTED]: '/execute',
    };
    const targetPath = statusToPath[status];
    if (location.pathname !== targetPath) {
      console.log('🔄 Navigating: ', location.pathname, '->', targetPath);
      navigate(targetPath, { replace: true });
    }
  }, [status, navigate, location.pathname]);

  
  // 系统初始化日志
  useEffect(() => {
    // 延迟一点显示，模拟系统启动
    const timer = setTimeout(() => {
        addLog('HEARTBEAT', 'SYSTEM INITIALIZED: Silene Protocol v1.0.0');
        addLog('HEARTBEAT', 'Connecting to Kite Chain Testnet...');
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const [data, setData] = useState<SarcophagusState>({
    userProfile: null,
    wallets: [],
    lastActiveTimestamp: Date.now(),
    timeThresholdDays: 180,
    manifesto: "",
    beneficiaries: [],
    status: AppStatus.IDLE
  });
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false); // Specific loading state for wallet
  const [isWatcherChecking, setIsWatcherChecking] = useState(false);
  const [draftManifesto, setDraftManifesto] = useState("");
  const [simulatedDate, setSimulatedDate] = useState(new Date());
  
  // Simulator State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  
  // Kite Agent State
  const [kiteAgent, setKiteAgent] = useState<KiteAgent | null>(null);
  const [walletSigner, setWalletSigner] = useState<Signer | null>(null);
  const [walletProvider, setWalletProvider] = useState<BrowserProvider | null>(null);

  // 产品体验优化状态
  const [realBalance, setRealBalance] = useState<string>("0");
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<TransactionRecord[]>([]);
  const [distributionPlan, setDistributionPlan] = useState<DistributionPlan | null>(null);
  
  // 弹窗状态
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [completedTransactions, setCompletedTransactions] = useState<TransactionRecord[]>([]);
  const [lastDeathTxHash, setLastDeathTxHash] = useState<string | undefined>(undefined);
  
  // Agent Settings (Social Scanning) - Auto-detect REAL mode from env
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSocialScanning, setIsSocialScanning] = useState(false);
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => {
    const apiKey = import.meta.env.VITE_RAPIDAPI_KEY;
    return {
      mode: apiKey ? 'REAL' : 'MOCK',
      socialApiKey: apiKey || undefined,
    };
  });
  
  // 意图验证状态 - 用于 HOLD 时显示跳过按钮
  const [pendingIntentResult, setPendingIntentResult] = useState<{
    result: any;
    blocked: boolean;
  } | null>(null);
  
  // 受益人编辑状态
  const [editingBeneficiaryIdx, setEditingBeneficiaryIdx] = useState<number | null>(null);
  const [editingWalletAddress, setEditingWalletAddress] = useState('');
  
  // Twitter 好友列表（用于遗嘴解析时匹配钱包地址）
  const [twitterFriends, setTwitterFriends] = useState<FriendInfo[]>([]);

  // 加权分配状态 - 当 intentMatch < 50% 时使用
  const [isWeightedModalOpen, setIsWeightedModalOpen] = useState(false);
  const [weightedDistributionResult, setWeightedDistributionResult] = useState<{
    original: Beneficiary[];
    adjusted: Beneficiary[];
    adjustmentLog: AdjustmentEntry[];
    willWeight: number;
    socialWeight: number;
    intentMatch: number;
  } | null>(null);

  // 核心执行逻辑：准备分发计划并打开确认弹窗
  // 重构后：如果尚未解析受益人，先触发 AI 分析



  const startWillExecutionProcess = useCallback(async () => {
    // 1. 基础状态检查
    if (!kiteAgent || !walletProvider) {
      addLog('ALERT', 'Cannot execute: No wallet connected.');
      return;
    }

    // 2. 检查是否已有受益人 - 如果没有，需要先进行 AI 分析
    if (data.beneficiaries.length === 0) {
      if (!data.manifesto) {
        addLog('ALERT', 'Cannot execute: No manifesto found.');
        return;
      }
      
      addLog('AI_THINKING', '💀 Death confirmed. Awakening Soul Interpreter Agent...');
      addLog('AI_THINKING', 'Reading sealed manifesto from the Sarcophagus...');
      
      // 打开 AI 分析模态框，让 Agent 解析遗嘱
      setIsAnalyzing(true);
      // 分析完成后会调用 handleAnalysisComplete，那里会再次调用本函数
      return;
    }

    // 3. 执行前真实意图验证 (Pre-execution Intent Verification)
    // Dead Man's Switch 触发后，AI Agent 结合推文+遗嘱分析真实意图
    if (data.userProfile?.handle) {
      addLog('AI_THINKING', '🔍 启动执行前真实意图验证...');
      addLog('AI_THINKING', 'Intent Verification Agent: 综合分析遗嘱+社交动态...');
      
      try {
        const intentResult = await verifyWillIntent(
          data.manifesto || '',
          data.beneficiaries,
          data.userProfile.handle,
          agentSettings,
          language
        );
        
        // 显示分析结果
        addLog('SENTINEL', `📊 意图验证置信度: ${intentResult.confidence}%`);
        addLog('AI_THINKING', `📝 ${intentResult.socialSummary}`);
        
        // 显示警告
        if (intentResult.warnings.length > 0) {
          intentResult.warnings.forEach(w => addLog('ALERT', `⚠️ ${w}`));
        }
        
        // 显示提取的用户意图
        if (intentResult.extractedIntents && intentResult.extractedIntents.length > 0) {
          addLog('AI_THINKING', '📌 从社交媒体提取的用户意图:');
          intentResult.extractedIntents.forEach((intent: string, i: number) => 
            addLog('SENTINEL', `  ${i + 1}. ${intent}`)
          );
          addLog('AI_THINKING', `📊 遗嘱与社交意图匹配度: ${intentResult.intentMatch}%`);
        }
        
        // 根据建议执行操作
        if (intentResult.recommendation === 'HOLD') {
          addLog('ALERT', '🛑 意图验证失败: 检测到矛盾或异常信号');
          addLog('ALERT', intentResult.analysis);
          addLog('SENTINEL', '协议锁定，启动加权分配计算');
          addLog('AI_THINKING', '💡 如需强制执行，请点击下方"跳过检查强制执行"按钮');
          
          // 🆕 Calculate weighted distribution
          try {
            addLog('AI_THINKING', 'Calculating weighted distribution...');
            const weightedResult = await calculateWeightedDistribution(
              data.beneficiaries,
              intentResult.extractedIntents || [],
              intentResult.intentMatch,
              language
            );
            addLog('AI_THINKING', `Weighted: Will ${(weightedResult.willWeight * 100).toFixed(0)}% / Social ${(weightedResult.socialWeight * 100).toFixed(0)}%`);
            setWeightedDistributionResult({
              original: data.beneficiaries,
              adjusted: weightedResult.adjustedBeneficiaries,
              adjustmentLog: weightedResult.adjustmentLog,
              willWeight: weightedResult.willWeight,
              socialWeight: weightedResult.socialWeight,
              intentMatch: intentResult.intentMatch
            });
            setIsWeightedModalOpen(true);
          } catch (weightedError: any) {
            console.error('Weighted distribution failed:', weightedError);
            addLog('ALERT', `Weighted calculation failed: ${weightedError.message}`);
            setPendingIntentResult({ result: intentResult, blocked: true });
          }
          
          // 保存sentinel状态以便UI显示
          setData(prev => ({
            ...prev,
            sentinel: {
              status: 'THREAT_DETECTED',
              evidence: intentResult.analysis,
              timestamp: Date.now(),
              tweets: intentResult.tweets,
              extractedIntents: intentResult.extractedIntents,
              intentMatch: intentResult.intentMatch
            }
          }));
          return; // 终止执行，等待用户选择强制执行
        } else if (intentResult.recommendation === 'REVIEW') {
          addLog('AI_THINKING', '⚠️ 需要人工审核，但为演示目的继续执行');
        }
        
        addLog('SENTINEL', `✅ 意图验证通过: ${intentResult.recommendation}`);
        addLog('AI_THINKING', intentResult.analysis);
        
        // 清除待处理状态
        setPendingIntentResult(null);
        
        // 保存验证结果到 sentinel
        setData(prev => ({
          ...prev,
          sentinel: {
            status: intentResult.isVerified ? 'SECURE' : 'THREAT_DETECTED',
            evidence: intentResult.analysis,
            timestamp: Date.now(),
            tweets: intentResult.tweets,
            extractedIntents: intentResult.extractedIntents,
            intentMatch: intentResult.intentMatch
          }
        }));
      } catch (verifyError) {
        console.warn('Intent verification failed, proceeding with caution:', verifyError);
        addLog('AI_THINKING', '⚠️ 意图验证离线，谨慎模式继续执行');
      }
    }

    // 4. 执行资金规划
    addLog('AI_THINKING', 'Executor: Validating distribution plan...');
    
    try {
      // 刷新余额
      const currentBalance = await getNativeBalance(kiteAgent.aaAddress, walletProvider);
      setRealBalance(currentBalance);
      
      // 计算分配计划
      const plan = calculateDistribution(currentBalance, data.beneficiaries);
      setDistributionPlan(plan);
      
      // 显示预览弹窗
      addLog('DISTRIBUTION', `Plan Ready: ${formatBalance(plan.totalAmount)} KITE to ${plan.distributions.length} beneficiaries.`);
      setIsPreviewModalOpen(true);
    } catch (e) {
      console.error("Error in execution process:", e);
      addLog('ALERT', 'System Error: Failed to calculate distribution.');
    }
  }, [kiteAgent, walletProvider, data.beneficiaries, data.userProfile, data.manifesto, language, agentSettings]); // Updated dependencies

  // 强制执行函数 - 跳过 HOLD 检查
  const forceExecuteWill = useCallback(async () => {
    if (!pendingIntentResult || !kiteAgent || !walletProvider) return;
    
    addLog('ALERT', '⚠️ 用户选择跳过意图验证，强制执行遗嘱...');
    addLog('AI_THINKING', '📋 注意：这将绕过安全检查，请确认您已仔细审核');
    
    // 清除待处理状态
    setPendingIntentResult(null);
    
    // 直接进入执行流程（跳过意图验证）
    try {
      const currentBalance = await getNativeBalance(kiteAgent.aaAddress, walletProvider);
      setRealBalance(currentBalance);
      
      const plan = calculateDistribution(currentBalance, data.beneficiaries);
      setDistributionPlan(plan);
      
      addLog('DISTRIBUTION', `Plan Ready: ${formatBalance(plan.totalAmount)} KITE to ${plan.distributions.length} beneficiaries.`);
      setIsPreviewModalOpen(true);
    } catch (e) {
      console.error("Error in force execution:", e);
      addLog('ALERT', 'System Error: Failed to calculate distribution.');
    }
  }, [pendingIntentResult, kiteAgent, walletProvider, data.beneficiaries]);

  // 🆕 加权分配执行 - 使用调整后的方案
  const executeWithWeightedDistribution = useCallback(async (useAdjusted: boolean) => {
    if (!kiteAgent || !walletProvider || !weightedDistributionResult) return;
    
    const beneficiariesToUse = useAdjusted 
      ? weightedDistributionResult.adjusted 
      : weightedDistributionResult.original;
    
    addLog('AI_THINKING', useAdjusted 
      ? '📊 使用加权调整后的分配方案执行...' 
      : '📜 使用原遗嘱分配方案执行...');
    
    // 更新受益人数据
    setData(prev => ({ ...prev, beneficiaries: beneficiariesToUse }));
    setIsWeightedModalOpen(false);
    setWeightedDistributionResult(null);
    
    // 继续执行流程
    try {
      const currentBalance = await getNativeBalance(kiteAgent.aaAddress, walletProvider);
      setRealBalance(currentBalance);
      
      const plan = calculateDistribution(currentBalance, beneficiariesToUse);
      setDistributionPlan(plan);
      
      addLog('DISTRIBUTION', `Plan Ready: ${formatBalance(plan.totalAmount)} KITE to ${plan.distributions.length} beneficiaries.`);
      setIsPreviewModalOpen(true);
    } catch (e) {
      console.error("Error in weighted execution:", e);
      addLog('ALERT', 'System Error: Failed to calculate distribution.');
    }
  }, [kiteAgent, walletProvider, weightedDistributionResult]);

  // 延迟转账 MVP: 待执行遗嘱状态管理
  const handleWillExpired = useCallback(async () => {
    // 倒计时结束，自动触发执行流程
    addLog('CHAIN_TX', '⏰ Countdown complete. Initiating will execution...');
    await startWillExecutionProcess();
  }, [startWillExecutionProcess]);

  const {
    pendingWill,
    remainingSeconds,
    progress: countdownProgress,
    isExpired,
    sealWill,
    triggerNow,
    cancelWill,
    setExecuting: setWillExecuting,
    setCompleted: setWillCompleted,
    reset: resetPendingWill,
  } = usePendingWill(30 * 1000, handleWillExpired);

  // 封存遗嘱处理函数
  const handleSealWill = async () => {
    if (!kiteAgent || !walletProvider) {
      addLog('ALERT', 'Please connect wallet first.');
      return;
    }
    
    if (data.beneficiaries.length === 0) {
      addLog('ALERT', 'No beneficiaries configured.');
      return;
    }
    
    // 检查余额
    const balance = await getNativeBalance(kiteAgent.aaAddress, walletProvider);
    if (BigInt(balance) <= 0) {
      addLog('ALERT', 'Insufficient balance. Please fund your wallet.');
      return;
    }
    
    // 封存遗嘱，启动倒计时
    sealWill(data.beneficiaries, data.manifesto, balance);
    addLog('CHAIN_TX', `🔏 Will sealed. 30-second countdown started (simulating 180 days).`);
    addLog('AI_THINKING', 'Agent monitoring for vital signs...');
  };

  // --- Derived State ---
  const netWorth = useMemo(() => calculateNetWorth(data.wallets), [data.wallets]);
  const aggregatedTokens = useMemo(() => {
    const totals: Record<string, number> = {};
    data.wallets.forEach(w => {
      w.tokens.forEach(t => {
        totals[t.symbol] = (totals[t.symbol] || 0) + t.amount;
      });
    });
    return totals;
  }, [data.wallets]);

  // --- Helpers ---
  const addLog = (type: TransactionLog['type'], details: string) => {
    const hash = '0x' + Math.random().toString(16).substr(2, 8) + '...';
    setLogs(prev => [...prev, {
      id: Math.random().toString(36),
      timestamp: simulatedDate.getTime(),
      type,
      details,
      hash
    }]);
  };

  // --- Handlers ---

  const handleSocialLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      // Create Mock Profile
      const mockProfile = {
        id: 'user-twitter-123',
        handle: '@crypto_Reeeece',
        platform: 'twitter' as const,
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
      };
      
      // Social login starts with NO wallets to force the "Link" step
      setData(prev => ({ 
        ...prev, 
        userProfile: mockProfile,
        wallets: [], 
        status: AppStatus.ONBOARDING
      }));
      setStatus(AppStatus.ONBOARDING);
      
      addLog('HEARTBEAT', `Identity Verified: ${mockProfile.handle}`);
      setIsLoading(false);
    }, 1500);
  };

  const handleWalletLogin = async () => {
    console.log('🔵 [DEBUG] handleWalletLogin started');
    setIsLoading(true);
    try {
      // 初始化 Kite SDK
      console.log('🔵 [DEBUG] Initializing Kite SDK...');
      initKiteSDK();
      
      // 获取钱包 Signer 和 Provider
      console.log('🔵 [DEBUG] Getting wallet signer...');
      const { provider, signer, address } = await getWalletSigner();
      console.log('🔵 [DEBUG] Wallet signer obtained:', address);
      setWalletSigner(signer);
      setWalletProvider(provider);
      
      // 获取 AA Wallet 地址 (Agent 身份)
      let aaAddress: string;
      try {
        aaAddress = await getAAWalletAddress(signer);
      } catch (aaError) {
        // 如果 AA 获取失败，使用 EOA 地址作为后备
        console.warn('AA Wallet creation fallback to EOA:', aaError);
        aaAddress = address;
      }
      
      // 创建 Kite Agent
      const agent: KiteAgent = {
        aaAddress: aaAddress,
        ownerAddress: address,
        createdAt: Date.now(),
      };
      setKiteAgent(agent);
      
      // 获取真实余额 (新增)
      const balance = await getNativeBalance(aaAddress, provider);
      setRealBalance(balance);
      
      // 获取网络状态 (新增)
      const netStatus = await getNetworkStatus(provider);
      setNetworkStatus(netStatus);
      
      // 加载交易历史 (新增)
      const savedTxs = getTransactions();
      setTransactionHistory(savedTxs);
      
      // 创建用户档案
      const shortAddress = shortenAddress(aaAddress);
      const mockProfile = {
        id: `agent-${aaAddress.slice(0, 8)}`,
        handle: shortAddress,
        platform: 'wallet' as const,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${aaAddress}`
      };
      
      // 创建初始钱包 (Mock 资产展示 + 真实 KITE 余额)
      const initialWallet = generateMockWallet(0);
      initialWallet.address = shortAddress;
      // 添加真实 KITE 余额
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

  const handleLinkNewWallet = async () => {
    setIsWalletConnecting(true);
    try {
      // 初始化 Kite SDK
      initKiteSDK();
      
      // 获取钱包 Signer 和 Provider
      const { provider, signer, address } = await getWalletSigner();
      setWalletSigner(signer);
      setWalletProvider(provider);
      
      // 获取 AA Wallet 地址 (Agent 身份)
      let aaAddress: string;
      try {
        aaAddress = await getAAWalletAddress(signer);
      } catch (aaError) {
        console.warn('AA Wallet creation fallback to EOA:', aaError);
        aaAddress = address;
      }
      
      // Check if this is a subsequent wallet (not the first one)
      if (data.wallets.length > 0) {
        addLog('HEARTBEAT', 'Security Check: Requesting ownership signature...');
        try {
          const timestamp = new Date().toISOString();
          const message = `Request to link wallet ${aaAddress} to Silene Protocol at ${timestamp}`;
          
          // Request signature
          const signature = await signer.signMessage(message);
          
          addLog('SENTINEL', '✓ Signature Verified. Ownership confirmed.');
        } catch (signError: any) {
          console.error("Signature rejected:", signError);
          addLog('ALERT', 'Link Cancelled: Signature required for security.');
          setIsWalletConnecting(false);
          return; // Stop execution
        }
      }

      // 创建 Kite Agent
      const agent: KiteAgent = {
        aaAddress: aaAddress,
        ownerAddress: address,
        createdAt: Date.now(),
      };
      setKiteAgent(agent);
      
      // 获取真实余额
      const balance = await getNativeBalance(aaAddress, provider);
      setRealBalance(balance);
      
      // 获取网络状态
      const netStatus = await getNetworkStatus(provider);
      setNetworkStatus(netStatus);
      
      // 加载交易历史
      const savedTxs = getTransactions();
      setTransactionHistory(savedTxs);
      
      // 创建真实钱包信息
      const shortAddress = shortenAddress(aaAddress);
      const isFirstWallet = data.wallets.length === 0;
      const kiteBalance = parseFloat(formatBalance(balance));
      
      const realWallet: Wallet = {
        id: `w-${Date.now()}-${data.wallets.length}`,
        address: shortAddress,
        label: isFirstWallet ? "Primary Vault" : `Sub-Account ${data.wallets.length}`,
        tokens: [
          { symbol: 'KITE', amount: kiteBalance, price: 0.15 },
        ]
      };
      
      setData(prev => ({
        ...prev,
        wallets: [...prev.wallets, realWallet]
      }));

      if (data.userProfile?.platform === 'twitter' && isFirstWallet) {
        addLog('WALLET_LINK', `PROTOCOL BINDING COMPLETE: ${data.userProfile.handle} + ${shortAddress}`);
        addLog('CHAIN_TX', `Balance Synced: ${formatBalance(balance)} KITE`);
      } else {
        addLog('WALLET_LINK', `New Wallet Linked: ${shortAddress}`);
        addLog('CHAIN_TX', `Balance: ${formatBalance(balance)} KITE`);
      }
      addLog('HEARTBEAT', `Network Connected: ${KITE_CONFIG.chainId} (Testnet)`);
      
      // 检查已存在的遗嘱授权是否与新钱包地址匹配
      const existingWillOwner = localStorage.getItem('silene_will_owner');
      if (existingWillOwner && existingWillOwner.toLowerCase() !== address.toLowerCase()) {
        addLog('ALERT', '⚠️ 检测到已封存的遗嘱使用不同钱包签署');
        addLog('AI_THINKING', `遗嘱签署钱包: ${existingWillOwner.slice(0, 10)}...`);
        addLog('ALERT', '如需使用新钱包，请重新封存遗嘱。');
      }
      
    } catch (error: any) {
      console.error('Wallet link failed:', error);
      if (error.message === 'WALLET_NOT_FOUND') {
        addLog('ALERT', 'Error: Please install MetaMask or a compatible wallet');
      } else if (error.code === 4001 || error.message?.includes('rejected')) {
        addLog('ALERT', 'Error: Wallet connection was rejected by user');
      } else {
        addLog('ALERT', `Error: ${error.message || 'Failed to connect wallet'}`);
      }
    } finally {
      setIsWalletConnecting(false);
    }
  };


  // 新增：直接封存遗嘱，不进行 AI 分析（分析延迟到执行阶段）
  // 🆕 方案B: 后端托管代发 - 用户签署 EIP-712 授权消息
  const handleSealTomb = async (arg?: any) => {
    // 处理 onClick 传入的 Event 对象
    const overrideBeneficiaries = Array.isArray(arg) ? (arg as Beneficiary[]) : undefined;

    console.log('🔵 handleSealTomb started. Override:', !!overrideBeneficiaries);
    addLog('HEARTBEAT', '🔵 Starting Seal Process...');
    
    if (!draftManifesto && !overrideBeneficiaries) {
      console.log('❌ No manifesto');
      return;
    }
    if (data.wallets.length === 0) {
      addLog('ALERT', 'Please link a wallet before sealing.');
      return;
    }
    if (!walletSigner || !walletProvider || !kiteAgent) {
      addLog('ALERT', 'Wallet not properly connected. Please reconnect.');
      return;
    }

    setIsLoading(true);
    addLog('CHAIN_TX', '🔏 Sealing will with Backend Custody (Approach B)...');

    try {
      // ====== 方案B: 后端托管代发 ======
      
      // 步骤 1: 检查后端状态
      console.log('🔹 Step 1: Checking backend...');
      addLog('AI_THINKING', '🔌 [Backend] Checking connection...');
      const backendOnline = await isBackendAvailable();
      if (!backendOnline) {
        addLog('ALERT', '❌ Backend offline - cannot proceed with Approach B');
        addLog('AI_THINKING', '💡 Please ensure backend is running: npm run dev (in backend folder)');
        setIsLoading(false);
        return;
      }
      addLog('SENTINEL', '✅ [Backend] Online - ready for custody');

      // 步骤 2: 获取 AA 钱包地址（展示 SDK 调用）
      console.log('🔹 Step 2: Getting AA Address via Backend...');
      const aaResult = await getAAAddressFromBackend(kiteAgent.aaAddress);
      if (aaResult.success) {
        addLog('CHAIN_TX', `📍 [Kite SDK] AA Wallet: ${shortenAddress(aaResult.aaAddress)}`);
      } else {
        console.warn('AA Address fetch failed but continuing:', aaResult.error);
      }

      // 步骤 3: 检查 Vault 合约（如果配置了地址）
      console.log('🔹 Step 3: Checking Vault Contract...');
      // 强制把 undefined 视为 false
      const vaultAddress = import.meta.env.VITE_VAULT_ADDRESS || ''; 
      console.log('   Vault Address:', vaultAddress || 'Not Configured');
      
      if (vaultAddress && isValidAddress(vaultAddress)) {
        addLog('AI_THINKING', `🏦 [Kite Contract] WillVault at ${shortenAddress(vaultAddress)}`);
        try {
          const vaultStatus = await getVaultStatus(vaultAddress, walletProvider);
          addLog('CHAIN_TX', `📊 [Kite Contract] Vault balance: ${formatBalance(vaultStatus.balance)}`);
        } catch (vaultError) {
          console.error('Vault check error:', vaultError);
          addLog('AI_THINKING', '⚠️ [Kite Contract] Vault not accessible (demo mode)');
        }
      }

      // 步骤 4: 检查受益人并计算分配方案
      console.log('🔹 Step 4: Checking Balance and Beneficiaries...');
      let currentBalance = "0";
      try {
        console.log('   Fetching balance for:', kiteAgent.aaAddress);
        currentBalance = await getNativeBalance(kiteAgent.aaAddress, walletProvider);
        console.log('   Balance:', currentBalance);
      } catch (balError) {
        console.error('❌ Balance fetch critical error:', balError);
        // Fallback to 0, don't crash
      }
      
      const targetBeneficiaries = overrideBeneficiaries || data.beneficiaries;

      // 如果没有受益人，触发 AI 分析遗嘱
      if (targetBeneficiaries.length === 0) {
        if (!data.manifesto && !draftManifesto) {
          addLog('ALERT', '⚠️ 请先填写遗嘱内容');
          setIsLoading(false);
          return;
        }
        addLog('AI_THINKING', '🧠 正在解析遗嘱，识别受益人...');
        // setDraftManifesto(data.manifesto); 
        setIsAnalyzing(true);
        setIsLoading(false);
        return; // 等待 AI 分析完成后再继续
      }
      
      const plan = calculateDistribution(currentBalance, targetBeneficiaries);
      
      // 注意：如果是测试网，允许余额为0继续（为了演示流程）
      // if (!plan.isValid || plan.distributions.length === 0) {
      //   addLog('ALERT', '⚠️ Cannot seal: Insufficient balance or no beneficiaries defined.');
      //   addLog('AI_THINKING', 'Please ensure you have funds and beneficiaries configured.');
      //   setIsLoading(false);
      //   return;
      // }
      console.log('   Distribution Plan:', plan);

      // 步骤 4.5: ERC-20 Approve - 授权 Custody Wallet 代转 USDT
      console.log('🔹 Step 4.5: Requesting USDT Approve for Custody Wallet...');
      addLog('AI_THINKING', '💳 Requesting USDT authorization...');
      
      try {
        // 获取 Custody 地址
        const custodyAddress = await getCustodyAddress();
        console.log(`   Custody Address: ${custodyAddress}`);
        
        // 计算需要授权的金额（使用 plan.totalAmount 或一个较大的值）
        const approveAmount = plan.totalAmount ? BigInt(plan.totalAmount) : BigInt('1000000000000000000000'); // 1000 USDT
        
        // 检查当前 allowance
        const currentAllowance = await getUSDTAllowance(kiteAgent.ownerAddress, custodyAddress, walletProvider);
        console.log(`   Current Allowance: ${currentAllowance}`);
        
        if (currentAllowance < approveAmount) {
          console.log(`   Need to approve: ${approveAmount}`);
          addLog('AI_THINKING', '⏳ Please confirm USDT authorization in your wallet...');
          
          const approveTxHash = await approveUSDT(walletSigner, custodyAddress, approveAmount);
          console.log(`   Approve TX: ${approveTxHash}`);
          addLog('AI_THINKING', `✅ USDT authorized: ${approveTxHash.slice(0, 10)}...`);
        } else {
          console.log('   Already authorized, skipping approve');
          addLog('AI_THINKING', '✅ USDT already authorized');
        }
      } catch (approveError: any) {
        console.error('❌ USDT Approve failed:', approveError);
        if (approveError.code === 4001) {
          addLog('ALERT', '❌ User rejected USDT authorization');
        } else {
          addLog('ALERT', `❌ USDT authorization failed: ${approveError.message}`);
        }
        setIsLoading(false);
        return;
      }

      // 步骤 5: 请求用户对授权消息签名 (EIP-712)
      console.log('🔹 Step 5: Requesting EIP-712 Signature...');
      addLog('AI_THINKING', '✍️ Requesting secure signature...');
      
      const { chainId } = await walletProvider.getNetwork();
      console.log('   Current Chain ID:', chainId);
      
      const authInput = {
        beneficiaries: targetBeneficiaries.map(b => ({
          address: b.walletAddress,
          percentage: b.percentage,
          name: b.name
        })),
        totalAmount: plan.totalAmount, // 使用计划金额，或者 "0"
        validUntil: Math.floor(Date.now() / 1000) + (data.timeThresholdDays * 86400)
      };
      
      console.log('   Auth Input:', JSON.stringify(authInput, null, 2));

      let authSignature;
      try {
        authSignature = await signWillAuthorization(authInput, walletSigner);
        console.log('   Signature success:', authSignature.signature.slice(0, 10));
      } catch (signError: any) {
        console.error('❌ Signature Failed:', signError);
        // 如果是 RPC 错误，尝试给更友好的提示
        if (signError.code === -32603) {
            addLog('ALERT', '❌ Wallet RPC Error: check network connection or params');
        } else if (signError.code === 4001) {
            addLog('ALERT', '❌ User rejected signature');
        } else {
            addLog('ALERT', `❌ Signature failed: ${signError.message}`);
        }
        
        // 关键修复：防止签名失败后 Loading 状态卡住
        setIsLoading(false);
        return;
      }

      // 步骤 6: 提交授权到后端
      console.log('🔹 Step 6: Submitting to Backend...');
      addLog('AI_THINKING', '📤 Submitting authorization to backend custody...');
      const authResult = await submitWillAuthorization({
        owner: authSignature.owner,
        beneficiaries: authSignature.beneficiaries,
        totalAmount: authSignature.totalAmount,
        validUntil: authSignature.validUntil,
        signature: authSignature.signature,
      });
      console.log('   Backend Result:', authResult);

      if (!authResult.success) {
        addLog('ALERT', `❌ Backend rejected authorization: ${authResult.error}`);
        setIsLoading(false);
        return;
      }

      addLog('CHAIN_TX', `💾 Authorization stored: ${authResult.willId}`);
      addLog('HEARTBEAT', '🔏 Manifesto sealed with Backend Custody.');
      addLog('HEARTBEAT', '👁️ Watcher Agent Deployed. Monitoring vital signs...');
      addLog('AI_THINKING', '✨ When triggered, backend will AUTOMATICALLY execute transfers - NO signature needed!');

      // 存储 willId 用于后续执行
      localStorage.setItem('silene_will_id', authResult.willId || '');
      localStorage.setItem('silene_will_owner', authSignature.owner);

      // 步骤 7: 更新状态
      setData(prev => ({
        ...prev,
        manifesto: draftManifesto,
        beneficiaries: targetBeneficiaries,
        status: AppStatus.MONITORING,
        lastActiveTimestamp: simulatedDate.getTime()
      }));
      setStatus(AppStatus.MONITORING);
      setDistributionPlan(plan);
      console.log('✅ Seal Process Complete!');
      
    } catch (error: any) {
      addLog('ALERT', `❌ Seal failed: ${error.message}`);
      console.error('Seal error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 执行阶段的 AI 分析完成回调（死后分析）
  const handleAnalysisComplete = (beneficiaries: Beneficiary[]) => {
    setIsAnalyzing(false);
    
    addLog('AI_THINKING', `Analysis Complete: Identified ${beneficiaries.length} beneficiaries with 98.5% confidence.`);
    
    // 更新受益人列表
    setData(prev => ({
      ...prev,
      beneficiaries,
    }));
    
    addLog('ALERT', `Intent Parsed: ${beneficiaries.length} beneficiaries identified.`);
    
    // 分析完成后，继续封存遗嘱流程
    // Fix: Prioritize Seal Tomb process if we have a draft manifesto (meaning we are ONBOARDING/Editing)
    setTimeout(() => {
      console.log('🔄 Analysis Complete. Status:', status, 'DraftManifesto:', !!draftManifesto);
      
      if (status === AppStatus.ONBOARDING || draftManifesto) {
        console.log('➡️ Proceeding to Seal Tomb logic...');
        handleSealTomb(beneficiaries);
      } else {
        console.log('➡️ Proceeding to Execution logic...');
        startWillExecutionProcess();
      }
    }, 500);
  };

  // 更新受益人钱包地址
  const updateBeneficiaryAddress = (idx: number, newAddress: string) => {
    if (!isValidAddress(newAddress)) {
      addLog('ALERT', '⚠️ 无效的钱包地址格式');
      return;
    }
    
    setData(prev => ({
      ...prev,
      beneficiaries: prev.beneficiaries.map((b, i) => 
        i === idx ? { ...b, walletAddress: newAddress } : b
      )
    }));
    
    setEditingBeneficiaryIdx(null);
    setEditingWalletAddress('');
    addLog('AI_THINKING', `✅ 已更新 ${data.beneficiaries[idx]?.name} 的钱包地址`);
  };

  const startEditBeneficiary = (idx: number) => {
    setEditingBeneficiaryIdx(idx);
    setEditingWalletAddress(data.beneficiaries[idx]?.walletAddress || '');
  };

  const cancelEditBeneficiary = () => {
    setEditingBeneficiaryIdx(null);
    setEditingWalletAddress('');
  };

  const handleForceScan = async () => {
    if (!data.userProfile?.handle) return;
    
    setIsSocialScanning(true);
    addLog('SENTINEL', `🔍 Manual Scan Triggered [Mode: ${agentSettings.mode}]...`);
    
    if (agentSettings.mode === 'REAL') {
      addLog('AI_THINKING', '📡 Connecting to Twitter API via RapidAPI...');
      addLog('AI_THINKING', `🎯 Target User ID: ${import.meta.env.VITE_TWITTER_USER_ID}`);
    }
    
    try {
      const result = await scanSocialSentinel(data.userProfile.handle, data.manifesto, language, agentSettings);
      setData(prev => ({ ...prev, sentinel: result }));
      
      if (result.status === 'THREAT_DETECTED') {
        addLog('ALERT', `⚠️ SENTINEL THREAT: ${result.evidence}`);
      } else {
        addLog('SENTINEL', '✅ Status Secure. No contradictions found.');
        addLog('SENTINEL', `📋 Evidence: ${result.evidence.substring(0, 100)}...`);
      }
    } catch (error: any) {
      addLog('ALERT', `❌ Scan failed: ${error.message}`);
    } finally {
      setIsSocialScanning(false);
    }
  };

  const handleHeartbeat = () => {
    setData(prev => ({ ...prev, lastActiveTimestamp: simulatedDate.getTime() }));
    addLog('HEARTBEAT', 'Proof of Life verified via Activity. Timer reset.');
  };

  const handleManualWatcherCheck = () => {
    if (status !== AppStatus.MONITORING) return;
    setIsWatcherChecking(true);
    addLog('SENTINEL', 'Watcher Agent: Manual verification requested...');

    setTimeout(async () => {
        const daysSinceActive = (simulatedDate.getTime() - data.lastActiveTimestamp) / (1000 * 60 * 60 * 24);
        
        if (daysSinceActive > data.timeThresholdDays) {
             setStatus(AppStatus.ACTIVATED);
             addLog('ALERT', 'CRITICAL: Dead Man Switch Triggered by Manual Check.');
             await startWillExecutionProcess();
        } else {
             addLog('SENTINEL', `Watcher Agent: STATUS OK. Subject dormant for ${daysSinceActive.toFixed(1)} days (Threshold: ${data.timeThresholdDays}).`);
        }
        setIsWatcherChecking(false);
    }, 1000);
  };

  // Simulate Time Travel for Demo purposes
  const advanceTime = (days: number) => {
    const newDate = new Date(simulatedDate);
    newDate.setDate(newDate.getDate() + days);
    setSimulatedDate(newDate);
    addLog('ALERT', `Simulation: Time jumped ${days} days forward.`);
  };

  const handleSimulationComplete = (result: any) => {
    addLog('SIMULATION', `Scenario Run: ${result.sentimentShift} - ${result.narrative.substring(0, 50)}...`);
  };

  // --- Effects ---

  // Watcher Logic
  useEffect(() => {
    if (status !== AppStatus.MONITORING) return;

    const checkVitalSigns = async () => {
      const daysSinceActive = (simulatedDate.getTime() - data.lastActiveTimestamp) / (1000 * 60 * 60 * 24);
      
      if (daysSinceActive > data.timeThresholdDays) {
        setStatus(AppStatus.ACTIVATED);
        addLog('AI_THINKING', `Vital Signs Monitor: HEARTBEAT_LOST for ${daysSinceActive.toFixed(1)} days (Threshold: ${data.timeThresholdDays})`);
        addLog('ALERT', 'CRITICAL: Dead Man Switch Triggered (Protocol 0xDEAD).');
        
        // 计算分配方案
        addLog('AI_THINKING', 'Executor Agent: Constructing liquidation plan...');
        await startWillExecutionProcess();
      }
    };

    checkVitalSigns();
  }, [simulatedDate, data.lastActiveTimestamp, status, data.timeThresholdDays, startWillExecutionProcess]);

  // 执行实际分配（从预览弹窗确认后调用）
  // 🆕 方案B: 调用后端代发交易，无需用户再次签名
  const executeDistribution = async () => {
    if (!walletProvider || !kiteAgent || !walletSigner) {
      addLog('ALERT', 'Cannot execute distribution: wallet not connected');
      return;
    }

    // 读取存储的 willId
    const willId = localStorage.getItem('silene_will_id');
    const willOwner = localStorage.getItem('silene_will_owner');
    
    if (!willId || !willOwner) {
      addLog('ALERT', '⚠️ No will authorization found. Please seal your will first.');
      addLog('AI_THINKING', 'The will must be sealed (EIP-712 authorized) before execution can proceed.');
      return;
    }

    // 验证当前钱包与遗嘱owner是否一致
    try {
      const currentAddress = await walletSigner.getAddress();
      if (currentAddress.toLowerCase() !== willOwner.toLowerCase()) {
        addLog('ALERT', `⚠️ 钱包地址不匹配！`);
        addLog('AI_THINKING', `当前钱包: ${currentAddress.slice(0, 10)}...`);
        addLog('AI_THINKING', `遗嘱签署: ${willOwner.slice(0, 10)}...`);
        addLog('ALERT', '请使用签署遗嘱时的钱包，或重新封存遗嘱。');
        return;
      }
    } catch (addrError: any) {
      console.warn('Address check failed:', addrError);
    }

    setIsDistributing(true);
    setIsPreviewModalOpen(false);
    
    addLog('DISTRIBUTION', '☠️ Dead Man\'s Switch Activated. Backend Executor Agent taking over...');
    addLog('CHAIN_TX', `📡 Requesting backend to execute will: ${willId}`);
    addLog('AI_THINKING', '✨ NO USER SIGNATURE REQUIRED - Backend custody will execute automatically!');

    try {
      // 调用后端执行遗嘱
      const result = await executeWillViaBackend(willId, willOwner);
      
      if (!result.success) {
        addLog('ALERT', `❌ Backend execution failed: ${result.error}`);
        setIsDistributing(false);
        return;
      }

      // 显示死亡声明交易日志并保存到状态
      if (result.deathTxHash) {
        addLog('CHAIN_TX', `💀 Death confirmed on-chain: ${result.deathTxHash}`);
        setLastDeathTxHash(result.deathTxHash);
      } else {
        setLastDeathTxHash(undefined);
      }

      // 处理交易结果
      const completedTxs: TransactionRecord[] = [];
      let totalSent = BigInt(0);

      if (result.transactions) {
        for (const tx of result.transactions) {
          if (tx.status === 'confirmed' && tx.txHash) {
            const txRecord: TransactionRecord = {
              txHash: tx.txHash,
              from: willOwner,
              to: tx.beneficiary,
              amount: tx.amount,
              timestamp: Date.now(),
              status: 'success',
              beneficiaryName: tx.beneficiary,
            };
            
            saveTransaction(txRecord);
            completedTxs.push(txRecord);
            totalSent += BigInt(tx.amount);
            
            addLog('DISTRIBUTION', `✅ ${tx.beneficiary}: ${tx.txHash}`);
          } else {
            addLog('ALERT', `❌ Failed for ${tx.beneficiary}: ${tx.error || 'Unknown error'}`);
          }
        }
      }

      // 清除已执行的遗嘱授权
      localStorage.removeItem('silene_will_id');
      localStorage.removeItem('silene_will_owner');
      addLog('CHAIN_TX', '🗑️ Will authorization cleared from storage.');

      // 更新状态
      setCompletedTransactions(completedTxs);
      setTransactionHistory(getTransactions());
      setStatus(AppStatus.EXECUTED);
      setIsDistributing(false);
      
      // 显示成功弹窗
      if (completedTxs.length > 0) {
        setIsSuccessModalOpen(true);
      }
      
      addLog('DISTRIBUTION', `✅ Distribution complete. ${completedTxs.length} transactions executed by backend.`);
    } catch (error: any) {
      addLog('ALERT', `Backend execution error: ${error.message}`);
      setIsDistributing(false);
    }
  };


  // --- Render Views ---

  if (status === AppStatus.IDLE) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-kite-neon to-purple-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-32 h-32 rounded-full bg-black border-2 border-kite-neon/50 flex items-center justify-center text-4xl">
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
  }

  // Shared Account Header for logged in states
  const AccountHeader = () => (
    <div className="flex items-center justify-between bg-black/40 border-b border-gray-800 p-4 mb-6 rounded-lg">
       <div className="flex items-center gap-3">
          {data.userProfile?.avatarUrl && (
            <img src={data.userProfile.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full border border-gray-700" />
          )}
          <div>
            <div className="flex items-center gap-2">
               <h3 className="font-bold text-white text-sm">{data.userProfile?.handle}</h3>
               <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${data.userProfile?.platform === 'twitter' ? 'bg-[#1DA1F2]/20 text-[#1DA1F2]' : 'bg-kite-neon/20 text-kite-neon'}`}>
                 {data.userProfile?.platform === 'twitter' 
                    ? (data.wallets.length > 0 ? t('dashboard.socialLinked') : t('dashboard.socialVerified')) 
                    : t('dashboard.walletAuth')}
               </span>
            </div>
            <p className="text-xs text-gray-500 font-mono">UID: {data.userProfile?.id}</p>
          </div>
       </div>
       {/* 中间区域：网络状态 + 真实余额 */}
       <div className="flex items-center gap-4">
         <NetworkIndicator status={networkStatus} />
         {kiteAgent && (
           <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30">
             <Coins size={14} className="text-cyan-400" />
             <span className="text-sm font-bold text-cyan-400">
               {formatBalance(realBalance)} KITE
             </span>
             <a
               href={getAddressExplorerUrl(kiteAgent.aaAddress)}
               target="_blank"
               rel="noopener noreferrer"
               className="text-cyan-500 hover:text-cyan-300 transition-colors"
             >
               <ExternalLink size={12} />
             </a>
           </div>
         )}
       </div>
       <div className="text-right">
          <div className="text-xs text-gray-500 font-mono uppercase">{t('dashboard.totalNetWorth')}</div>
          <div className="text-xl font-bold text-kite-neon">${netWorth.toLocaleString()}</div>
       </div>
       
       <button 
         onClick={() => setIsSettingsOpen(true)}
         className="ml-4 p-2 text-gray-500 hover:text-white transition-colors"
         title="Agent Settings"
       >
         <Settings size={20} />
       </button>
    </div>
  );

  if (status === AppStatus.ONBOARDING) {
    return (
      <>

      <Layout>
        <AccountHeader />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">{t('onboarding.header')}</h2>
            <p className="text-gray-400">{t('onboarding.subHeader')}</p>
            
            <div className="space-y-4">
              {/* Twitter Friends List - 在立遗嘱之前展示好友 */}
              {kiteAgent && (
                <FriendsList 
                  ownerWallet={kiteAgent.aaAddress}
                  onFriendSelect={(friend) => {
                    // 可选：点击好友可以将其添加为受益人
                    console.log('Selected friend:', friend);
                    if (friend.wallet_address) {
                      addLog('SENTINEL', `📍 好友 @${friend.screen_name} 的钱包: ${friend.wallet_address.slice(0, 10)}...`);
                    }
                  }}
                  onFriendsLoaded={(friends) => {
                    // 同步好友数据到状态，用于 AI 遗嘱解析匹配
                    console.log(`🤝 [App] Synced ${friends.length} friends for will parsing`);
                    setTwitterFriends(friends);
                  }}
                />
              )}
              
              {/* Manifesto Input */}
              <div>
                <label className="block text-xs font-mono text-kite-neon mb-2 uppercase">{t('onboarding.manifestoLabel')}</label>
                <textarea 
                  value={draftManifesto}
                  onChange={(e) => setDraftManifesto(e.target.value)}
                  className="w-full h-48 bg-kite-800/50 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-600 focus:border-kite-neon focus:ring-1 focus:ring-kite-neon transition-all resize-none"
                  placeholder={t('onboarding.manifestoPlaceholder')}
                />
              </div>

              <div className="flex items-center justify-between bg-kite-800/30 p-4 rounded border border-gray-700">
                 <div className="flex items-center gap-3">
                   <Clock className="text-kite-warning" />
                   <div>
                     <p className="text-sm font-bold text-gray-200">{t('onboarding.triggerTitle')}</p>
                     <p className="text-xs text-gray-500">{t('onboarding.triggerSub')}</p>
                   </div>
                 </div>
                 <div className="text-xl font-mono text-kite-neon">180 {t('common.days')}</div>
              </div>
              <Button onClick={handleSealTomb} disabled={!draftManifesto || isLoading || data.wallets.length === 0} className="w-full flex items-center justify-center gap-2">
                {isLoading ? (
                  <>{t('common.loading')} <Activity className="animate-spin" size={16}/></>
                ) : (
                  <>SEAL TOMB <Lock size={16}/></>
                )}
              </Button>
              {data.wallets.length === 0 && (
                <p className="text-center text-xs text-kite-danger animate-pulse">{t('onboarding.linkWalletErr')}</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
             <Card 
               title={t('onboarding.portfolioTitle')} 
               icon={<WalletIcon size={16}/>} 
               action={
                  data.wallets.length > 0 ? (
                    <button 
                        onClick={handleLinkNewWallet} 
                        disabled={isWalletConnecting}
                        className="text-xs text-kite-neon hover:underline flex items-center gap-1 bg-kite-neon/10 px-2 py-1 rounded transition-colors"
                    >
                        {isWalletConnecting ? <RefreshCw className="animate-spin" size={12}/> : <Plus size={12}/>} 
                        {isWalletConnecting ? t('common.connecting') : t('onboarding.linkWallet')}
                    </button>
                  ) : null
                }
             >
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                   {data.wallets.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-8 border border-dashed border-gray-700 rounded bg-white/5 space-y-3">
                       <div className="p-3 bg-kite-neon/10 rounded-full">
                         <WalletIcon className="text-kite-neon" size={24} />
                       </div>
                       <div className="text-center">
                         <p className="text-sm font-bold text-gray-200">{t('onboarding.noWalletTitle')}</p>
                         <p className="text-[10px] text-gray-500 mb-3">{t('onboarding.noWalletSub')}</p>
                         <Button variant="outline" onClick={handleLinkNewWallet} disabled={isWalletConnecting} className="py-2 px-4 text-xs h-auto w-full">
                           {isWalletConnecting ? <RefreshCw className="animate-spin" size={12}/> : <Link size={12}/>}
                           {t('onboarding.connectPrimary')}
                         </Button>
                       </div>
                     </div>
                   )}
                   {data.wallets.map((wallet) => (
                     <div key={wallet.id} className="bg-black/40 p-3 rounded border border-gray-800/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-gray-300 flex items-center gap-2">
                            <WalletIcon size={10} className="text-gray-500"/>
                            {wallet.label}
                          </span>
                          <span className="text-[10px] text-gray-600 font-mono bg-black px-1 rounded">{wallet.address}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {wallet.tokens.map((t, idx) => (
                             <span key={idx} className="text-[10px] bg-white/5 px-2 py-1 rounded text-gray-400 font-mono border border-white/5">
                               {t.amount.toFixed(2)} {t.symbol}
                             </span>
                          ))}
                        </div>
                     </div>
                   ))}
                </div>
                
                {/* Aggregated Totals */}
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                   <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">{t('onboarding.superposition')}</div>
                      <Coins size={14} className="text-gray-600" />
                   </div>
                   <div className="grid grid-cols-3 gap-2">
                      {Object.entries(aggregatedTokens).map(([symbol, amount]) => (
                        <div key={symbol} className="bg-kite-900/40 p-2 rounded text-center border border-gray-800">
                           <div className="text-lg font-bold text-white leading-none mb-1">{amount.toFixed(2)}</div>
                           <div className="text-[9px] text-gray-500 font-mono">{symbol}</div>
                        </div>
                      ))}
                      {Object.keys(aggregatedTokens).length === 0 && <div className="col-span-3 text-[10px] text-gray-600 text-center">{t('onboarding.noAssets')}</div>}
                   </div>
                </div>
             </Card>
          </div>
        </div>
      </Layout>
      <AIAnalysisModal
        isOpen={isAnalyzing}
        onComplete={handleAnalysisComplete}
        onClose={() => setIsAnalyzing(false)}
        manifesto={draftManifesto}
        analyzeFn={interpretSoul}
        language={language}
        friends={twitterFriends}
      />
      <KiteBadge />
      </>
    );
  }

  // --- Dashboard / Monitoring View ---
  const daysInactive = Math.floor((simulatedDate.getTime() - data.lastActiveTimestamp) / (1000 * 60 * 60 * 24));
  const progress = Math.min((daysInactive / data.timeThresholdDays) * 100, 100);
  const isDead = status === AppStatus.ACTIVATED || status === AppStatus.EXECUTED;

  return (
    <>

      <Layout>
      <AccountHeader />
      <div className="grid lg:grid-cols-3 gap-6 h-full">
        {/* Left Column: Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* 状态卡片 - 仅保留 Sarcophagus 状态 */}
          <Card 
             title={t('dashboard.sarcophagusStatus')} 
             icon={<Activity size={16} />} 
             className="relative overflow-hidden"
             action={
                 !isDead && (
                     <button 
                       onClick={handleManualWatcherCheck}
                       disabled={isWatcherChecking}
                       className="text-[10px] font-mono uppercase border border-kite-neon/50 text-kite-neon px-2 py-1 rounded hover:bg-kite-neon/10 flex items-center gap-1 disabled:opacity-50 transition-colors"
                     >
                        <RefreshCw size={10} className={isWatcherChecking ? "animate-spin" : ""} /> 
                        {t('dashboard.pingAgent')}
                     </button>
                 )
             }
          >
             {isDead && (
                <div className="absolute inset-0 bg-kite-danger/10 z-0 animate-pulse"></div>
             )}
             <div className="relative z-10">
                <div className={`text-4xl font-bold font-mono mb-2 ${isDead ? 'text-kite-danger animate-glitch' : 'text-kite-neon'}`}>
                   {status === AppStatus.MONITORING ? t('dashboard.alive') : status}
                </div>
                <p className="text-xs text-gray-400 font-mono">
                   WATCHER AGENT: {isDead ? t('dashboard.watcherTriggered') : t('dashboard.watcherListening')}
                </p>
             </div>
          </Card>
          
          {/* 社交监控卡片 - 全宽独立卡片 */}
          {data.userProfile?.handle && (
            <Card 
               title={t('dashboard.socialSentinel')} 
               icon={<Twitter size={16} className="text-[#1DA1F2]" />} 
               className={`mt-4 transition-colors duration-500 ${data.sentinel?.status === 'THREAT_DETECTED' ? 'border-kite-danger bg-kite-danger/5' : 'border-gray-700/50 bg-gradient-to-br from-[#1DA1F2]/5 to-cyan-500/5'}`}
               action={
                 <button 
                   onClick={handleForceScan} 
                   disabled={isSocialScanning}
                   className="text-[10px] uppercase border border-[#1DA1F2]/50 text-[#1DA1F2] px-2 py-1 rounded hover:bg-[#1DA1F2]/10 disabled:opacity-50 flex items-center gap-1 transition-colors"
                 >
                   <RefreshCw size={10} className={isSocialScanning ? "animate-spin" : ""} />
                   {isSocialScanning ? (agentSettings.mode === 'REAL' ? 'Fetching...' : 'Scanning...') : t('dashboard.forceScan')}
                 </button>
               }
            >
              <div className="flex flex-col">
                {/* 状态头部 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`text-xl font-bold font-mono ${data.sentinel?.status === 'THREAT_DETECTED' ? 'text-kite-danger' : 'text-green-400'}`}>
                       {data.sentinel?.status === 'THREAT_DETECTED' ? t('dashboard.threatDetected') : t('dashboard.secure')}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[#1DA1F2]/20 text-[#1DA1F2] font-mono">
                      @{data.userProfile.handle}
                    </span>
                  </div>
                  {data.sentinel?.tweets && (
                    <span className="text-[10px] text-gray-500">
                      {data.sentinel.tweets.length} tweets analyzed
                    </span>
                  )}
                </div>
                
                {/* 提取的用户意图 - 持久化展示 */}
                {data.sentinel?.extractedIntents && data.sentinel.extractedIntents.length > 0 && (
                  <div className="mb-3 p-3 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-lg border border-cyan-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-cyan-400 font-medium">📌 AI 提取的用户意图</span>
                      <span className="text-xs text-gray-500 font-mono">
                        匹配度: <span className={`${(data.sentinel.intentMatch ?? 0) >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {data.sentinel.intentMatch ?? 0}%
                        </span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {data.sentinel.extractedIntents.slice(0, 5).map((intent, i) => (
                        <div key={i} className="text-xs text-gray-300 flex items-start gap-2">
                          <span className="text-cyan-500">•</span>
                          <span>{intent}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 推文列表 - 优化版 */}
                {data.sentinel?.tweets && data.sentinel.tweets.length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {data.sentinel.tweets.map((tweet, idx) => {
                      // 计算相对时间
                      const tweetDate = new Date(tweet.date);
                      const now = new Date();
                      const diffMs = now.getTime() - tweetDate.getTime();
                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                      const diffDays = Math.floor(diffHours / 24);
                      const relativeTime = diffDays > 0 
                        ? `${diffDays}d ago` 
                        : diffHours > 0 
                          ? `${diffHours}h ago` 
                          : 'Just now';
                      
                      return (
                        <div 
                          key={tweet.id || idx} 
                          className="group p-3 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-lg border border-gray-700/50 hover:border-[#1DA1F2]/30 transition-all cursor-default"
                        >
                          <div className="flex gap-3">
                            <Twitter size={14} className="text-[#1DA1F2] shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-200 break-words leading-relaxed">
                                {tweet.content.substring(0, 280)}
                                {tweet.content.length > 280 ? '...' : ''}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-gray-500 font-mono">{relativeTime}</span>
                                <span className="text-[10px] text-gray-600">•</span>
                                <span className="text-[10px] text-gray-600">{tweetDate.toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : data.sentinel?.evidence ? (
                  <div className="p-3 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-lg border border-gray-700/50">
                    <div className="flex gap-3">
                      <Twitter size={14} className="text-[#1DA1F2] shrink-0" />
                      <p className="text-sm text-gray-300 italic">"{data.sentinel.evidence}"</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <Twitter size={14} className="text-gray-600" />
                    {t('dashboard.noContradictions')}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 强制执行按钮 - 当意图验证被 HOLD 时显示 */}
          {pendingIntentResult?.blocked && (
            <div className="mt-4 p-4 bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-500/50 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="text-red-400 font-bold">意图验证已锁定</div>
                  <div className="text-xs text-gray-400">AI 检测到矛盾或异常信号</div>
                </div>
              </div>
              
              {/* 提取的意图 */}
              {pendingIntentResult.result?.extractedIntents?.length > 0 && (
                <div className="mb-3 p-2 bg-black/30 rounded-lg">
                  <div className="text-xs text-gray-400 mb-1">从社交媒体提取的意图:</div>
                  <div className="space-y-1">
                    {pendingIntentResult.result.extractedIntents.slice(0, 3).map((intent: string, i: number) => (
                      <div key={i} className="text-xs text-cyan-400">• {intent}</div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    遗嘱匹配度: <span className="text-yellow-400 font-mono">{pendingIntentResult.result.intentMatch}%</span>
                  </div>
                </div>
              )}
              
              <button
                onClick={forceExecuteWill}
                className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <Zap className="w-4 h-4" />
                跳过检查，强制执行遗嘱
              </button>
              <div className="text-xs text-gray-500 text-center mt-2">
                ⚠️ 警告：这将绕过安全检查，请确认已仔细审核
              </div>
            </div>
          )}          <Card title={t('dashboard.deadManSwitch')} icon={<Clock size={16} />}>
             <div className="mb-2 flex justify-between items-end">
               <span className="text-5xl font-mono font-bold text-white">{daysInactive}</span>
               <span className="text-sm text-gray-500 mb-2 font-mono">/ {data.timeThresholdDays} {t('dashboard.daysOfSilence')}</span>
             </div>
             
             {/* Progress Bar */}
             <div className="h-4 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-700 relative">
               <div 
                  className={`h-full transition-all duration-500 ${isDead ? 'bg-kite-danger' : 'bg-kite-neon'}`}
                  style={{ width: `${progress}%` }}
               ></div>
             </div>

             <div className="mt-6 flex flex-col md:flex-row gap-4">
               <Button 
                 onClick={handleHeartbeat} 
                 disabled={isDead}
                 className="flex-1 flex items-center justify-center gap-2"
               >
                 <Heart size={16} className={!isDead ? "animate-pulse" : ""} />
                 {t('dashboard.stillBreathing')}
               </Button>
               
               {/* Simulation Controls */}
               <div className="flex border border-gray-700 rounded bg-black/30">
                 <button onClick={() => advanceTime(30)} disabled={isDead} className="px-3 hover:bg-white/10 text-xs text-gray-400 border-r border-gray-700" title="Skip 30 Days">+30d</button>
                 <button onClick={() => advanceTime(180)} disabled={isDead} className="px-3 hover:bg-white/10 text-xs text-gray-400 hover:text-kite-danger" title="Trigger Death">{t('dashboard.triggerDeath')}</button>
               </div>
             </div>
          </Card>

          {/* 延迟转账 MVP: 倒计时卡片 */}
          {pendingWill && pendingWill.status === 'pending' && (
            <CountdownTimer
              remainingSeconds={remainingSeconds}
              progress={countdownProgress}
              status={pendingWill.status}
              onTriggerNow={triggerNow}
              onCancel={cancelWill}
            />
          )}

          {/* 封存遗嘱按钮 - 仅在有遗嘱内容且未封存时显示 */}
          {/* Seal section removed for MVP - logic retained in handleSealWill */}

          <Card 
            title={t('dashboard.connectedVaults')} 
            icon={<WalletIcon size={16} />} 
            action={
               <button onClick={handleLinkNewWallet} disabled={isWalletConnecting} className="text-xs text-kite-neon hover:underline flex items-center gap-1">
                 {isWalletConnecting ? <RefreshCw className="animate-spin" size={10}/> : <Plus size={12}/>} {t('dashboard.link')}
               </button>
            }
          >
             <div className="grid grid-cols-2 gap-4">
                {data.wallets.map((w) => (
                  <div key={w.id} className="bg-black/30 p-3 rounded border border-gray-800 flex flex-col">
                     <span className="text-xs font-bold text-gray-300">{w.label}</span>
                     <span className="text-[10px] text-gray-600 mb-2">{w.address}</span>
                     <div className="mt-auto flex gap-1 flex-wrap">
                        {w.tokens.map(t => (
                          <span key={t.symbol} className="text-[9px] bg-white/5 px-1 rounded text-gray-500">{t.amount.toFixed(1)} {t.symbol}</span>
                        ))}
                     </div>
                  </div>
                ))}
             </div>
          </Card>

          {/* Simulator button removed for MVP - logic retained */}

          <Card title={t('dashboard.theWill')} icon={<Shield size={16}/>}>
             <div className="space-y-3">
               {data.beneficiaries.length === 0 ? (
                 /* 遗嘱已封存但尚未解析 */
                 <div className="p-6 bg-gradient-to-br from-purple-900/20 to-gray-900 rounded-lg border border-purple-500/30 text-center">
                   <Lock size={32} className="mx-auto text-purple-400 mb-3" />
                   <h4 className="text-lg font-bold text-gray-200 mb-2">🔒 Content Sealed</h4>
                   <p className="text-xs text-gray-500 mb-4">
                     The manifesto is encrypted and sealed. Only the Soul Interpreter Agent can read it upon death trigger.
                   </p>
                   {data.manifesto && (
                     <div className="p-3 bg-black/40 rounded border border-gray-700 text-left">
                       <div className="text-[10px] text-gray-600 uppercase mb-1">Preview (First 100 chars):</div>
                       <p className="text-xs text-gray-400 font-mono italic">
                         "{data.manifesto.substring(0, 100)}{data.manifesto.length > 100 ? '...' : ''}"
                       </p>
                     </div>
                   )}
                 </div>
                ) : (
                 /* 受益人列表 + AI 解读 + 计划操作 */
                 <div className="space-y-4">
                   {/* AI 解读说明 */}
                   <div className="p-3 bg-gradient-to-r from-cyan-900/30 to-purple-900/30 rounded-lg border border-cyan-500/30">
                     <div className="flex items-center gap-2 mb-2">
                       <Zap size={14} className="text-cyan-400" />
                       <span className="text-xs text-cyan-400 uppercase font-bold">AI Agent 遗嘱解读</span>
                     </div>
                     <p className="text-xs text-gray-300 leading-relaxed">
                       根据您的遗嘱内容，AI Agent 已识别 <span className="text-kite-neon font-bold">{data.beneficiaries.length}</span> 位受益人。
                       当 Dead Man's Switch 触发后，系统将自动执行以下资产分配操作。
                     </p>
                   </div>
                   
                   {/* 计划执行的操作 */}
                   <div className="p-3 bg-black/60 rounded-lg border border-gray-700">
                     <div className="text-[10px] text-gray-500 uppercase mb-2 flex items-center gap-1">
                       📋 Planned Actions (触发后将执行)
                     </div>
                     {data.beneficiaries.map((b, idx) => (
                       <div key={idx} className="flex items-center gap-2 py-1 text-xs text-gray-400 border-b border-gray-800 last:border-0">
                         <span className="text-gray-500">{idx + 1}.</span>
                         <span className="text-kite-neon">→</span>
                         <span className="text-gray-300 font-medium">{b.name}</span>
                         <span className="text-gray-600">({b.category})</span>
                         <span className="ml-auto text-cyan-400 font-mono">{b.percentage}%</span>
                       </div>
                     ))}
                   </div>
                   
                   {/* 受益人详情 - 带编辑功能 */}
                   {data.beneficiaries.map((b, idx) => (
                   <div key={idx} className="p-3 bg-black/40 rounded border border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                         <div className="flex flex-col">
                            <span className="font-bold text-gray-200">{b.name}</span>
                            <span className="text-xs text-gray-500 font-mono">{b.category} • {b.reason?.substring(0, 40) || ''}...</span>
                         </div>
                         <div className="text-kite-neon font-mono font-bold">
                            {b.percentage}%
                         </div>
                      </div>
                      
                      {/* 钱包地址 - 支持编辑 */}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
                         <span className="text-[10px] text-gray-600 shrink-0">地址:</span>
                         
                         {editingBeneficiaryIdx === idx ? (
                           // 编辑模式
                           <div className="flex-1 flex items-center gap-2">
                             <input
                               type="text"
                               value={editingWalletAddress}
                               onChange={(e) => setEditingWalletAddress(e.target.value)}
                               placeholder="0x..."
                               className="flex-1 px-2 py-1 bg-black/50 border border-cyan-500/50 rounded text-xs text-gray-200 font-mono focus:outline-none focus:border-cyan-400"
                             />
                             <button
                               onClick={() => updateBeneficiaryAddress(idx, editingWalletAddress)}
                               className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded"
                             >
                               ✓
                             </button>
                             <button
                               onClick={cancelEditBeneficiary}
                               className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded"
                             >
                               ✕
                             </button>
                           </div>
                         ) : (
                           // 显示模式
                           <>
                             <span className={`text-xs font-mono px-2 py-0.5 rounded ${isValidAddress(b.walletAddress) ? 'text-gray-400 bg-black/30' : 'text-yellow-500 bg-yellow-900/20 border border-yellow-500/30'}`}>
                               {isValidAddress(b.walletAddress) ? shortenAddress(b.walletAddress) : '⚠️ 需要设置钱包地址'}
                             </span>
                             <button
                               onClick={() => startEditBeneficiary(idx)}
                               className="px-2 py-0.5 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded transition-colors"
                             >
                               ✏️ 编辑
                             </button>
                             {isValidAddress(b.walletAddress) && (
                               <a
                                 href={getAddressExplorerUrl(b.walletAddress)}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="text-cyan-500 hover:text-cyan-300 transition-colors"
                               >
                                 <ExternalLink size={10} />
                               </a>
                             )}
                           </>
                         )}
                      </div>
                   </div>
                 ))}
                 </div>
                )}
             </div>
          </Card>
        </div>

        {/* Right Column: Logs + Transaction History */}
        <div className="space-y-6">
          <TerminalLog logs={logs} />
          
          {/* 交易历史 */}
          {transactionHistory.length > 0 && (
            <Card title="链上交易历史" icon={<Coins size={16} />}>
              <TransactionHistory transactions={transactionHistory} />
            </Card>
          )}
          
          <div className="p-4 rounded border border-gray-800 bg-kite-900/50 text-xs text-gray-500 font-mono leading-relaxed">
            <h4 className="text-gray-400 font-bold mb-2 uppercase">{t('dashboard.systemArch')}</h4>
            <p className="mb-2">{t('dashboard.arch1')}</p>
            <p className="mb-2">{t('dashboard.arch2')}</p>
            <p>{t('dashboard.arch3')}</p>
          </div>
        </div>
      </div>
    </Layout>

    <Simulator
      isOpen={isSimulatorOpen}
      onClose={() => setIsSimulatorOpen(false)}
      originalManifesto={data.manifesto}
      initialHandle={data.userProfile?.handle}
      onSimulateComplete={handleSimulationComplete}
    />

    {/* 执行预览弹窗 */}
    <ExecutePreviewModal
      isOpen={isPreviewModalOpen}
      onClose={() => {
        setIsPreviewModalOpen(false);
        // 如果取消，恢复到 MONITORING 状态
        if (status === AppStatus.ACTIVATED) {
          setStatus(AppStatus.MONITORING);
        }
      }}
      onConfirm={executeDistribution}
      plan={distributionPlan}
      isLoading={isDistributing}
      balance={realBalance}
    />

    {/* 成功弹窗 */}
    <SuccessModal
      isOpen={isSuccessModalOpen}
      onClose={() => setIsSuccessModalOpen(false)}
      transactions={completedTransactions}
      totalAmount={distributionPlan?.totalAmount || "0"}
      deathTxHash={lastDeathTxHash}
    />

    {/* 交易查询面板 - 在执行完成后显示 */}
    {kiteAgent && completedTransactions.length > 0 && (
      <div className="fixed bottom-4 right-4 w-80 z-40">
        <TransactionQueryPanel
          walletAddress={kiteAgent.ownerAddress}
          className="shadow-xl"
        />
      </div>
    )}

    <SettingsModal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
      onSave={(newSettings) => {
        setAgentSettings(newSettings);
        addLog('HEARTBEAT', `Settings Updated: Mode=${newSettings.mode}`);
      }}
      initialSettings={agentSettings}
    />

    {/* 🆕 加权分配调整弹窗 */}
    {weightedDistributionResult && (
      <WeightedDistributionModal
        isOpen={isWeightedModalOpen}
        onClose={() => {
          setIsWeightedModalOpen(false);
          setWeightedDistributionResult(null);
        }}
        originalBeneficiaries={weightedDistributionResult.original}
        adjustedBeneficiaries={weightedDistributionResult.adjusted}
        adjustmentLog={weightedDistributionResult.adjustmentLog}
        willWeight={weightedDistributionResult.willWeight}
        socialWeight={weightedDistributionResult.socialWeight}
        intentMatch={weightedDistributionResult.intentMatch}
        onExecuteAdjusted={() => executeWithWeightedDistribution(true)}
        onExecuteOriginal={() => executeWithWeightedDistribution(false)}
      />
    )}

    {/* AI 分析模态框 */}
    <AIAnalysisModal
      isOpen={isAnalyzing}
      onComplete={handleAnalysisComplete}
      onClose={() => setIsAnalyzing(false)}
      manifesto={draftManifesto}
      analyzeFn={interpretSoul}
      language={language}
      friends={twitterFriends}
    />

    {/* Kite Chain 徽章 */}
    <KiteBadge />
    </>
  );
};

export default App;