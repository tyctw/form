import React from 'react';
import { ArrowRight, CheckCheck, Sparkles } from './Icons';

export const Instructions: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight mb-4">系統使用指南</h2>
        <p className="text-slate-500 max-w-xl mx-auto">
          簡單四步驟，即可解鎖 TW會考落點分析系統的完整功能。
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          
          {/* Step 1: Large Card */}
          <div className="md:col-span-2 bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-lg transition-all duration-300">
             <div className="w-16 h-16 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center text-3xl font-black shadow-inner shrink-0">
                01
             </div>
             <div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">填寫申請表單</h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                   在首頁填寫您的基本資料（身分、考區）。若系統已開放成績功能，請一併輸入會考成績與序位區間，以確保落點分析的準確性。
                </p>
             </div>
          </div>

          {/* Step 2: Tall Card */}
          <div className="md:row-span-2 bg-gradient-to-b from-violet-600 to-fuchsia-600 rounded-[2.5rem] p-8 shadow-xl shadow-violet-200 text-white flex flex-col justify-between relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-8 opacity-20">
                <Sparkles className="w-32 h-32 rotate-12" />
             </div>
             <div>
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-black mb-6">
                   02
                </div>
                <h3 className="text-2xl font-bold mb-3">獲取邀請碼</h3>
                <p className="text-violet-100 text-sm leading-relaxed">
                   系統將即時運算並生成您的專屬代碼。該代碼具有時效性，請立即複製保存。
                </p>
             </div>
             <div className="mt-8 pt-6 border-t border-white/20">
                <div className="bg-white/10 rounded-xl p-3 font-mono text-center text-lg font-bold tracking-widest">TW2025...</div>
             </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-sm hover:shadow-lg transition-all duration-300">
             <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-slate-800">前往分析系統</h3>
                <span className="text-slate-200 font-black text-4xl">03</span>
             </div>
             <p className="text-slate-600 text-sm mb-4">
                點擊結果頁面的「進入分析系統」按鈕，或前往備用連結。
             </p>
             <a href="https://tyctw.github.io/spare/" target="_blank" className="text-violet-600 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                立即前往 <ArrowRight className="w-4 h-4" />
             </a>
          </div>

          {/* Step 4 */}
          <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white shadow-sm hover:shadow-lg transition-all duration-300">
             <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-slate-800">解鎖預測</h3>
                <span className="text-slate-200 font-black text-4xl">04</span>
             </div>
             <p className="text-slate-600 text-sm">
                在主系統輸入邀請碼，即可查看您的落點學校與錄取機率。
             </p>
          </div>
      </div>

      <div className="bg-amber-50 rounded-3xl p-6 md:p-8 border border-amber-100 flex flex-col md:flex-row gap-6 items-start">
         <div className="shrink-0 bg-amber-100 p-3 rounded-xl text-amber-600">
            <Sparkles className="w-6 h-6" />
         </div>
         <div>
            <h3 className="text-lg font-bold text-amber-800 mb-2">重要提醒</h3>
            <ul className="grid md:grid-cols-2 gap-3">
              <li className="flex items-center gap-2 text-sm text-amber-700">
                 <CheckCheck className="w-4 h-4 shrink-0" /> 邀請碼時效通常為 1 小時
              </li>
              <li className="flex items-center gap-2 text-sm text-amber-700">
                 <CheckCheck className="w-4 h-4 shrink-0" /> 建議使用 Chrome 瀏覽器
              </li>
              <li className="flex items-center gap-2 text-sm text-amber-700">
                 <CheckCheck className="w-4 h-4 shrink-0" /> 預設成績不影響系統體驗
              </li>
            </ul>
         </div>
      </div>
    </div>
  );
};