import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { InvitationResult } from '../types';
import { ClipboardCopy, CheckCheck, QrCode, X, Clock, ArrowRight, Sparkles, Download } from './Icons';

interface ResultCardProps {
  result: InvitationResult;
  onReset: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result, onReset }) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    // Serialize SVG to string
    const svgData = new XMLSerializer().serializeToString(svg);
    
    // Create canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    // High resolution for download
    const size = 1000;
    canvas.width = size;
    canvas.height = size;

    img.onload = () => {
      if (ctx) {
        // Draw white background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, size, size);
        
        // Draw image
        ctx.drawImage(img, 0, 0, size, size);
        
        // Convert to PNG and download
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `TW_InviteCode_${result.code}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };

    // Load SVG data into image
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = result.expiresTimestamp - now;

      if (difference <= 0) {
        onReset();
      } else {
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [result.expiresTimestamp, onReset]);

  return (
    <>
      <div className="w-full max-w-xl mx-auto animate-fade-in-up perspective-1000">
        
        {/* Success Badge */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/80 backdrop-blur-md px-6 py-2 rounded-full shadow-lg shadow-violet-100 border border-white flex items-center gap-2 animate-scale-in">
             <div className="w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center text-white shadow-sm">
                <CheckCheck className="w-3.5 h-3.5" />
             </div>
             <span className="font-bold text-slate-700">申請成功，請保存您的代碼</span>
          </div>
        </div>

        {/* Holographic Ticket */}
        <div className="relative group perspective-1000">
             {/* Glowing border effect */}
             <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-400 rounded-[2.2rem] opacity-30 blur-lg group-hover:opacity-60 transition duration-500 animate-pulse-slow"></div>
             
             <div className="relative bg-white/80 backdrop-blur-xl rounded-[2rem] overflow-hidden border border-white/60 shadow-2xl">
                 
                 {/* Top Decor */}
                 <div className="h-32 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay"></div>
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute top-8 left-8">
                         <div className="flex items-center gap-2 text-white/90 mb-1">
                             <Sparkles className="w-4 h-4 text-amber-300" />
                             <span className="text-xs font-bold tracking-widest uppercase">Invitation Ticket</span>
                         </div>
                         <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-md">落點分析通行證</h2>
                    </div>
                 </div>

                 {/* Ticket Body */}
                 <div className="px-8 pt-8 pb-10">
                     <div className="text-center mb-8">
                        <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">YOUR ACCESS CODE</p>
                        <div 
                            onClick={handleCopy}
                            className={`
                                relative overflow-hidden cursor-pointer
                                bg-slate-50 border-2 border-dashed rounded-2xl p-6
                                transition-all duration-300 transform active:scale-[0.98] group/code
                                ${copied ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:border-violet-400 hover:bg-violet-50/50'}
                            `}
                        >
                            <div className="font-mono font-black text-4xl sm:text-5xl text-slate-800 tracking-wider whitespace-nowrap z-10 relative text-gradient">
                                {result.code}
                            </div>
                            
                            <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${copied ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-500 opacity-0 group-hover/code:opacity-100'}`}>
                                {copied ? 'COPIED' : 'COPY'}
                            </div>
                        </div>
                     </div>

                     <div className="flex gap-3 mb-8">
                         <button onClick={handleCopy} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${copied ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                             {copied ? <CheckCheck className="w-4 h-4"/> : <ClipboardCopy className="w-4 h-4"/>}
                             {copied ? '已複製代碼' : '複製代碼'}
                         </button>
                         <button onClick={() => setShowQr(true)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-white border border-slate-200 text-slate-600 hover:border-violet-200 hover:text-violet-600 transition-all flex items-center justify-center gap-2">
                             <QrCode className="w-4 h-4"/>
                             QR Code
                         </button>
                     </div>

                     <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-3">
                         <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                         <div className="text-xs text-amber-800 leading-relaxed">
                             <strong className="block mb-1 text-amber-900">代碼有效期限</strong>
                             此代碼將於 <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200 mx-1">{result.expiresAt}</span> ({timeLeft} 後) 失效，請盡速使用。
                         </div>
                     </div>
                 </div>

                 {/* Action Footer */}
                 <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-3">
                     <a
                        href="https://tyctw.github.io/spare/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 relative overflow-hidden group/btn"
                      >
                        <div className="absolute inset-0 -translate-x-full group-hover/btn:animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                        <span>進入分析系統</span>
                        <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                      </a>
                      
                      <button onClick={onReset} className="w-full py-3 rounded-xl font-bold text-slate-400 text-sm hover:text-slate-600 transition-colors">
                          重新填寫表單
                      </button>
                 </div>
             </div>
        </div>
      </div>

      {/* QR Modal */}
      {showQr && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in" onClick={() => setShowQr(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center animate-scale-in border border-white/50">
             <button onClick={() => setShowQr(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
               <X className="w-5 h-5" />
             </button>
             <h3 className="text-xl font-black text-slate-800 mb-6">邀請碼 QR Code</h3>
             
             {/* QR Container with Ref */}
             <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100 inline-block mb-4">
                <QRCode value={result.code} size={200} level="H" fgColor="#4c1d95" style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox={`0 0 256 256`}/>
             </div>

             <button 
                onClick={handleDownloadQr}
                className="w-full py-2.5 mb-4 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-all flex items-center justify-center gap-2"
             >
                <Download className="w-4 h-4" />
                下載 QR Code
             </button>

             <p className="font-mono font-bold text-2xl text-violet-700 tracking-wider mb-2">{result.code}</p>
             <p className="text-xs text-rose-500 font-bold animate-pulse">剩餘時間: {timeLeft}</p>
          </div>
        </div>
      )}
    </>
  );
};