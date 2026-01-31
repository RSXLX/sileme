import React from 'react';
import { Beneficiary } from '../types';
import { AdjustmentEntry } from '../services/agentService';
import { Scale, AlertTriangle, Check, X, ArrowRight } from 'lucide-react';

interface WeightedDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalBeneficiaries: Beneficiary[];
  adjustedBeneficiaries: Beneficiary[];
  adjustmentLog: AdjustmentEntry[];
  willWeight: number;
  socialWeight: number;
  intentMatch: number;
  onExecuteAdjusted: () => void;
  onExecuteOriginal: () => void;
}

export const WeightedDistributionModal: React.FC<WeightedDistributionModalProps> = ({
  isOpen,
  onClose,
  originalBeneficiaries,
  adjustedBeneficiaries,
  adjustmentLog,
  willWeight,
  socialWeight,
  intentMatch,
  onExecuteAdjusted,
  onExecuteOriginal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl mx-4 bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-cyan-500/30 shadow-[0_0_50px_rgba(0,200,255,0.2)] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">加权分配调整</h2>
              <p className="text-sm text-gray-400">
                意图匹配度 {intentMatch}% - AI 建议按以下方案调整分配
              </p>
            </div>
          </div>
        </div>

        {/* Weight Indicator */}
        <div className="px-6 py-4 bg-slate-800/50">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-xs text-gray-400 w-20">遗嘱权重</span>
            <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
                style={{ width: `${willWeight * 100}%` }}
              />
            </div>
            <span className="text-sm font-mono text-cyan-400 w-12 text-right">
              {(willWeight * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 w-20">社交权重</span>
            <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${socialWeight * 100}%` }}
              />
            </div>
            <span className="text-sm font-mono text-purple-400 w-12 text-right">
              {(socialWeight * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="px-6 py-4 max-h-[300px] overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left pb-3">受益人</th>
                <th className="text-center pb-3">原始分配</th>
                <th className="text-center pb-3"></th>
                <th className="text-center pb-3">调整后</th>
                <th className="text-left pb-3">来源</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {adjustmentLog.map((log, idx) => (
                <tr key={idx} className="text-sm">
                  <td className="py-3">
                    <span className="text-white font-medium">{log.beneficiary}</span>
                  </td>
                  <td className="text-center py-3">
                    <span className="text-gray-400 font-mono">{log.originalPercentage}%</span>
                  </td>
                  <td className="text-center py-3">
                    <ArrowRight size={16} className="text-gray-600 mx-auto" />
                  </td>
                  <td className="text-center py-3">
                    <span className={`font-mono font-bold ${
                      log.adjustedPercentage > log.originalPercentage 
                        ? 'text-green-400' 
                        : log.adjustedPercentage < log.originalPercentage 
                          ? 'text-red-400' 
                          : 'text-gray-400'
                    }`}>
                      {log.adjustedPercentage}%
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      log.source === 'WILL' 
                        ? 'bg-cyan-500/20 text-cyan-400' 
                        : log.source === 'SOCIAL' 
                          ? 'bg-purple-500/20 text-purple-400' 
                          : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {log.source === 'WILL' ? '遗嘱' : log.source === 'SOCIAL' ? '社交' : '混合'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Adjustment Reasons */}
        <div className="px-6 py-4 bg-slate-800/30 border-t border-gray-700/50">
          <h4 className="text-xs text-gray-500 uppercase mb-2">调整说明</h4>
          <div className="space-y-1 max-h-[100px] overflow-y-auto">
            {adjustmentLog.map((log, idx) => (
              <div key={idx} className="text-xs text-gray-400">
                <span className="text-gray-300">{log.beneficiary}:</span> {log.reason}
              </div>
            ))}
          </div>
        </div>

        {/* Warning */}
        <div className="px-6 py-3 bg-yellow-500/10 border-t border-yellow-500/30">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300">
              社交信号与遗嘱存在差异。请仔细审核调整方案，确认后将不可撤销。
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-700/50 flex gap-3">
          <button
            onClick={onExecuteAdjusted}
            className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <Check size={18} />
            按调整方案执行
          </button>
          <button
            onClick={onExecuteOriginal}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <X size={18} />
            按原遗嘱执行
          </button>
        </div>
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};
