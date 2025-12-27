import React from 'react';
import { ArrowRight } from './Icons';

interface SystemErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemErrorModal: React.FC<SystemErrorModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
       <div className="relative bg-white rounded-3xl p-8 shadow-2xl w-full max-w-md text-center animate-in zoom-in-95 duration-200 border border-red-100">
          {/* Warning Icon */}
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 animate-bounce">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h3 className="text-2xl font-black text-slate-800 mb-3">系統暫時發生異常</h3>
          <p className="text-slate-600 mb-8 leading-relaxed">
            很抱歉，系統目前無法處理您的請求。為了不影響您的權益，請透過下方的備用表單進行申請。
          </p>

          <a 
            href="https://docs.google.com/forms/d/e/1FAIpQLSdPGrqFkGqmI8Nhu2LONgPtNtvikLjTvbQ1foyTgQnV1Sstqg/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 shadow-lg shadow-red-500/30 hover:shadow-red-500/40 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 mb-4"
          >
            <span>填寫備用表單</span>
            <ArrowRight className="w-5 h-5" />
          </a>
          
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-sm py-2"
          >
            稍後再試
          </button>
       </div>
    </div>
  );
};