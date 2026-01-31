import React, { useEffect, useState, useCallback } from 'react';
import { Brain, Wallet, Users, FileCheck, Sparkles, Zap, Shield, Activity } from 'lucide-react';
import { Beneficiary } from '../types';
import { FriendInfo } from '../services/agentService';

interface AnalysisPhase {
  id: number;
  title: string;
  titleEn: string;
  icon: React.ReactNode;
  duration: number;
  messages: string[];
  messagesEn: string[];
}

const PHASES: AnalysisPhase[] = [
  {
    id: 1,
    title: '获取遗嘱信息',
    titleEn: 'Parsing Manifesto',
    icon: <FileCheck className="w-6 h-6" />,
    duration: 1500,
    messages: [
      '正在读取遗嘱内容...',
      '解析自然语言意图...',
      '提取关键信息完成'
    ],
    messagesEn: [
      'Reading manifesto content...',
      'Parsing natural language intent...',
      'Key information extracted'
    ]
  },
  {
    id: 2,
    title: '扫描钱包资产',
    titleEn: 'Scanning Wallet',
    icon: <Wallet className="w-6 h-6" />,
    duration: 2000,
    messages: [
      '连接 KITE Oracle 节点...',
      '扫描链上资产...',
      '同步余额数据...',
      '资产快照完成'
    ],
    messagesEn: [
      'Connecting to KITE Oracle node...',
      'Scanning on-chain assets...',
      'Syncing balance data...',
      'Asset snapshot complete'
    ]
  },
  {
    id: 3,
    title: '识别受益人',
    titleEn: 'Identifying Beneficiaries',
    icon: <Users className="w-6 h-6" />,
    duration: 2500,
    messages: [
      'AI 分析受益人信息...',
      '验证钱包地址格式...',
      '计算分配比例...',
      '生成受益人清单'
    ],
    messagesEn: [
      'AI analyzing beneficiary info...',
      'Validating wallet addresses...',
      'Calculating distribution ratio...',
      'Generating beneficiary list'
    ]
  },
  {
    id: 4,
    title: '生成执行计划',
    titleEn: 'Generating Execution Plan',
    icon: <Shield className="w-6 h-6" />,
    duration: 1500,
    messages: [
      '构建智能合约调用...',
      '验证执行逻辑...',
      '封存协议完成 ✓'
    ],
    messagesEn: [
      'Building smart contract calls...',
      'Validating execution logic...',
      'Protocol sealed ✓'
    ]
  }
];

interface AIAnalysisModalProps {
  isOpen: boolean;
  onComplete: (beneficiaries: Beneficiary[]) => void;
  onClose: () => void;
  manifesto: string;
  analyzeFn: (manifesto: string, lang: string, twitterHandle?: string, agentSettings?: any, friends?: FriendInfo[]) => Promise<Beneficiary[]>;
  language: string;
  twitterHandle?: string;
  agentSettings?: any;
  friends?: FriendInfo[]; // Twitter 好友列表（含钱包地址）
}

export const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({
  isOpen,
  onComplete,
  onClose,
  manifesto,
  analyzeFn,
  language,
  twitterHandle,
  agentSettings,
  friends = [] // 默认空列表
}) => {
  // Debug Log
  if (isOpen) {
    console.log('🔍 AIAnalysisModal Rendering. isOpen:', isOpen, 'Manifesto:', manifesto?.slice(0, 20));
  }

  const [currentPhase, setCurrentPhase] = useState(0);
  const [displayedMessages, setDisplayedMessages] = useState<string[]>([]);
  const [currentTypingMessage, setCurrentTypingMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isZh = language === 'zh';

  // Typewriter effect
  const typeMessage = useCallback((message: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsTyping(true);
      let index = 0;
      setCurrentTypingMessage('');
      
      const interval = setInterval(() => {
        if (index < message.length) {
          setCurrentTypingMessage(prev => prev + message[index]);
          index++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
          setDisplayedMessages(prev => [...prev, message]);
          setCurrentTypingMessage('');
          resolve();
        }
      }, 30);
    });
  }, []);

  // Run analysis phases
  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setCurrentPhase(0);
      setDisplayedMessages([]);
      setCurrentTypingMessage('');
      setAnalysisComplete(false);
      setBeneficiaries([]);
      setError(null);
      return;
    }

    let isCancelled = false;

    const runAnalysis = async () => {
      try {
        // Phase 1-3: Visual phases
        for (let phaseIdx = 0; phaseIdx < PHASES.length - 1; phaseIdx++) {
          if (isCancelled) return;
          
          const phase = PHASES[phaseIdx];
          setCurrentPhase(phaseIdx + 1);
          
          const messages = isZh ? phase.messages : phase.messagesEn;
          for (const msg of messages) {
            if (isCancelled) return;
            await typeMessage(msg);
            await new Promise(r => setTimeout(r, 300));
          }
          
          await new Promise(r => setTimeout(r, phase.duration - messages.length * 300));
        }

        // Actually call the AI API during phase 3
        setCurrentPhase(4);
        const lastPhase = PHASES[3];
        const lastMessages = isZh ? lastPhase.messages : lastPhase.messagesEn;
        
        // Start API call with social context + friends data
        console.log(`🤝 [AIAnalysisModal] Passing ${friends.length} friends to analyzeFn`);
        const resultPromise = analyzeFn(manifesto, language, twitterHandle, agentSettings, friends);
        
        // Show final phase messages while waiting
        for (let i = 0; i < lastMessages.length - 1; i++) {
          if (isCancelled) return;
          await typeMessage(lastMessages[i]);
          await new Promise(r => setTimeout(r, 400));
        }
        
        // Wait for API result
        const result = await resultPromise;
        
        if (isCancelled) return;
        
        // Show completion message
        await typeMessage(lastMessages[lastMessages.length - 1]);
        
        setBeneficiaries(result);
        setAnalysisComplete(true);
        
        // Auto close after showing results
        await new Promise(r => setTimeout(r, 2000));
        if (!isCancelled) {
          onComplete(result);
        }
        
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Analysis failed');
          await typeMessage(isZh ? '❌ 分析失败，请重试' : '❌ Analysis failed, please retry');
        }
      }
    };

    runAnalysis();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, manifesto, language, isZh]); // 🔧 移除不稳定依赖，只依赖核心状态

  if (!isOpen) return null;

  const currentPhaseData = PHASES[currentPhase - 1] || PHASES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={error ? onClose : undefined}
      />
      
      {/* Main content */}
      <div className="relative z-10 w-full max-w-2xl mx-4">
        {/* Pulsing glow effect */}
        <div className="absolute inset-0 -m-8">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-3xl animate-pulse" />
        </div>
        
        {/* Modal card */}
        <div className="relative bg-gray-900/90 border border-cyan-500/30 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
          {/* Header with brain icon */}
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/30 rounded-full blur-xl animate-ping" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
                <Brain className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
          
          {/* Phase indicators */}
          <div className="flex justify-between mb-8 px-4">
            {PHASES.map((phase, idx) => (
              <div 
                key={phase.id}
                className={`flex flex-col items-center transition-all duration-500 ${
                  idx + 1 <= currentPhase ? 'opacity-100' : 'opacity-30'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-500 ${
                  idx + 1 < currentPhase 
                    ? 'bg-green-500/20 border-2 border-green-500 text-green-400'
                    : idx + 1 === currentPhase
                    ? 'bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400 animate-pulse'
                    : 'bg-gray-800 border border-gray-700 text-gray-500'
                }`}>
                  {idx + 1 < currentPhase ? (
                    <Sparkles className="w-5 h-5" />
                  ) : (
                    phase.icon
                  )}
                </div>
                <span className={`text-xs font-medium text-center ${
                  idx + 1 <= currentPhase ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {isZh ? phase.title : phase.titleEn}
                </span>
              </div>
            ))}
          </div>
          
          {/* Progress bar */}
          <div className="h-1 bg-gray-800 rounded-full mb-6 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-1000 ease-out"
              style={{ width: `${(currentPhase / PHASES.length) * 100}%` }}
            />
          </div>
          
          {/* Terminal-style message area */}
          <div className="bg-black/50 border border-gray-800 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Activity className="w-4 h-4 animate-pulse text-cyan-500" />
              <span className="text-cyan-500">AGENT_AI</span>
              <span>::</span>
              <span>{isZh ? currentPhaseData.title : currentPhaseData.titleEn}</span>
            </div>
            
            {displayedMessages.map((msg, idx) => (
              <div key={idx} className="text-gray-400 mb-1 flex items-start gap-2">
                <span className="text-cyan-600">›</span>
                <span>{msg}</span>
              </div>
            ))}
            
            {currentTypingMessage && (
              <div className="text-green-400 mb-1 flex items-start gap-2">
                <span className="text-cyan-600">›</span>
                <span>{currentTypingMessage}</span>
                <span className="animate-pulse">▊</span>
              </div>
            )}
            
            {isTyping && !currentTypingMessage && (
              <div className="text-gray-500 flex items-center gap-1">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
              </div>
            )}
          </div>
          
          {/* Results preview */}
          {analysisComplete && beneficiaries.length > 0 && (
            <div className="mt-6 space-y-2 animate-fade-in">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                {isZh ? '识别到的受益人' : 'Identified Beneficiaries'}
              </div>
              <div className="grid gap-2">
                {beneficiaries.slice(0, 3).map((b, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-4 py-2"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{b.name}</div>
                        <div className="text-gray-500 text-xs">{b.category}</div>
                      </div>
                    </div>
                    <div className="text-cyan-400 font-mono font-bold">
                      {b.percentage}%
                    </div>
                  </div>
                ))}
                {beneficiaries.length > 3 && (
                  <div className="text-center text-gray-500 text-xs">
                    +{beneficiaries.length - 3} {isZh ? '更多' : 'more'}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className="mt-6 text-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                {isZh ? '关闭' : 'Close'}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Custom animation keyframes */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
