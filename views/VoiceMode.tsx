
import React, { useEffect } from 'react';
import { useLiveGemini } from '../hooks/useLiveGemini';
import { User } from '../types';
import { Mic, X, Radio, ArrowRight } from 'lucide-react';
import Waveform from '../components/Waveform';

interface VoiceModeProps {
  user: User;
  onClose: () => void;
}

export const VoiceMode: React.FC<VoiceModeProps> = ({ user, onClose }) => {
  const { isConnected, isSpeaking, error, connect, disconnect } = useLiveGemini(user);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-between p-6">
      {/* Header */}
      <div className="w-full flex justify-between items-center mt-4">
        <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
           <Radio className={`w-4 h-4 ${isConnected ? 'text-green-400 animate-pulse' : 'text-red-400'}`} />
           <span className="text-xs font-medium">{isConnected ? 'آنلاین' : 'در حال اتصال...'}</span>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center gap-1 group"
        >
          <ArrowRight className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold px-1">بازگشت</span>
        </button>
      </div>

      {/* Main Visual */}
      <div className="flex flex-col items-center justify-center flex-1 w-full gap-8">
        
        <div className="relative group">
           {/* Glow Effect */}
           <div className={`absolute -inset-4 bg-teal-500/20 rounded-full blur-xl transition-all duration-1000 ${isSpeaking ? 'scale-150 opacity-100' : 'scale-100 opacity-50'}`}></div>
           
           <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 border-4 ${isSpeaking ? 'border-teal-400 bg-teal-900/50 scale-110' : 'border-white/10 bg-white/5'}`}>
             {isSpeaking ? (
                <Waveform active={true} />
             ) : (
                <div className="flex flex-col items-center text-teal-200/50">
                   <Mic className="w-12 h-12 mb-2" />
                   <span className="text-xs">منتظر صحبت شما</span>
                </div>
             )}
           </div>
        </div>

        <div className="text-center space-y-2 max-w-xs">
          <h2 className="text-2xl font-bold text-white">
            {isSpeaking ? 'شهریار گوش می‌دهد...' : 'صحبت کنید...'}
          </h2>
          <p className="text-slate-400 text-sm">
            از من درباره تاریخچه پسته، مکان‌های دیدنی یا آب و هوای رفسنجان بپرسید.
          </p>
        </div>

        {error && (
            <div className="bg-red-500/20 text-red-200 px-4 py-2 rounded-lg text-sm border border-red-500/30">
                {error}
            </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="w-full flex justify-center pb-8">
        <button 
            onClick={isConnected ? disconnect : connect}
            className={`px-8 py-4 rounded-2xl font-bold shadow-xl transition-all active:scale-95 ${isConnected ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-teal-500 hover:bg-teal-400 text-teal-950'}`}
        >
            {isConnected ? 'قطع تماس' : 'تلاش مجدد'}
        </button>
      </div>
    </div>
  );
};