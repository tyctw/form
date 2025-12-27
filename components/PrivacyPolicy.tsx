import React from 'react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-white/50 p-8 md:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight border-b border-slate-100 pb-4">隱私權政策</h2>
      <div className="space-y-8 text-slate-600 leading-relaxed">
        <p>歡迎使用 TW會考落點分析平台（以下簡稱本平台）。我們非常重視您的隱私權，請詳細閱讀以下隱私權政策，以瞭解我們如何收集、應用及保護您的個人資訊。</p>
        
        <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                1. 資料收集
            </h3>
            <p>當您使用本平台申請邀請碼時，我們可能會收集以下資訊：電子郵件地址、身分（考生、家長等）、所在考區及資訊來源。這些資料僅用於生成邀請碼及統計分析，不會用於其他商業用途。</p>
        </section>

        <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                2. 資料使用
            </h3>
            <p>收集的資料將用於：</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 bg-slate-50 p-4 rounded-xl">
            <li>發送分析邀請碼及相關通知。</li>
            <li>優化平台功能與使用者體驗。</li>
            <li>進行去識別化的數據統計與教育分析研究。</li>
            </ul>
        </section>

        <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                3. 資料保護
            </h3>
            <p>我們致力於保護您的資訊安全。本平台採用適當的技術措施防止未經授權的存取、修改或洩漏。然而，網際網路傳輸無法保證百分之百安全，請您自行評估風險。</p>
        </section>

        <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-cyan-500 rounded-full"></span>
                4. 聯絡我們
            </h3>
            <p>若您對本隱私權政策有任何疑問，請透過電子郵件 <a href="mailto:tyctw.analyze@gmail.com" className="text-cyan-600 font-bold hover:underline">tyctw.analyze@gmail.com</a> 與我們聯繫。</p>
        </section>
      </div>
    </div>
  );
};