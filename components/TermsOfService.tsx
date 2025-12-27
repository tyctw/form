import React from 'react';

export const TermsOfService: React.FC = () => {
  return (
    <div className="bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-white/50 p-8 md:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight border-b border-slate-100 pb-4">服務條款</h2>
      <div className="space-y-8 text-slate-600 leading-relaxed">
        <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                1. 認知與接受條款
            </h3>
            <p>當您使用 TW會考落點分析平台（以下簡稱本平台）提供的服務時，即表示您已閱讀、瞭解並同意遵守本服務條款之所有內容。若您不同意本條款的任何部分，請立即停止使用本服務。</p>
        </section>

        <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                2. 服務內容
            </h3>
            <p>本平台提供國中教育會考落點分析之輔助工具。所有的分析結果僅供參考，實際錄取結果仍以官方公告為準。本平台不保證分析結果的完全準確性，亦不對任何升學結果負責。</p>
        </section>

        <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                3. 免責聲明
            </h3>
            <p>本平台所提供之資訊僅供教育及參考用途。對於因使用本平台資訊而產生的任何直接或間接損害，本平台不負任何法律責任。使用者應自行判斷資訊的正確性與適用性。</p>
        </section>

        <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                4. 智慧財產權
            </h3>
            <p>本平台之所有內容，包括但不限於文字、圖片、程式碼、數據模型等，均受智慧財產權法保護。未經授權，不得擅自複製、修改、散布或進行反向工程。</p>
        </section>
        
        <section>
            <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>
                5. 條款修改
            </h3>
            <p>本平台保留隨時修改本服務條款之權利，修改後的條款將公佈於網站上，不另行個別通知。您持續使用本服務將視為您已接受修改後的條款。</p>
        </section>
      </div>
    </div>
  );
};