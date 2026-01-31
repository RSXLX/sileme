import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Signer, BrowserProvider } from 'ethers';
import { 
  AppStatus, 
  SarcophagusState, 
  TransactionLog, 
  Beneficiary, 
  Wallet, 
  KiteAgent, 
  TransactionRecord, 
  DistributionPlan, 
  NetworkStatus 
} from '../types';
import { AgentSettings } from '../services/socialDataService';

// --- Types ---
interface AppContextType {
  // Status
  status: AppStatus;
  setStatus: (status: AppStatus) => void;
  
  // Data
  data: SarcophagusState;
  setData: React.Dispatch<React.SetStateAction<SarcophagusState>>;
  
  // Wallet
  kiteAgent: KiteAgent | null;
  setKiteAgent: (agent: KiteAgent | null) => void;
  walletSigner: Signer | null;
  setWalletSigner: (signer: Signer | null) => void;
  walletProvider: BrowserProvider | null;
  setWalletProvider: (provider: BrowserProvider | null) => void;
  
  // Balance & Network
  realBalance: string;
  setRealBalance: (balance: string) => void;
  networkStatus: NetworkStatus | null;
  setNetworkStatus: (status: NetworkStatus | null) => void;
  transactionHistory: TransactionRecord[];
  setTransactionHistory: (txs: TransactionRecord[]) => void;
  distributionPlan: DistributionPlan | null;
  setDistributionPlan: (plan: DistributionPlan | null) => void;
  
  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isWalletConnecting: boolean;
  setIsWalletConnecting: (connecting: boolean) => void;
  draftManifesto: string;
  setDraftManifesto: (manifesto: string) => void;
  
  // Agent Settings
  agentSettings: AgentSettings;
  setAgentSettings: (settings: AgentSettings) => void;
  
  // Logs
  logs: TransactionLog[];
  addLog: (type: TransactionLog['type'], details: string) => void;
  
  // Modal States
  isPreviewModalOpen: boolean;
  setIsPreviewModalOpen: (open: boolean) => void;
  isSuccessModalOpen: boolean;
  setIsSuccessModalOpen: (open: boolean) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  
  // Completed Transactions
  completedTransactions: TransactionRecord[];
  setCompletedTransactions: (txs: TransactionRecord[]) => void;
  
  // Intent Verification
  pendingIntentResult: { result: any; blocked: boolean } | null;
  setPendingIntentResult: (result: { result: any; blocked: boolean } | null) => void;
  
  // Beneficiary Editing
  editingBeneficiaryIdx: number | null;
  setEditingBeneficiaryIdx: (idx: number | null) => void;
  editingWalletAddress: string;
  setEditingWalletAddress: (address: string) => void;
  
  // Simulated Date
  simulatedDate: Date;
  setSimulatedDate: (date: Date) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Provider ---
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Status
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  
  // Data
  const [data, setData] = useState<SarcophagusState>({
    userProfile: null,
    wallets: [],
    lastActiveTimestamp: Date.now(),
    timeThresholdDays: 180,
    manifesto: "",
    beneficiaries: [],
    status: AppStatus.IDLE
  });
  
  // Wallet
  const [kiteAgent, setKiteAgent] = useState<KiteAgent | null>(null);
  const [walletSigner, setWalletSigner] = useState<Signer | null>(null);
  const [walletProvider, setWalletProvider] = useState<BrowserProvider | null>(null);
  
  // Balance & Network
  const [realBalance, setRealBalance] = useState<string>("0");
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<TransactionRecord[]>([]);
  const [distributionPlan, setDistributionPlan] = useState<DistributionPlan | null>(null);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);
  const [draftManifesto, setDraftManifesto] = useState("");
  
  // Agent Settings
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => {
    const apiKey = import.meta.env.VITE_RAPIDAPI_KEY;
    return {
      mode: apiKey ? 'REAL' : 'MOCK',
      socialApiKey: apiKey || undefined,
    };
  });
  
  // Logs
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [simulatedDate, setSimulatedDate] = useState(new Date());
  
  const addLog = useCallback((type: TransactionLog['type'], details: string) => {
    const hash = '0x' + Math.random().toString(16).substr(2, 8) + '...';
    setLogs(prev => [...prev, {
      id: Math.random().toString(36),
      timestamp: simulatedDate.getTime(),
      type,
      details,
      hash
    }]);
  }, [simulatedDate]);
  
  // Modal States
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Completed Transactions
  const [completedTransactions, setCompletedTransactions] = useState<TransactionRecord[]>([]);
  
  // Intent Verification
  const [pendingIntentResult, setPendingIntentResult] = useState<{ result: any; blocked: boolean } | null>(null);
  
  // Beneficiary Editing
  const [editingBeneficiaryIdx, setEditingBeneficiaryIdx] = useState<number | null>(null);
  const [editingWalletAddress, setEditingWalletAddress] = useState('');
  
  const value = useMemo(() => ({
    status,
    setStatus,
    data,
    setData,
    kiteAgent,
    setKiteAgent,
    walletSigner,
    setWalletSigner,
    walletProvider,
    setWalletProvider,
    realBalance,
    setRealBalance,
    networkStatus,
    setNetworkStatus,
    transactionHistory,
    setTransactionHistory,
    distributionPlan,
    setDistributionPlan,
    isLoading,
    setIsLoading,
    isWalletConnecting,
    setIsWalletConnecting,
    draftManifesto,
    setDraftManifesto,
    agentSettings,
    setAgentSettings,
    logs,
    addLog,
    isPreviewModalOpen,
    setIsPreviewModalOpen,
    isSuccessModalOpen,
    setIsSuccessModalOpen,
    isAnalyzing,
    setIsAnalyzing,
    isSettingsOpen,
    setIsSettingsOpen,
    completedTransactions,
    setCompletedTransactions,
    pendingIntentResult,
    setPendingIntentResult,
    editingBeneficiaryIdx,
    setEditingBeneficiaryIdx,
    editingWalletAddress,
    setEditingWalletAddress,
    simulatedDate,
    setSimulatedDate,
  }), [
    status, data, kiteAgent, walletSigner, walletProvider,
    realBalance, networkStatus, transactionHistory, distributionPlan,
    isLoading, isWalletConnecting, draftManifesto, agentSettings,
    logs, addLog, isPreviewModalOpen, isSuccessModalOpen, isAnalyzing,
    isSettingsOpen, completedTransactions, pendingIntentResult,
    editingBeneficiaryIdx, editingWalletAddress, simulatedDate
  ]);
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// --- Hook ---
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
