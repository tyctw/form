import { useState } from 'react';
import { Menu, X, ExternalLink, Instagram, Share2 } from 'lucide-react';

// Custom SVG path for Threads since it's not standard in lucide-react
const ThreadsIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 16 16" 
    fill="currentColor" 
    className={className}
  >
    <path d="M6.321 6.016c-.27-.18-1.166-.802-1.166-.802.756-1.081 1.753-1.502 3.132-1.502.975 0 1.803.327 2.394.948s.928 1.509 1.005 2.644q.492.207.905.484c1.109.745 1.719 1.86 1.719 3.137 0 2.716-2.226 5.075-6.256 5.075C4.594 16 1 13.987 1 7.994 1 2.034 4.482 0 8.044 0 9.69 0 13.55.243 15 5.036l-1.36.353C12.516 1.974 10.163 1.43 8.006 1.43c-3.565 0-5.582 2.171-5.582 6.79 0 4.143 2.254 6.343 5.63 6.343 2.777 0 4.847-1.443 4.847-3.556 0-1.438-1.208-2.127-1.27-2.127-.236 1.234-.868 3.31-3.644 3.31-1.618 0-3.013-1.118-3.013-2.582 0-2.09 1.984-2.847 3.55-2.847.586 0 1.294.04 1.663.114 0-.637-.54-1.728-1.9-1.728-1.25 0-1.566.405-1.967.868ZM8.716 8.19c-2.04 0-2.304.87-2.304 1.416 0 .878 1.043 1.168 1.6 1.168 1.02 0 2.067-.282 2.232-2.423a6.2 6.2 0 0 0-1.528-.161"/>
  </svg>
);

export function Header({ onShareClick }: { onShareClick?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className="bg-white/90 backdrop-blur-md text-slate-900 px-4 sm:px-8 py-3 items-center fixed top-0 w-full z-40 border-b-[3px] border-slate-900 flex justify-between flex-none transition-all duration-300">
        <a href="#/" className="flex items-center gap-3 cursor-pointer group">
          <div className="w-10 h-10 geometric-card bg-slate-900 text-white flex items-center justify-center font-extrabold text-base tracking-wider rounded-sm rotate-2 group-hover:rotate-0 transition-transform">
            115
          </div>
          <div className="font-extrabold text-lg sm:text-xl tracking-widest text-slate-900 group-hover:text-slate-700 transition-colors">
            全國會考分析系統
          </div>
        </a>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {onShareClick && (
            <button 
              onClick={onShareClick} 
              className="p-2 text-slate-900 hover:bg-slate-100 transition-colors border-2 border-slate-900 rounded-md shadow-[2px_2px_0_#0F172A] active:translate-y-[2px] active:shadow-none"
              title="分享系統"
            >
              <Share2 className="w-5 h-5 flex-shrink-0" />
            </button>
          )}
          <button 
            onClick={() => setIsOpen(true)} 
            className="p-2 text-slate-900 hover:bg-slate-100 transition-colors border-2 border-slate-900 rounded-md shadow-[2px_2px_0_#0F172A] active:translate-y-[2px] active:shadow-none"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Right Drawer */}
      <div 
        className={`fixed right-0 top-0 h-full w-[85%] max-w-sm bg-white border-l-[3px] border-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-5 flex justify-between items-center bg-slate-50 border-b-[3px] border-slate-900">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-slate-900 text-white flex items-center justify-center font-extrabold text-sm rounded-sm">
                115
             </div>
             <h2 className="font-extrabold text-lg tracking-widest text-slate-900 uppercase">功能選單</h2>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-8 flex-grow overflow-y-auto">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-300"></span> 系統連結
            </h3>
            <a 
              href="https://tyctw.github.io/spare/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-white border-2 border-slate-200 hover:border-slate-900 hover:shadow-[4px_4px_0_#0F172A] hover:-translate-y-1 transition-all font-bold text-slate-900 text-base rounded-md"
            >
              會考落點分析
              <ExternalLink className="w-5 h-5 text-slate-400" />
            </a>
            <a 
              href="https://tyctw.github.io/score/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-white border-2 border-slate-200 hover:border-slate-900 hover:shadow-[4px_4px_0_#0F172A] hover:-translate-y-1 transition-all font-bold text-slate-900 text-base rounded-md"
            >
              全國序位分享
              <ExternalLink className="w-5 h-5 text-slate-400" />
            </a>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-300"></span> 聯絡與追蹤
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <a 
                href="https://www.instagram.com/115.rcpet/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-3 p-5 bg-gradient-to-br from-pink-50 to-orange-50 border-2 border-pink-200 hover:border-pink-500 hover:shadow-[4px_4px_0_#db2777] hover:-translate-y-1 transition-all font-bold text-pink-700 rounded-md"
              >
                <Instagram className="w-7 h-7" />
                <span className="text-[13px] tracking-wide">Instagram</span>
              </a>
              <a 
                href="https://www.threads.com/@115.rcpet"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-3 p-5 bg-slate-50 border-2 border-slate-200 hover:border-slate-900 hover:shadow-[4px_4px_0_#0F172A] hover:-translate-y-1 transition-all font-bold text-slate-900 rounded-md"
              >
                <ThreadsIcon className="w-7 h-7" />
                <span className="text-[13px] tracking-wide">Threads</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
