import React from 'react';
import { ArrowRight } from './Icons';

export const Support: React.FC = () => {
  return (
    <div className="bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-white/50 p-8 md:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight border-b border-slate-100 pb-4">支援中心</h2>
      
      <div className="grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
           <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 rounded-3xl border border-slate-200">
             <h3 className="text-xl font-bold text-slate-800 mb-3">聯絡我們</h3>
             <p className="text-slate-600 mb-4 leading-relaxed">若您在使用過程遇到任何問題，或有任何合作建議，歡迎來信與我們聯繫。</p>
             <a href="mailto:tyctw.analyze@gmail.com" className="text-cyan-600 font-bold text-lg hover:text-cyan-700 hover:underline transition-colors block mb-2">tyctw.analyze@gmail.com</a>
             <p className="text-xs text-slate-400">平均回覆時間：24 小時內</p>
           </div>

           <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
             <h3 className="text-xl font-bold text-slate-800 mb-3">問題回報</h3>
             <p className="text-slate-600 mb-6 leading-relaxed">發現系統錯誤或數據異常？請填寫回報表單，工程團隊將盡快處理。</p>
             <a 
               href="https://tyctw.github.io/report_form" 
               target="_blank" 
               rel="noreferrer"
               className="inline-flex items-center gap-2 text-white bg-slate-800 px-6 py-3 rounded-xl hover:bg-slate-700 transition-all hover:shadow-lg hover:-translate-y-0.5 font-bold"
             >
               <span>填寫回報表單</span>
               <ArrowRight className="w-4 h-4" />
             </a>
           </div>
        </div>

        <div className="space-y-6">
           <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <span className="text-cyan-500">Q&A</span> 常見問題
           </h3>
           <div className="space-y-4">
             <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-cyan-100 transition-colors">
               <h4 className="font-bold text-slate-800 mb-2 text-lg">Q: 邀請碼如何使用？</h4>
               <p className="text-slate-600">A: 請複製獲得的邀請碼，前往 TW會考落點分析主頁面輸入框，即可解鎖分析功能。</p>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-cyan-100 transition-colors">
               <h4 className="font-bold text-slate-800 mb-2 text-lg">Q: 為什麼沒有收到驗證碼郵件？</h4>
               <p className="text-slate-600">A: 本平台採用即時生成機制，邀請碼會直接顯示在網頁上，不會另外寄送郵件。請務必直接複製網頁上的代碼。</p>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-cyan-100 transition-colors">
               <h4 className="font-bold text-slate-800 mb-2 text-lg">Q: 資料會被外洩嗎？</h4>
               <p className="text-slate-600">A: 我們嚴格保護您的隱私，所有資料僅用於生成代碼與內部教育統計，絕不外流給第三方。</p>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-cyan-100 transition-colors">
               <h4 className="font-bold text-slate-800 mb-2 text-lg">Q: 分析結果準確嗎？</h4>
               <p className="text-slate-600">A: 落點分析是基於歷年數據與演算法推估，僅供參考。實際錄取標準會受當年考題難易度與招生名額影響。</p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};