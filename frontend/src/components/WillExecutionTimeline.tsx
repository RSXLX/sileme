import React from 'react';
import { CheckCircle, Clock, Zap, ExternalLink, Loader2, XCircle, Skull, Send } from 'lucide-react';
import { getExplorerUrl, shortenAddress, formatBalance } from '../services/kiteService';

// 执行阶段枚举
export type ExecutionPhase = 'DEATH_DECLARATION' | 'DISTRIBUTION' | 'COMPLETED';

export interface ExecutionStep {
  phase: ExecutionPhase;
  label: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  txHash?: string;
  amount?: string;
  beneficiary?: string;
  timestamp?: number;
}

interface WillExecutionTimelineProps {
  steps: ExecutionStep[];
  deathTxHash?: string;
  className?: string;
}

const phaseIcons: Record<ExecutionPhase, React.ReactNode> = {
  DEATH_DECLARATION: <Skull size={18} />,
  DISTRIBUTION: <Send size={18} />,
  COMPLETED: <CheckCircle size={18} />,
};

const statusStyles: Record<ExecutionStep['status'], { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  pending: {
    bg: 'bg-gray-800/50',
    border: 'border-gray-700',
    text: 'text-gray-500',
    icon: <Clock size={16} className="text-gray-500" />,
  },
  active: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/50',
    text: 'text-cyan-400',
    icon: <Loader2 size={16} className="text-cyan-400 animate-spin" />,
  },
  completed: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/50',
    text: 'text-green-400',
    icon: <CheckCircle size={16} className="text-green-400" />,
  },
  failed: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/50',
    text: 'text-red-400',
    icon: <XCircle size={16} className="text-red-400" />,
  },
};

/**
 * 遗嘱执行时间线组件
 * 显示执行过程的各个阶段：死亡声明 → 资金分发 → 完成
 */
export const WillExecutionTimeline: React.FC<WillExecutionTimelineProps> = ({
  steps,
  deathTxHash,
  className = '',
}) => {
  return (
    <div className={`bg-kite-800/50 border border-gray-700/50 rounded-xl p-6 backdrop-blur-md ${className}`}>
      <div className="flex items-center gap-2 mb-4 border-b border-gray-700/50 pb-2">
        <Zap size={16} className="text-kite-neon" />
        <span className="text-gray-400 uppercase text-xs font-bold tracking-widest">
          执行时间线
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const styles = statusStyles[step.status];
          return (
            <div
              key={step.phase + idx}
              className={`relative flex items-start gap-4 p-4 rounded-lg border transition-all duration-300 ${styles.bg} ${styles.border}`}
            >
              {/* 连接线 */}
              {idx < steps.length - 1 && (
                <div className="absolute left-7 top-14 w-0.5 h-6 bg-gray-700" />
              )}

              {/* 图标 */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${styles.bg} border ${styles.border}`}>
                {step.status === 'active' ? (
                  <Loader2 size={16} className="text-cyan-400 animate-spin" />
                ) : step.status === 'completed' ? (
                  <CheckCircle size={16} className="text-green-400" />
                ) : step.status === 'failed' ? (
                  <XCircle size={16} className="text-red-400" />
                ) : (
                  <span className={styles.text}>{phaseIcons[step.phase]}</span>
                )}
              </div>

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`font-bold ${styles.text}`}>{step.label}</h4>
                  {step.timestamp && (
                    <span className="text-[10px] text-gray-600 font-mono">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {step.description && (
                  <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                )}

                {/* 交易详情 */}
                {step.txHash && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-600 font-mono">
                      TX: {shortenAddress(step.txHash)}
                    </span>
                    <a
                      href={getExplorerUrl(step.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-500 hover:text-cyan-400 transition-colors"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* 金额和受益人 */}
                {step.amount && step.amount !== '0' && (
                  <div className="mt-1 text-xs">
                    <span className="text-cyan-400 font-mono">{formatBalance(step.amount)} KITE</span>
                    {step.beneficiary && (
                      <span className="text-gray-500 ml-2">→ {step.beneficiary}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 死亡声明特别显示 */}
      {deathTxHash && (
        <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">💀</span>
              <div>
                <div className="text-xs text-purple-300 font-medium">死亡声明已上链</div>
                <div className="text-[10px] text-gray-500 font-mono">{shortenAddress(deathTxHash)}</div>
              </div>
            </div>
            <a
              href={getExplorerUrl(deathTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
            >
              <ExternalLink size={12} />
              查看
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default WillExecutionTimeline;
