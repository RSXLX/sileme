
import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AgentSettings } from '../services/socialDataService';
import { useLanguage } from '../contexts/LanguageContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AgentSettings) => void;
  initialSettings: AgentSettings;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialSettings 
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'MOCK' | 'REAL'>(initialSettings.mode);
  const [apiKey, setApiKey] = useState(initialSettings.socialApiKey || '');
  const [endpoint, setEndpoint] = useState(initialSettings.socialApiEndpoint || '');

  // Reset local state when modal opens with new initialSettings
  useEffect(() => {
    if (isOpen) {
      setMode(initialSettings.mode);
      setApiKey(initialSettings.socialApiKey || '');
      setEndpoint(initialSettings.socialApiEndpoint || '');
    }
  }, [isOpen, initialSettings]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      mode,
      socialApiKey: apiKey,
      socialApiEndpoint: endpoint
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 relative shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <ShieldCheck className="text-kite-neon" />
          Agent Settings
        </h2>

        <div className="space-y-6">
          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-mono uppercase">Scanning Mode</label>
            <div className="grid grid-cols-2 gap-2 bg-gray-800 p-1 rounded-lg">
              <button
                onClick={() => setMode('MOCK')}
                className={`py-2 px-4 rounded-md text-sm font-bold transition-all ${
                  mode === 'MOCK' 
                    ? 'bg-gray-700 text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Simulation (Mock)
              </button>
              <button
                onClick={() => setMode('REAL')}
                className={`py-2 px-4 rounded-md text-sm font-bold transition-all ${
                  mode === 'REAL' 
                    ? 'bg-kite-neon text-black shadow-[0_0_10px_rgba(0,240,255,0.3)]' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Real Data (API)
              </button>
            </div>
          </div>

          {/* Real Mode Configuration */}
          {mode === 'REAL' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-200 flex gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <p>
                  Requires a valid API Key from a supported Twitter Data provider (e.g. RapidAPI).
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-kite-neon font-mono uppercase">API Key (X-RapidAPI-Key)</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API Key here..."
                  className="w-full bg-black/50 border border-gray-700 rounded p-3 text-white focus:border-kite-neon focus:ring-1 focus:ring-kite-neon outline-none font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-500 font-mono uppercase">API Endpoint (Optional)</label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://twitter154.p.rapidapi.com/user/details"
                  className="w-full bg-black/50 border border-gray-700 rounded p-3 text-gray-300 focus:border-kite-neon/50 outline-none font-mono text-xs"
                />
                <p className="text-[10px] text-gray-600">
                  Defaults to generic RapidAPI structure if left blank.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 mt-4"
          >
            <Save size={18} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
