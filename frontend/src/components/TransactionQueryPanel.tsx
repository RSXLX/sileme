import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Copy, Check, ArrowRight, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { getExplorerUrl, shortenAddress, formatBalance } from '../services/kiteService';

interface TransactionRecord {
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

interface TransactionQueryPanelProps {
  walletAddress?: string;
  willId?: string;
  className?: string;
}

const statusConfig = {
  pending: { icon: <Clock size={14} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  confirmed: { icon: <CheckCircle size={14} />, color: 'text-green-400', bg: 'bg-green-500/10' },
  failed: { icon: <XCircle size={14} />, color: 'text-red-400', bg: 'bg-red-500/10' },
};

const txTypeLabels = {
  DEATH_DECLARATION: { label: '死亡声明', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  DISTRIBUTION: { label: '资金分发', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
};

/**
 * 交易查询面板组件
 * 支持按钱包地址查询交易记录
 */
export const TransactionQueryPanel: React.FC<TransactionQueryPanelProps> = ({
  walletAddress,
  willId,
  className = '',
}) => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      fetchTransactions();
    }
  }, [walletAddress, willId]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const endpoint = willId 
        ? `http://localhost:3001/api/transactions/will/${willId}`
        : `http://localhost:3001/api/transactions/wallet/${walletAddress}`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (!walletAddress) {
    return null;
  }

  return (
    <div className={`bg-kite-800/50 border border-gray-700/50 rounded-xl p-6 backdrop-blur-md ${className}`}>
      <div className="flex items-center justify-between mb-4 border-b border-gray-700/50 pb-2">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-kite-neon" />
          <span className="text-gray-400 uppercase text-xs font-bold tracking-widest">
            交易记录
          </span>
        </div>
        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : '刷新'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="text-cyan-400 animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          暂无交易记录
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {transactions.map((tx) => {
            const typeConfig = txTypeLabels[tx.txType];
            const status = statusConfig[tx.status];
            
            return (
              <div
                key={tx.txHash}
                className="p-3 bg-kite-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-all"
              >
                {/* 头部：类型 + 状态 */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${typeConfig.bg} ${typeConfig.color}`}>
                    {typeConfig.label}
                  </span>
                  <div className={`flex items-center gap-1 text-xs ${status.color}`}>
                    {status.icon}
                    <span className="capitalize">{tx.status}</span>
                  </div>
                </div>

                {/* 交易哈希 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500 font-mono">
                    {shortenAddress(tx.txHash)}
                  </span>
                  <button
                    onClick={() => copyToClipboard(tx.txHash)}
                    className="text-gray-600 hover:text-cyan-400 transition-colors"
                  >
                    {copiedHash === tx.txHash ? (
                      <Check size={12} className="text-green-400" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                  <a
                    href={getExplorerUrl(tx.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-500 hover:text-cyan-400 transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>

                {/* 金额和受益人 */}
                {tx.txType === 'DISTRIBUTION' && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-cyan-400 font-medium">
                      {formatBalance(tx.amount)} {tx.tokenSymbol}
                    </span>
                    <ArrowRight size={12} className="text-gray-600" />
                    <span className="text-gray-400">
                      {tx.beneficiaryName || shortenAddress(tx.beneficiaryAddress)}
                    </span>
                  </div>
                )}

                {/* 时间 */}
                <div className="mt-2 text-[10px] text-gray-600">
                  {new Date(tx.createdAt).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 底部统计 */}
      {transactions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <span>共 {transactions.length} 条交易</span>
          <span className="font-mono">{shortenAddress(walletAddress || '')}</span>
        </div>
      )}
    </div>
  );
};

export default TransactionQueryPanel;
