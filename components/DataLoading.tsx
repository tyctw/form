import React, { useEffect, useState } from 'react';
import { GraduationCap } from './Icons';

export const DataLoading: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    "正在連接資料庫...",
    "分析歷年落點數據...",
    "計算加權比序...",
    "生成專屬邀請碼..."
  ];

  useEffect(() => {
    // Simulate progress with a slightly more realistic curve
    let currentProgress = 0;
    const interval = setInterval(() => {
        // Slow down as we get closer to 100%
        const remaining = 100 - currentProgress;
        const increment = Math.max(0.5, Math.random() * (remaining / 20)); 
        
        currentProgress = Math.min(currentProgress + increment, 99); // Don't hit 100 until done
        setProgress(currentProgress);
        
        if (currentProgress >= 99) {
           clearInterval(interval);
        }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update text based on progress thresholds
    if (progress < 30) setCurrentStep(0);
    else if (progress < 60) setCurrentStep(1);
    else if (progress < 85) setCurrentStep(2);
    else setCurrentStep(3);
  }, [progress]);

  return (
    <div className="w-full max-w-xl mx-auto min-h-[500px] flex flex-col items-center justify-center p-8 bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-white/50 animate-fade-in-up">
      
      {/* Icon Animation */}
      <div className="relative mb-12">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-2xl animate-pulse"></div>
        
        {/* Center Icon */}
        <div className="relative w-24 h-24 bg-white rounded-2xl shadow-[0_10px_30px_-10px_rgba(6,182,212,0.3)] border border-cyan-50 flex items-center justify-center z-10 animate-bounce">
             <GraduationCap className="w-10 h-10 text-cyan-600" />
        </div>
        
        {/* Spinning Rings */}
        <div className="absolute inset-0 -m-4 border-2 border-dashed border-cyan-200 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
        <div className="absolute inset-0 -m-4 border-2 border-transparent border-t-cyan-400/50 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
        <div className="absolute inset-0 -m-8 border border-slate-100 rounded-full animate-spin" style={{ animationDuration: '12s', animationDirection: 'reverse' }}></div>
      </div>

      {/* Text Info */}
      <div className="text-center space-y-3 mb-10 w-full max-w-md">
        <h3 className="text-xl font-bold text-slate-800 min-h-[28px] transition-all duration-300 transform">
           {steps[currentStep]}
        </h3>
        <p className="text-slate-400 text-xs font-mono tracking-wider animate-pulse">
           PROCESSING_REQUEST... {Math.round(progress)}%
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-xs space-y-2">
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 shadow-inner p-[1px]">
           <div 
             className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 transition-all duration-300 ease-out relative overflow-hidden"
             style={{ width: `${progress}%` }}
           >
             {/* Shimmer on progress bar */}
             <div className="absolute inset-0 bg-white/20 animate-[shimmer_1s_infinite]"></div>
           </div>
        </div>
      </div>
      
    </div>
  );
};