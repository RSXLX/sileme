import React from 'react';
import { Clock, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import type { TransactionRecord } from '../types';
import { formatBalance, getExplorerUrl, shortenAddress } from '../services/kiteService';

interface TransactionHistoryProps {
  transactions: TransactionRecord[];
  className?: string;
}

/**
 * 交易历史列表组件 - Compact Design
 * Optimized for narrow sidebars per UI/UX PRO MAX skill guidelines
 */
export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ transactions, className = '' }) => {
  if (transactions.length === 0) {
    return (
      <div className={`text-center py-6 text-gray-500 ${className}`}>
        <Clock size={20} className="mx-auto mb-2 opacity-50" />
        <p className="text-xs">暂无交易记录</p>
      </div>
    );
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: TransactionRecord['status']) => {
    const baseClass = "shrink-0";
    switch (status) {
      case 'success':
        return <CheckCircle2 size={16} className={`${baseClass} text-green-400`} />;
      case 'pending':
        return <Loader2 size={16} className={`${baseClass} text-yellow-400 animate-spin`} />;
      case 'failed':
        return <XCircle size={16} className={`${baseClass} text-red-400`} />;
    }
  };

  const getStatusLabel = (status: TransactionRecord['status']) => {
    switch (status) {
      case 'success': return '成功';
      case 'pending': return '处理中';
      case 'failed': return '失败';
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {transactions.map((tx, index) => (
        <div
          key={tx.txHash || index}
          className="bg-black/40 border border-gray-800/50 rounded-lg p-3 hover:border-cyan-500/30 transition-colors"
        >
          {/* Row 1: Status + Amount */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getStatusIcon(tx.status)}
              <span className="text-xs font-medium text-gray-300">
                {getStatusLabel(tx.status)}
              </span>
              {tx.beneficiaryName && (
                <span className="text-xs text-gray-500">
                  → {tx.beneficiaryName}
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-600 font-mono">
              {formatTime(tx.timestamp)}
            </span>
          </div>
          
          {/* Row 2: Amount + Address + Link */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-cyan-400 font-mono">
              {formatBalance(tx.amount)} KITE
            </span>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 font-mono">
                {shortenAddress(tx.to)}
              </span>
              {tx.txHash && (
                <a
                  href={getExplorerUrl(tx.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-500 hover:text-cyan-300 transition-colors"
                  title="View on Explorer"
                >
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransactionHistory;

