import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, FileText, HelpCircle, Lock, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';

type PageKey = 'guide' | 'privacy' | 'disclaimer';

const pageData: Record<PageKey, {
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof HelpCircle;
  accent: string;
  sections: { title: string; body: string; bullets?: string[] }[];
}> = {
  guide: {
    eyebrow: '使用指南',
    title: '使用說明',
    description: '請先閱讀本說明，再決定是否提供資料。送出前請確認資料正確；本系統不提供成績、序位或錄取結果的保證。',
    icon: HelpCircle,
    accent: 'bg-emerald-400',
    sections: [
      { title: '使用前確認', body: '本系統為民間資訊整理與問卷服務，並非招生主管機關、學校或免試入學委員會。未成年使用者建議先與家長、監護人或師長討論後再填寫。' },
      { title: '填寫基本與成績資料', body: '請依畫面欄位填寫招生區、會考年度、身分別、各科成績、作文級分及序位區間。請以個人正式成績單、招生區查詢結果或其他可核對資料為準，勿輸入他人資料或不實資料。' },
      { title: '序位資料尚未取得時', body: '若招生區尚未開放序位區間查詢，或您目前無法確認數值，可使用「略過序位」功能。略過後，系統能提供的資料範圍及分析精細度可能受限。' },
      { title: 'Email 與自訂題目', body: 'Email 用於表單驗證、防止重複或不當填寫，以及必要的服務聯繫。若畫面出現自訂題目，請先閱讀各欄說明；除標示必填者外，您可不填寫。' },
      { title: '送出、邀請碼與更正', body: '送出前請利用確認畫面逐項檢查。送出後系統可能核發限時邀請碼，供您前往相關分析服務；邀請碼遺失、逾期或無法使用時，不保證可以補發。若要更正或刪除已送出的個人資料，請依隱私權政策所列聯絡方式提出申請。', bullets: ['請勿將邀請碼或結果頁面公開分享，以免他人取得您的資訊。', '招生規則、志願選填與錄取結果，均應以各招生區當年度官方公告為準。'] },
    ],
  },
  privacy: {
    eyebrow: '資料保護',
    title: '隱私權政策',
    description: '本政策說明本系統蒐集、處理及利用個人資料的方式，以及您可以行使的權利。',
    icon: Lock,
    accent: 'bg-indigo-400',
    sections: [
      { title: '管理者與適用範圍', body: '本政策適用於「全國會考分析系統」（下稱本系統）所提供的網站與問卷服務。本系統之個人資料聯絡窗口為 tyctw.analyze@gmail.com；外部連結網站、第三方服務或其隱私權政策，並不在本系統控制範圍內。' },
      { title: '蒐集的資料類別', body: '依您使用的功能，本系統可能蒐集招生區、會考年度、身分別、各科成績、作文級分、序位比率或區間、Email、您主動填寫的自訂題目內容，以及送出時間與必要的系統操作紀錄。成績、序位與 Email 的組合可能間接識別個人，因此本系統以個人資料方式處理。' },
      { title: '蒐集目的與法律依據', body: '蒐集資料用於完成問卷、驗證輸入、防止濫用、產生邀請碼、提供或改進統計與分析服務、處理使用者詢問，以及維護系統安全。您送出表單時，係在閱讀本政策後自行決定提供；本系統僅在前述特定目的必要範圍內處理與利用資料。' },
      { title: '利用期間、地區、對象與方式', body: '資料將在達成前述目的、處理爭議、遵守法令或維護系統所必要的期間內保存；目的消失、期限屆滿或依法應停止處理時，將依適用法令停止處理、刪除或採取其他適當措施。資料可能由經授權的系統管理人員及受託提供主機、資料庫、寄送或資安服務的供應商，在提供服務所必要的地區以電子化方式處理。若服務供應商位於境外，資料可能發生跨境處理。' },
      { title: '統計、公開與第三方提供', body: '本系統得使用彙總或經合理去識別化的資料進行趨勢統計與服務改善；公開統計時，不應包含可合理識別特定個人的資訊。本系統不以出售、出租或交換個人資料為目的；除經您同意、為提供服務所必要而委託處理、依法令要求，或為保護重要權益外，不會任意提供可識別的個人資料給第三人。' },
      { title: '資料安全', body: '本系統採取合理的存取控管與技術、管理措施，降低未經授權存取、洩漏、竄改或遺失的風險；但網際網路傳輸與資訊系統無法保證絕對安全。若知悉發生應通知的個人資料事故，本系統將依適用法令與情況採取必要處置及通知。' },
      { title: '您的權利與行使方式', body: '您可就本人資料請求查詢或閱覽、製給複製本、補充或更正、停止蒐集／處理／利用，或刪除。請以 Email 寄至 tyctw.analyze@gmail.com，主旨註明「個資權利申請」，並說明所需事項與足以核對身分的必要資訊；本系統會依適用法令處理。為保護資料安全，必要時可能要求補充身分驗證資料。' },
      { title: '不提供資料的影響', body: '您可自行決定是否提供資料；但缺少必填欄位時，系統可能無法完成問卷、進行相應的分析、核發邀請碼或回覆您的申請。您可選擇不使用本服務，不影響您依官方管道取得招生資訊的權利。' },
      { title: '政策更新與聯絡', body: '本政策可能因功能、法令或安全措施調整而更新，更新後將於本頁公告並標示更新日期。若您對本政策、資料處理或權利行使有疑問，請聯絡 tyctw.analyze@gmail.com。' },
    ],
  },
  disclaimer: {
    eyebrow: '重要告知',
    title: '免責聲明',
    description: '請在使用本系統前理解其資訊性質與限制；任何招生、志願或升學決策，均應自行核對官方資料。',
    icon: ShieldCheck,
    accent: 'bg-rose-400',
    sections: [
      { title: '服務性質', body: '本系統提供問卷蒐集、資料整理、統計與分析輔助功能，屬資訊參考工具；並非教育主管機關、招生區、學校、免試入學委員會或其授權代表。' },
      { title: '非錄取或分發保證', body: '系統呈現的結果、估算、排序、建議、邀請碼或外部連結內容，不構成錄取、分發、志願選填或任何升學結果的承諾、保證或專業意見。不同資料、規則、年度、招生區或個人條件，都可能導致結果不同。' },
      { title: '官方資訊優先', body: '招生資格、比序項目、名額、時程、簡章、報名、志願選填、分發及錄取結果，均應以當年度各招生區及主管機關正式公告為準。若本系統內容與官方公告不一致，應以官方公告為準。' },
      { title: '資料正確性與時效限制', body: '本系統盡力維持內容合理正確，但資料可能因使用者輸入錯誤、資料來源更新、規則變動、系統延遲或技術問題而不完整、過時或有誤。使用者應自行檢核輸入資料與結果，不應僅依本系統資訊作出重大決策。' },
      { title: '使用者責任與未成年使用', body: '使用者應合法、善意使用本服務，不得輸入他人個人資料、冒用身分、嘗試干擾系統或將服務用於違法目的。未成年使用者應在家長、監護人或師長協助下評估是否使用本服務與提供資料。' },
      { title: '外部連結與第三方服務', body: '本系統可能提供第三方網站或服務連結，僅為使用便利。該等網站的內容、可用性、資安與資料處理方式由其管理者負責；使用前請自行閱讀其條款及隱私權政策。' },
      { title: '服務可用性與責任範圍', body: '本系統可能因維護、網路、設備、第三方服務、不可抗力或其他因素中斷、延遲或無法使用。於法律允許範圍內，本系統不就因依賴本系統資訊、服務中斷或第三方內容所生的間接、附帶或衍生損失負責；此聲明不排除依法不得排除的責任。' },
      { title: '變更與聯絡', body: '本系統得基於功能、法令或營運需要調整本聲明或服務內容；重要變更將於本頁公告。若您發現內容疑義或需要協助，請以 tyctw.analyze@gmail.com 聯絡。' },
    ],
  },
};

export default function Information() {
  const key = useLocation().pathname.slice(1) as PageKey;
  const page = pageData[key] ?? pageData.guide;
  const Icon = page.icon;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Header />
      <main className="grid-pattern pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 mb-7 text-sm font-bold text-slate-600 hover:text-slate-950 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回首頁
          </Link>

          <section className="geometric-card bg-white overflow-hidden">
            <div className="p-7 sm:p-12 border-b-2 border-slate-900 bg-slate-950 text-white relative overflow-hidden">
              <div className={`absolute -right-10 -top-10 w-40 h-40 ${page.accent} opacity-90 rotate-12`} />
              <div className="relative max-w-2xl">
                <span className="inline-flex items-center gap-2 px-3 py-1 border border-white/40 text-xs font-black tracking-[0.2em] uppercase">{page.eyebrow}</span>
                <div className="flex items-center gap-4 mt-7">
                  <div className={`w-14 h-14 ${page.accent} border-2 border-white flex items-center justify-center text-slate-950 shadow-[4px_4px_0_#fff]`}><Icon className="w-7 h-7" /></div>
                  <h1 className="text-4xl sm:text-5xl font-black tracking-tight">{page.title}</h1>
                </div>
                <p className="mt-5 text-slate-300 leading-relaxed text-base sm:text-lg">{page.description}</p>
              </div>
            </div>

            <div className="p-7 sm:p-12">
              <div className="grid gap-5">
                {page.sections.map((section, index) => (
                  <article key={section.title} className="border-2 border-slate-200 p-5 sm:p-6 hover:border-slate-900 transition-colors">
                    <div className="flex gap-4">
                      <span className={`shrink-0 w-8 h-8 ${page.accent} border-2 border-slate-900 flex items-center justify-center font-black text-sm`}>{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <h2 className="text-xl font-black">{section.title}</h2>
                        <p className="mt-2 text-slate-600 leading-relaxed">{section.body}</p>
                        {section.bullets && <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-700">{section.bullets.map(bullet => <li key={bullet} className="flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />{bullet}</li>)}</ul>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-10 pt-7 border-t-2 border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <p className="text-sm text-slate-500 font-medium">最後更新：2026 年 7 月</p>
                <Link to="/" className="inline-flex items-center gap-2 px-5 py-3 border-2 border-slate-900 font-black shadow-[4px_4px_0_#0F172A] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">回到填寫問卷 <ArrowRight className="w-4 h-4" /></Link>
              </div>
            </div>
          </section>

          <nav aria-label="相關資訊" className="grid grid-cols-3 gap-2 sm:gap-3 mt-8">
            {([
              ['guide', '使用說明', BookOpen],
              ['privacy', '隱私權政策', Lock],
              ['disclaimer', '免責聲明', FileText],
            ] as const).map(([target, label, NavIcon]) => (
              <Link key={target} to={`/${target}`} className={`flex items-center justify-center sm:justify-between gap-1 p-3 sm:p-4 bg-white border-2 font-bold text-xs sm:text-base transition-all ${key === target ? 'border-slate-900 shadow-[3px_3px_0_#0F172A]' : 'border-slate-200 hover:border-slate-900'}`}>
                <span className="flex items-center gap-1.5 sm:gap-3"><NavIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />{label}</span><ArrowRight className="hidden sm:block w-4 h-4 shrink-0" />
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </div>
  );
}
