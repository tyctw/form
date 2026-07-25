import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Header } from '../components/Header';
import { 
  Building2, 
  GraduationCap, 
  BookOpen, 
  Calculator, 
  Globe, 
  Atom, 
  PenTool, 
  Percent, 
  ListOrdered, 
  Mail, 
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Clock,
  Copy,
  AlertCircle,
  HelpCircle,
  X,
  Ticket,
  Info,
  Share2,
  ChevronDown,
  User,
  AlertTriangle,
  Facebook,
  Instagram,
  MessageCircle,
  AtSign,
  MapPin,
  Lock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CustomQuestion, QuestionnaireData, SubjectScore, EssayScoreType } from '../types';

const REGIONS = [
  "基北區", "桃聯區", "竹苗區", "中投區", "彰化區", 
  "雲林區", "嘉義區", "台南區", "高雄區", "屏東區", 
  "宜蘭區", "花蓮區", "台東區", "澎湖區", "金門區"
];
const TAIPEI_TIME_ZONE = 'Asia/Taipei';

function getExamYears(now = new Date()) {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: TAIPEI_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const part = (type: string) => Number(dateParts.find(item => item.type === type)?.value);
  const year = part('year');
  const month = part('month');
  const day = part('day');
  const hasReachedAnnualUpdate = month > 7 || (month === 7 && day >= 15);
  const latestExamYear = year - 1911 + (hasReachedAnnualUpdate ? 1 : 0);

  return Array.from({ length: 6 }, (_, index) => String(latestExamYear - index));
}

const EXAM_YEARS = getExamYears();
const IDENTITIES = ["學生", "家長", "老師", "補教業"];
const SCORES: SubjectScore[] = ['A++', 'A+', 'A', 'B++', 'B+', 'B', 'C'];
const ESSAY_SCORES: EssayScoreType[] = ['6', '5', '4', '3', '2', '1', '0'];

function generateInvitationCode() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  return "SH" + year + month + day + hour;
}

function calculateExpirationTime() {
  const now = new Date();
  const expiration = new Date(now);
  expiration.setMinutes(59, 59, 999);
  return expiration;
}

const initialData: QuestionnaireData = {
  region: '',
  examYear: EXAM_YEARS[0],
  identity: '',
  chineseScore: '',
  mathScore: '',
  englishScore: '',
  socialScore: '',
  scienceScore: '',
  essayScore: '',
  minRatio: '',
  maxRatio: '',
  minRankInterval: '',
  maxRankInterval: '',
  email: '',
  skipRanking: false,
  customAnswers: {}
};

export default function Home() {
  const [formData, setFormData] = useState<QuestionnaireData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [inviteResult, setInviteResult] = useState<{code: string, expiration: Date} | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // App Config Settings
  const [announcementDate, setAnnouncementDate] = useState('2026-06-16T12:00:00+08:00');
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [subjectScoreStartTime, setSubjectScoreStartTime] = useState<string | null>(null);
  const [subjectScoreEndTime, setSubjectScoreEndTime] = useState<string | null>(null);
  const [subjectScoreEnabled, setSubjectScoreEnabled] = useState(true);
  const [systemStartTime, setSystemStartTime] = useState<string | null>(null);
  const [systemEndTime, setSystemEndTime] = useState<string | null>(null);
  const [systemEnabled, setSystemEnabled] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        if (!supabase) return;
        const { data } = await supabase.from('survey_config').select('*').limit(1).maybeSingle();
        if (data) {
          if (data.announcement_date) setAnnouncementDate(data.announcement_date);
          if (data.custom_questions) {
            setCustomQuestions(data.custom_questions.filter((q: any) => q.id !== '__SYSTEM_BACKUPS__'));
          }
          if (data.subject_score_start_time) setSubjectScoreStartTime(data.subject_score_start_time);
          if (data.subject_score_end_time) setSubjectScoreEndTime(data.subject_score_end_time);
          if (data.subject_score_enabled !== undefined && data.subject_score_enabled !== null) setSubjectScoreEnabled(data.subject_score_enabled);
          if (data.system_start_time) setSystemStartTime(data.system_start_time);
          if (data.system_end_time) setSystemEndTime(data.system_end_time);
          if (data.system_enabled !== undefined && data.system_enabled !== null) setSystemEnabled(data.system_enabled);
        }
      } catch (e) {
        console.error('No custom config found, using defaults.');
      }
    };
    fetchSettings();
  }, []);

  const isBeforeAnnouncement = new Date() < new Date(announcementDate);
  const forceSkipRanking = formData.examYear === EXAM_YEARS[0] && isBeforeAnnouncement;
  const effectiveSkipRanking = formData.skipRanking || forceSkipRanking;

  const isSubjectScoreActive = (() => {
    if (!subjectScoreEnabled) return false;
    const now = new Date();
    if (subjectScoreStartTime && now < new Date(subjectScoreStartTime)) return false;
    if (subjectScoreEndTime && now > new Date(subjectScoreEndTime)) return false;
    return true;
  })();

  const isSystemActive = (() => {
    if (!systemEnabled) return false;
    const now = new Date();
    if (systemStartTime && now < new Date(systemStartTime)) return false;
    if (systemEndTime && now > new Date(systemEndTime)) return false;
    return true;
  })();

  const activeCustomQuestions = customQuestions.filter(q => {
    const now = new Date();
    if (q.startTime && now < new Date(q.startTime)) return false;
    if (q.endTime && now > new Date(q.endTime)) return false;
    return true;
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSuccess && inviteResult) {
      const checkExpiration = () => {
        if (new Date() >= inviteResult.expiration) {
          setIsSuccess(false);
          setInviteResult(null);
        }
      };
      timer = setInterval(checkExpiration, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSuccess, inviteResult]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    if (target.type === 'checkbox') {
      const { name, checked } = target as HTMLInputElement;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      const { name, value } = target;
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCustomAnswerChange = (qId: string, value: any, type: string) => {
    setFormData(prev => {
      const updatedAnswers = { ...prev.customAnswers };
      if (type === 'checkbox') {
        const currentVals = updatedAnswers[qId] || [];
        if (currentVals.includes(value)) {
          updatedAnswers[qId] = currentVals.filter((v: string) => v !== value);
        } else {
          updatedAnswers[qId] = [...currentVals, value];
        }
      } else {
        updatedAnswers[qId] = value;
      }
      return { ...prev, customAnswers: updatedAnswers };
    });
  };

  const handleScoreClick = (name: keyof QuestionnaireData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: string[] = [];
    if (!formData.region) errors.push('招生區');
    if (!formData.examYear) errors.push('會考年度');
    if (!formData.identity) errors.push('分析身分');

    if (isSubjectScoreActive) {
      if (!formData.chineseScore) errors.push('國文成績');
      if (!formData.mathScore) errors.push('數學成績');
      if (!formData.englishScore) errors.push('英文成績');
      if (!formData.socialScore) errors.push('社會成績');
      if (!formData.scienceScore) errors.push('自然成績');
      if (!formData.essayScore) errors.push('作文級分');
    }
    
    if (!effectiveSkipRanking) {
      if (!formData.minRatio) errors.push('全區序位最小比率 (%)');
      if (!formData.maxRatio) errors.push('全區序位最大比率 (%)');
      if (!formData.minRankInterval) errors.push('全區序位最小區間');
      if (!formData.maxRankInterval) errors.push('全區序位最大區間');
      
      if (Number(formData.minRatio) > Number(formData.maxRatio)) errors.push('「最小比率」不能大於「最大比率」');
      if (Number(formData.minRankInterval) > Number(formData.maxRankInterval)) errors.push('「最小區間」不能大於「最大區間」');
    }

    if (!formData.email) errors.push('Email 信箱');
    else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) errors.push('有效的 Email 格式');
    }

    // Validate Custom Questions
    activeCustomQuestions.forEach(q => {
      if (q.required) {
        const ans = formData.customAnswers[q.id];
        if (ans === undefined || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
          errors.push(`自訂題目: ${q.question}`);
        }
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    try {
      if (!supabase) {
        throw new Error("尚未設定 Supabase 連線，請在環境變數設定 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。");
      }

      let serverInviteCode = generateInvitationCode();
      const payload: any = {
        timestamp: new Date().toISOString(),
        region: formData.region,
        examYear: formData.examYear,
        identity: formData.identity,
        chineseScore: formData.chineseScore,
        mathScore: formData.mathScore,
        englishScore: formData.englishScore,
        socialScore: formData.socialScore,
        scienceScore: formData.scienceScore,
        essayScore: formData.essayScore,
        email: formData.email,
        inviteCode: serverInviteCode,
        custom_answers: formData.customAnswers
      };
      
      const tableName = effectiveSkipRanking ? 'survey_responses_skip_ranking' : 'survey_responses_full';
      const insertData: any = { ...payload };
      
      if (!effectiveSkipRanking) {
        Object.assign(insertData, {
          minRatio: formData.minRatio ? parseFloat(formData.minRatio) : null,
          maxRatio: formData.maxRatio ? parseFloat(formData.maxRatio) : null,
          minRankInterval: formData.minRankInterval ? parseInt(formData.minRankInterval, 10) : null,
          maxRankInterval: formData.maxRankInterval ? parseInt(formData.maxRankInterval, 10) : null,
        });
      }

      let retries = 3;
      let success = false;
      let lastError = null;

      while (retries > 0 && !success) {
        try {
          const { error } = await supabase.from(tableName).insert([insertData]);

          if (error) {
            // Graceful fallback for custom_answers column if not created
            if (error.message.includes('custom_answers')) {
              console.warn('custom_answers column not found. Retrying without it...');
              delete insertData.custom_answers;
              const retryPayload = await supabase.from(tableName).insert([insertData]);
              if (retryPayload.error) throw new Error(retryPayload.error.message);
              success = true;
              break;
            }
            throw new Error(error.message);
          }
          success = true;
        } catch (err) {
          lastError = err;
          retries--;
          if (retries > 0) {
            await new Promise(r => setTimeout(r, (3 - retries) * 1000));
          }
        }
      }

      if (!success) {
        throw lastError;
      }

      setInviteResult({
        code: serverInviteCode,
        expiration: calculateExpirationTime()
      });
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error("Submission failed:", error);
      const errorMessage = error instanceof Error && error.message.includes("尚未設定") 
        ? error.message 
        : "資料儲存失敗，請稍後再試或確認您的 Supabase 資料表設定。";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteResult) return;
    const link = `https://tyctw.github.io/spare/?invite=${inviteResult.code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isSystemActive) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans text-slate-900 border-8 border-slate-900 flex flex-col items-center justify-center p-4">
         <div className="bg-white border-4 border-slate-900 p-8 shadow-[8px_8px_0_#0F172A] max-w-md w-full text-center">
           <div className="w-16 h-16 mx-auto mb-6 text-slate-900 flex items-center justify-center border-4 border-slate-900 rounded-full">
             <span className="text-3xl font-black">!</span>
           </div>
           <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">系統未開放</h1>
           <p className="font-bold text-slate-600 mb-6">目前的系統設定為不開放填寫，或尚未到達/已超過開放時間。<br/>請稍後再登入或聯繫管理員。</p>
         </div>
      </div>
    );
  }

  if (isSuccess && inviteResult) {
    const linkUrl = `https://tyctw.github.io/spare/?invite=${inviteResult.code}`;
    return (
      <>
        <Header onShareClick={() => setShowShareModal(true)} />
        <div className="min-h-screen grid-pattern pt-28 pb-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="max-w-4xl w-full">
            <div className="bg-white border-4 border-slate-900 shadow-[12px_12px_0_#0F172A] flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500 overflow-hidden">
              <div className="flex-1 p-8 sm:p-12 border-b-4 md:border-b-0 md:border-r-4 border-slate-900 bg-[size:20px_20px] bg-slate-50 flex flex-col justify-center relative">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-blue-500 to-emerald-400"></div>
                
                <div className="flex items-center space-x-3 mb-8">
                  <div className="w-10 h-10 bg-slate-900 text-emerald-400 flex items-center justify-center font-black shadow-[4px_4px_0_#34D399]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">System Response</div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">落點分析邀請碼</h2>
                  </div>
                </div>

                <div className="bg-white border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] p-6 mb-8 group hover:shadow-[8px_8px_0_#0F172A] hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-2 bg-emerald-400"></div>
                    <Ticket className="w-6 h-6 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <div className="font-mono text-4xl sm:text-5xl font-black tracking-tighter text-slate-900 mb-2 select-all">
                    {inviteResult.code}
                  </div>
                  <div className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 shadow-sm">
                    此代碼為系統自動帶入
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center text-xs font-black tracking-widest text-slate-500 uppercase mb-2">
                    <Clock className="w-4 h-4 mr-2" />
                    失效時間
                  </div>
                  <div className="font-mono text-2xl font-black text-rose-600 mb-2">
                    {inviteResult.expiration.toLocaleTimeString('zh-TW', { hour12: false })}
                  </div>
                  <p className="text-xs font-bold text-slate-500">代碼於填寫當小時末失效，請盡速使用</p>
                </div>
              </div>

              <div className="flex-1 p-8 sm:p-12 bg-slate-900 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-slate-800 rounded-full blur-3xl opacity-50"></div>
                <div className="relative z-10 space-y-6">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-500 text-white shadow-[4px_4px_0_#FFFFFF] mb-2">
                    <Info className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-wide">邀請碼使用說明</h3>
                  <p className="text-slate-300 leading-relaxed font-medium text-sm sm:text-base">
                    獲取邀請碼後，您可以直接點擊下方按鈕前往「落點分析系統」進行進階數據比對。本系統數據僅供參考，實際分發請依正式簡章為準。
                  </p>
                </div>

                <div className="relative z-10 mt-12 space-y-4">
                  <a 
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full group relative flex items-center justify-center py-4 px-6 bg-emerald-400 text-slate-900 font-black text-lg border-2 border-emerald-400 shadow-[4px_4px_0_#FFFFFF] hover:bg-emerald-300 hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    進入分析系統
                    <ExternalLink className="ml-3 w-5 h-5 group-hover:rotate-12 transition-transform" />
                  </a>
                  <button 
                    onClick={handleCopyLink}
                    className="w-full group flex items-center justify-center py-4 px-6 bg-slate-800 text-white font-bold text-base hover:bg-slate-700 transition-all border border-slate-700 hover:border-slate-500"
                  >
                    {copied ? (
                      <span className="flex items-center text-emerald-400"><CheckCircle2 className="w-5 h-5 mr-2" /> 已複製專屬連結</span>
                    ) : (
                      <span className="flex items-center text-slate-300 group-hover:text-white"><Copy className="w-5 h-5 mr-2" /> 複製專屬連結</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('確定要返回填寫嗎？您目前的專屬邀請碼將會遺失！\n建議您先複製或截圖保存。')) {
                        setIsSuccess(false);
                        setInviteResult(null);
                      }
                    }}
                    className="w-full text-slate-400 hover:text-white font-medium text-sm transition-colors mt-4 py-2"
                  >
                    返回填寫頁面
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  let currentSectionNumber = 1;
  const sectionBasic = currentSectionNumber++;
  const sectionSubject = isSubjectScoreActive ? currentSectionNumber++ : null;
  const sectionRank = !effectiveSkipRanking ? currentSectionNumber++ : null;
  const sectionCustom = activeCustomQuestions.length > 0 ? currentSectionNumber++ : null;
  const sectionContact = currentSectionNumber++;

  return (
    <>
      <Header onShareClick={() => setShowShareModal(true)} />
      <div className="min-h-screen grid-pattern pt-28 pb-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto geometric-card bg-white overflow-hidden">
        
        <div className="p-8 sm:p-10 border-b-2 border-slate-900 border-dashed relative">
          <div className="status-badge mb-4">Survey Mode v1.0.4</div>
          <button 
            type="button" 
            onClick={() => { window.location.hash = '#/guide'; }}
            className="absolute top-8 right-8 text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1 font-bold text-sm"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="hidden sm:inline">使用說明</span>
          </button>
          <h1 className="text-4xl font-extrabold tracking-tight mb-3 text-slate-900">會考序位調查問卷</h1>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
            為提供更精準的落點分析數據，請填寫您的會考成績與序位區間。<br className="hidden sm:block"/>
            填寫完成後，系統將自動產生您的專屬邀請碼供登入使用。
          </p>
        </div>

        {isBeforeAnnouncement ? (
          <div className="mx-8 mt-8 bg-slate-100 text-slate-800 p-4 border-2 border-slate-900 flex items-start">
            <AlertCircle className="w-5 h-5 mt-0.5 mr-3 shrink-0 text-slate-900" />
            <div className="text-sm">
              <strong className="font-bold block mb-1">公告：序位區間尚未開放查詢</strong>
              <p>115年度個人序位區間將於 {new Date(announcementDate).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 正式公告。在此之前，您可以先填寫成績獲取邀請碼。</p>
            </div>
          </div>
        ) : (
          <div className="mx-8 mt-8 bg-blue-50 text-blue-900 p-4 border-2 border-blue-600 flex items-start geometric-card !shadow-[4px_4px_0_#2563EB]">
            <Info className="w-5 h-5 mt-0.5 mr-3 shrink-0 text-blue-600" />
            <div className="text-sm">
              <strong className="font-bold block mb-1">公告：115年度序位區間已開放查詢</strong>
              <p className="mb-2">請先前往系統查詢您的序位資訊，再回來完整填寫，以獲得更準確的落點分析。</p>
              <a href="https://tyctw.github.io/volunteer/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-700 hover:text-blue-900 font-bold transition-colors underline underline-offset-2">
                <ExternalLink className="w-4 h-4 mr-1.5" /> 前往查詢序位區間
              </a>
            </div>
          </div>
        )}

        <div className="p-8 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* 基本資料 */}
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pb-2 border-b-2 border-slate-100 flex items-center uppercase tracking-wider">
                <span className="w-8 h-8 geometric-card bg-slate-900 text-white flex items-center justify-center mr-3 text-sm font-bold">{sectionBasic}</span>
                基本資料
              </h2>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="region" className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-1">
                    <Building2 className="w-4 h-4 mr-1.5 text-slate-400" /> 招生區域 <span className="text-slate-900 ml-1">*</span>
                  </label>
                  <button type="button" onClick={() => setShowRegionModal(true)} className="geo-input w-full text-left bg-white flex justify-between items-center">
                    <span className={formData.region ? 'text-slate-900 font-bold' : 'text-slate-500'}>
                      {formData.region || '請選擇招生區'}
                    </span>
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div>
                  <label htmlFor="examYear" className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-1">
                    <GraduationCap className="w-4 h-4 mr-1.5 text-slate-400" /> 會考年度 <span className="text-slate-900 ml-1">*</span>
                  </label>
                  <select id="examYear" name="examYear" value={formData.examYear} onChange={handleChange} className="geo-input">
                    {EXAM_YEARS.map(y => <option key={y} value={y}>{y}年度</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-6">
                <label className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-2">
                  <span className="w-4 h-4 mr-1.5 flex items-center justify-center font-black">
                    <User className="w-4 h-4 text-slate-400" />
                  </span>
                  分析身分 <span className="text-slate-900 ml-1">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {IDENTITIES.map(identity => (
                    <button key={identity} type="button" onClick={() => setFormData(prev => ({ ...prev, identity }))} className={`py-3 px-2 font-bold transition-all border-2 geometric-card active:translate-y-0.5 active:shadow-none flex items-center justify-center ${formData.identity === identity ? 'bg-slate-900 text-white border-slate-900 shadow-[3px_3px_0_#0F172A]' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-900 shadow-[2px_2px_0_transparent] hover:shadow-[3px_3px_0_#0F172A]'}`}>
                      {identity}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* 各科成績 */}
            {isSubjectScoreActive && (
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pb-2 border-b-2 border-slate-100 flex items-center uppercase tracking-wider">
                <span className="w-8 h-8 geometric-card bg-slate-900 text-white flex items-center justify-center mr-3 text-sm font-bold">{sectionSubject}</span>
                各科會考成績
              </h2>
              
              <div className="flex flex-col space-y-6">
                {[
                  { id: 'chineseScore', label: '國文', icon: BookOpen },
                  { id: 'mathScore', label: '數學', icon: Calculator },
                  { id: 'englishScore', label: '英文', icon: Globe },
                  { id: 'socialScore', label: '社會', icon: Building2 },
                  { id: 'scienceScore', label: '自然', icon: Atom },
                ].map((subject, index) => (
                  <div key={subject.id} className={`relative ${index !== 0 ? 'pt-6 border-t-2 border-slate-100' : ''}`}>
                    <label className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-2">
                      <subject.icon className="w-4 h-4 mr-1.5 text-slate-400" /> {subject.label}成績 <span className="text-slate-900 ml-1">*</span>
                    </label>
                    <div className="flex flex-row gap-1.5 sm:gap-2 w-full">
                      {SCORES.map(s => {
                        const isSelected = (formData as any)[subject.id] === s;
                        return (
                          <button key={s} type="button" onClick={() => handleScoreClick(subject.id as keyof QuestionnaireData, s)} className={`flex-1 py-2 sm:py-2.5 border-2 font-bold text-xs sm:text-sm transition-all text-center focus:outline-none ${isSelected ? 'border-slate-900 bg-slate-900 text-white shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)]' : 'border-slate-300 bg-white text-slate-700 shadow-[2px_2px_0_#94a3b8] hover:border-slate-900 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#0F172A]'}`}>
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                <div className="relative pt-6 border-t-2 border-slate-100">
                  <label className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-2">
                    <PenTool className="w-4 h-4 mr-1.5 text-slate-400" /> 作文級分 <span className="text-slate-900 ml-1">*</span>
                  </label>
                  <div className="flex flex-row gap-1.5 sm:gap-2 w-full">
                    {ESSAY_SCORES.map(s => {
                      const isSelected = formData.essayScore === s;
                      return (
                        <button key={s} type="button" onClick={() => handleScoreClick('essayScore', s)} className={`flex-1 py-2 sm:py-2.5 border-2 font-bold text-xs sm:text-sm transition-all text-center focus:outline-none ${isSelected ? 'border-slate-900 bg-slate-900 text-white shadow-[inset_0_3px_6px_rgba(0,0,0,0.6)]' : 'border-slate-300 bg-white text-slate-700 shadow-[2px_2px_0_#94a3b8] hover:border-slate-900 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#0F172A]'}`}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
            )}

            <div className={`flex flex-col items-start bg-slate-50 p-4 border-2 border-slate-900 geometric-card ${forceSkipRanking ? 'opacity-90 bg-slate-100' : ''} ${effectiveSkipRanking ? '!mb-20 mt-4' : 'mb-12'}`}>
              <div className="flex items-center w-full">
                <input type="checkbox" id="skipRanking" name="skipRanking" checked={effectiveSkipRanking} disabled={forceSkipRanking} onChange={handleChange} className={`w-5 h-5 accent-slate-900 border-2 border-slate-900 bg-white ${forceSkipRanking ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`} />
                <label htmlFor="skipRanking" className={`ml-3 block text-sm font-bold text-slate-900 select-none ${forceSkipRanking ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  不想提供序位資訊，直接獲取邀請碼
                </label>
              </div>
              {forceSkipRanking && (
                <p className="mt-3 text-xs font-bold text-rose-600 pl-8">
                  ※ 115年度個人序位區間公告前（{new Date(announcementDate).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}），自動略過填寫序位資訊。
                </p>
              )}
            </div>

            {!effectiveSkipRanking && (
            <section>
              <div className="flex justify-between items-end mb-6 pb-2 border-b-2 border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center uppercase tracking-wider">
                  <span className="w-8 h-8 geometric-card bg-slate-900 text-white flex items-center justify-center mr-3 text-sm font-bold">{sectionRank}</span>
                  全區序位數據
                </h2>
              </div>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="minRatio" className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-1">
                    <Percent className="w-4 h-4 mr-1.5 text-slate-400" /> 最小比率 (%) <span className="text-slate-900 ml-1">*</span>
                  </label>
                  <input type="number" step="0.01" min="0" id="minRatio" name="minRatio" value={formData.minRatio} onChange={handleChange} className="geo-input" />
                </div>
                <div>
                  <label htmlFor="maxRatio" className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-1">
                    <Percent className="w-4 h-4 mr-1.5 text-slate-400" /> 最大比率 (%) <span className="text-slate-900 ml-1">*</span>
                  </label>
                  <input type="number" step="0.01" min="0" id="maxRatio" name="maxRatio" value={formData.maxRatio} onChange={handleChange} className="geo-input" />
                </div>
                <div>
                  <label htmlFor="minRankInterval" className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-1">
                    <ListOrdered className="w-4 h-4 mr-1.5 text-slate-400" /> 最小區間 <span className="text-slate-900 ml-1">*</span>
                  </label>
                  <input type="number" min="1" id="minRankInterval" name="minRankInterval" value={formData.minRankInterval} onChange={handleChange} className="geo-input" />
                </div>
                <div>
                  <label htmlFor="maxRankInterval" className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-1">
                    <ListOrdered className="w-4 h-4 mr-1.5 text-slate-400" /> 最大區間 <span className="text-slate-900 ml-1">*</span>
                  </label>
                  <input type="number" min="1" id="maxRankInterval" name="maxRankInterval" value={formData.maxRankInterval} onChange={handleChange} className="geo-input" />
                </div>
              </div>
            </section>
            )}

            {activeCustomQuestions.length > 0 && (
              <section>
                <div className="flex justify-between items-end mb-6 pb-2 border-b-2 border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center uppercase tracking-wider">
                    <span className="w-8 h-8 geometric-card bg-slate-900 text-white flex items-center justify-center mr-3 text-sm font-bold">
                      {sectionCustom}
                    </span>
                    進階調查設定
                  </h2>
                </div>
                
                <div className="space-y-6">
                  {activeCustomQuestions.map(q => (
                    <div key={q.id} className="relative group">
                      <div className="absolute inset-0 bg-emerald-400 translate-x-1.5 translate-y-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border-2 border-slate-900"></div>
                      <div className="bg-white border-2 border-slate-900 p-5 sm:p-6 relative z-10 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-200">
                        <label className="text-base font-black text-slate-900 flex items-center mb-4 tracking-wide">
                          <span className="w-2 h-4 bg-emerald-400 mr-2 inline-block"></span>
                          {q.question} {q.required && <span className="text-rose-500 ml-1 pb-1">*</span>}
                        </label>
                        
                        {q.type === 'text' && (
                          <input 
                            type="text" 
                            value={formData.customAnswers[q.id] || ''} 
                            onChange={(e) => handleCustomAnswerChange(q.id, e.target.value, 'text')}
                            className="w-full border-2 border-slate-300 p-3 font-bold focus:border-slate-900 focus:outline-none focus:shadow-[4px_4px_0_#0F172A] transition-all bg-slate-50 focus:bg-white"
                            placeholder="請輸入您的回答..."
                          />
                        )}
                        
                        {q.type === 'radio' && q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {q.options.map((opt, i) => (
                              <label key={i} className={`flex items-center p-3 border-2 cursor-pointer transition-all ${formData.customAnswers[q.id] === opt ? 'border-slate-900 bg-emerald-50 shadow-[2px_2px_0_#0F172A]' : 'border-slate-200 hover:border-slate-400 bg-white'}`}>
                                <input 
                                  type="radio" 
                                  name={q.id} 
                                  value={opt}
                                  checked={formData.customAnswers[q.id] === opt}
                                  onChange={(e) => handleCustomAnswerChange(q.id, e.target.value, 'radio')}
                                  className="w-4 h-4 text-slate-900 accent-slate-900"
                                />
                                <span className="ml-3 font-bold text-slate-700">{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {q.type === 'checkbox' && q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {q.options.map((opt, i) => (
                              <label key={i} className={`flex items-center p-3 border-2 cursor-pointer transition-all ${(formData.customAnswers[q.id] || []).includes(opt) ? 'border-slate-900 bg-emerald-50 shadow-[2px_2px_0_#0F172A]' : 'border-slate-200 hover:border-slate-400 bg-white'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={(formData.customAnswers[q.id] || []).includes(opt)}
                                  onChange={() => handleCustomAnswerChange(q.id, opt, 'checkbox')}
                                  className="w-4 h-4 text-slate-900 accent-slate-900"
                                />
                                <span className="ml-3 font-bold text-slate-700">{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-6 pb-2 border-b-2 border-slate-100 flex items-center uppercase tracking-wider">
                <span className="w-8 h-8 geometric-card bg-slate-900 text-white flex items-center justify-center mr-3 text-sm font-bold">
                  {sectionContact}
                </span>
                聯絡資訊
              </h2>
              <div>
                <label htmlFor="email" className="text-[11px] font-bold uppercase text-slate-400 flex items-center mb-1">
                  <Mail className="w-4 h-4 mr-1.5 text-slate-400" /> Email信箱 <span className="text-slate-900 ml-1">*</span>
                </label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="geo-input max-w-md" />
                <p className="mt-2 text-[11px] uppercase font-bold text-slate-400">此信箱僅用於驗證及補發分析報告使用。</p>
              </div>
            </section>

            <div className="pt-6 border-t border-slate-100">
              <button type="submit" disabled={isSubmitting} className={`w-full py-5 mt-8 border-4 border-slate-900 transition-all flex items-center justify-center group ${isSubmitting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-emerald-400 text-slate-900 font-black text-lg shadow-[8px_8px_0_#0F172A] hover:bg-emerald-300 hover:-translate-y-1 hover:shadow-[10px_10px_0_#0F172A] active:translate-y-2 active:shadow-none'}`}>
                {isSubmitting ? '資料提交中...' : '提交資料並獲取邀請碼'}
                {!isSubmitting && <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-2 transition-transform" />}
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>

      {showConfirmModal && (
      <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-all">
        <div className="bg-white border-4 border-slate-900 p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-[8px_8px_0_#0F172A] relative">
          <button onClick={() => setShowConfirmModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors">
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-full border-2 border-blue-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">確認資料</h3>
              <p className="text-sm font-bold text-slate-500">請再次確認您填寫的各項數據</p>
            </div>
          </div>
          
          <div className="space-y-4 mb-8">
            <div className="bg-slate-50 p-4 border-2 border-slate-200 rounded-xl space-y-3">
              <div className="flex justify-between items-center border-b-2 border-slate-100 pb-2">
                <span className="text-sm font-bold text-slate-500">招生區</span>
                <span className="font-black text-slate-900">{formData.region}</span>
              </div>
              <div className="flex justify-between items-center border-b-2 border-slate-100 pb-2">
                <span className="text-sm font-bold text-slate-500">會考年度</span>
                <span className="font-black text-slate-900">{formData.examYear}</span>
              </div>
              <div className="flex justify-between items-center border-b-2 border-slate-100 pb-2">
                <span className="text-sm font-bold text-slate-500">身分</span>
                <span className="font-black text-slate-900">{formData.identity || '一般生'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-4">
                <span className="text-sm font-bold text-slate-500 shrink-0">聯絡信箱</span>
                <span className="font-bold text-slate-900 break-all sm:text-right">{formData.email}</span>
              </div>
            </div>
            
            {(isSubjectScoreActive || Object.values({c: formData.chineseScore, m: formData.mathScore, e: formData.englishScore, s: formData.socialScore, sc: formData.scienceScore, es: formData.essayScore}).some(Boolean)) && (
              <div className="bg-slate-50 p-4 border-2 border-slate-200 rounded-xl">
                <span className="text-sm font-bold text-slate-500 mb-3 block">各科級分</span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div className="text-center bg-white border-2 border-slate-200 py-1 rounded-lg">
                    <div className="text-[10px] text-slate-400 font-bold mb-0.5">國文</div>
                    <div className="font-black text-slate-800">{formData.chineseScore || '-'}</div>
                  </div>
                  <div className="text-center bg-white border-2 border-slate-200 py-1 rounded-lg">
                    <div className="text-[10px] text-slate-400 font-bold mb-0.5">數學</div>
                    <div className="font-black text-slate-800">{formData.mathScore || '-'}</div>
                  </div>
                  <div className="text-center bg-white border-2 border-slate-200 py-1 rounded-lg">
                    <div className="text-[10px] text-slate-400 font-bold mb-0.5">英文</div>
                    <div className="font-black text-slate-800">{formData.englishScore || '-'}</div>
                  </div>
                  <div className="text-center bg-white border-2 border-slate-200 py-1 rounded-lg">
                    <div className="text-[10px] text-slate-400 font-bold mb-0.5">社會</div>
                    <div className="font-black text-slate-800">{formData.socialScore || '-'}</div>
                  </div>
                  <div className="text-center bg-white border-2 border-slate-200 py-1 rounded-lg">
                    <div className="text-[10px] text-slate-400 font-bold mb-0.5">自然</div>
                    <div className="font-black text-slate-800">{formData.scienceScore || '-'}</div>
                  </div>
                  <div className="text-center bg-white border-2 border-slate-200 py-1 rounded-lg bg-emerald-50 text-emerald-900 border-emerald-200">
                    <div className="text-[10px] text-emerald-600 font-bold mb-0.5">作文</div>
                    <div className="font-black">{formData.essayScore || '-'}</div>
                  </div>
                </div>
              </div>
            )}

            {!effectiveSkipRanking ? (
              <div className="bg-blue-50 p-4 border-2 border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-blue-600 mb-1 block">序位區間</span>
                  <div className="font-black text-blue-900 text-lg">
                    {formData.minRankInterval} ~ {formData.maxRankInterval}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-600 mb-1 block">累積比率</span>
                  <div className="font-black text-blue-900 text-lg">
                    {formData.minRatio}% ~ {formData.maxRatio}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 p-4 border-2 border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-bold text-amber-800 mb-1 block">無需序位資訊</span>
                  <p className="text-xs font-bold text-amber-700/80">本次提交不包含序位與比率資訊，將僅記錄您的基本資料與成績。</p>
                </div>
              </div>
            )}
            
          </div>
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => setShowConfirmModal(false)} className="flex-1 py-3 border-2 border-slate-900 bg-white hover:bg-slate-50 font-black shrink-0 text-slate-700 transition-colors">返回修改</button>
            <button type="button" onClick={handleConfirmSubmit} disabled={isSubmitting} className={`flex-1 py-3 border-2 border-slate-900 bg-emerald-400 font-black shrink-0 text-slate-900 shadow-[4px_4px_0_#0F172A] flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all'}`}>
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                  傳送中...
                </>
              ) : (
                '確認送出'
              )}
            </button>
          </div>
        </div>
      </div>
      )}

      {showRegionModal && (
      <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
        <div className="bg-white border-4 border-slate-900 p-8 max-w-lg w-full shadow-[8px_8px_0_#0F172A] relative">
          <button onClick={() => setShowRegionModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors">
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-full border-2 border-blue-200">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-slate-900">選擇招生區</h3>
              <p className="text-sm font-bold text-slate-500">請選擇考生所在的就學分發區域</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 mb-8">
            {REGIONS.map(r => (
              <button 
                key={r} 
                onClick={() => { setFormData(prev => ({...prev, region: r})); setShowRegionModal(false); }} 
                className={`py-3 px-2 border-2 rounded-xl border-slate-200 hover:border-slate-900 font-bold text-sm transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0_#0F172A] ${formData.region === r ? 'bg-slate-900 text-white border-slate-900 shadow-[4px_4px_0_#0F172A]' : 'bg-white text-slate-700'}`}
              >
                {r}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setShowRegionModal(false)} 
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 transition-colors font-black border-2 border-slate-200 rounded-xl"
          >
            返回
          </button>
        </div>
      </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 border-t-8 border-emerald-400 py-6 px-4 sm:px-6 lg:px-8 mt-12 relative z-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-400 flex items-center justify-center -rotate-6 shadow-[2px_2px_0_#34D399] border-2 border-transparent">
              <Atom className="w-5 h-5 text-slate-900" />
            </div>
            <span className="text-white font-black tracking-widest text-sm">全國會考分析系統</span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-bold text-slate-400">
            <button onClick={() => setShowShareModal(true)} className="hover:text-emerald-400 transition-colors">分享系統</button>
            <Link to="/guide" className="hover:text-emerald-400 transition-colors">使用說明</Link>
            <Link to="/privacy" className="hover:text-emerald-400 transition-colors">隱私權政策</Link>
            <Link to="/disclaimer" className="hover:text-emerald-400 transition-colors">免責聲明</Link>
            <a href="tyctw.analyze@gmail.com" className="hover:text-emerald-400 transition-colors">聯絡我們</a>
          </div>

          <div className="text-xs font-bold text-slate-500 tracking-wider">
            &copy; {new Date().getFullYear()} 全國會考分析系統
          </div>
        </div>
      </footer>

      {showHelpModal && (
      <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white border-4 border-slate-900 p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-[8px_8px_0_#0F172A] relative">
          <button onClick={() => setShowHelpModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-full border-2 border-emerald-200">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">系統使用說明</h3>
          </div>
          <div className="space-y-6 text-slate-700 text-base leading-relaxed mb-8">
            <section>
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs">1</span>
                填寫正確資訊
              </h4>
              <p className="pl-8 text-sm text-slate-600">請依照您的會考成績單，據實輸入各科成績等級與標示。若所在學區已開放查詢序位區間，請一併輸入您的序位範圍，這將有助於系統進行更精確的落點分析。</p>
            </section>
            <section>
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs">2</span>
                無序位資訊處理方式
              </h4>
              <p className="pl-8 text-sm text-slate-600">各就學區序位公告時間可能有所不同。若您在填寫時尚未取得序位資訊，請勾選「無序位資訊/尚未公告」選項，系統仍會根據您的各科成績幫您初步評估可能落點範圍。</p>
            </section>
            <section>
              <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-xs">3</span>
                取得與使用邀請碼
              </h4>
              <p className="pl-8 text-sm text-slate-600">表單成功送出後，系統會自動生成一組為您專屬的「分析邀請碼」。取得後請將邀請碼複製，並前往我們合作的第三方落點分析平台輸入，即可解鎖詳細的落點預測與志願選填建議。</p>
            </section>
            <div className="bg-amber-50 p-5 border-l-4 border-amber-400 text-amber-800 rounded-r-lg mt-6">
              <p className="font-black flex items-center gap-2 m-0 text-amber-900"><Info className="w-5 h-5"/> 重要提醒</p>
              <p className="mt-2 text-sm font-medium">為保護資料安全，專屬邀請碼具備嚴格的時效性（將於整點自動失效歸零）。請於取得邀請碼後，盡速於時限內前往合作平台兌換使用。逾時請重新填寫表單獲取新碼。</p>
            </div>
          </div>
          <button onClick={() => setShowHelpModal(false)} className="w-full py-4 border-2 border-slate-900 bg-emerald-400 text-slate-900 font-black hover:bg-emerald-300 transition-colors shadow-[4px_4px_0_#0F172A] hover:translate-y-1 hover:translate-x-1 hover:shadow-none">
            我都瞭解了，開始填寫
          </button>
        </div>
      </div>
      )}

      {showPrivacyModal && (
      <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white border-4 border-slate-900 p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-[8px_8px_0_#0F172A] relative">
          <button onClick={() => setShowPrivacyModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-slate-100">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-full border-2 border-indigo-200">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">隱私權保護政策</h3>
          </div>
          <div className="space-y-6 text-slate-600 text-sm leading-relaxed mb-8">
            <p className="font-bold text-slate-800">歡迎您使用「全國會考分析系統」（以下簡稱本系統）。為了讓您能夠安心使用本系統的各項服務與資訊，特此向您說明本系統的隱私權保護政策，以保障您的權益，請您詳閱下列內容：</p>
            
            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900">一、隱私權保護政策的適用範圍</h4>
              <p>隱私權保護政策內容，包括本系統如何處理在您使用網站服務時收集到的個人識別與成績資料。隱私權保護政策不適用於本系統以外的相關連結網站，也不適用於非本系統所委託或參與管理的人員。</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900">二、個人資料的蒐集、處理及利用方式</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>當您造訪本系統或使用本系統所提供之功能服務時，我們將視該服務功能性質，請您提供必要的資料（如會考成績、序位區間、聯絡信箱等）。</li>
                <li>本系統所蒐集的資料，<strong>僅供落點估算、巨量數據去識別化統計與教育學術研究分析使用</strong>。</li>
                <li>於一般瀏覽時，伺服器會自行記錄相關行徑，包括您使用連線設備的IP位址、使用時間、使用的瀏覽器、瀏覽及點選資料記錄等，做為我們增進網站服務的參考依據，此記錄為內部應用，決不對外公佈。</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900">三、資料之保護與安全</h4>
              <p>本系統主機均設有防火牆、防毒系統等相關的各項資訊安全設備及必要的安全防護措施，加以保護網站及您的個人資料。只由經過授權的人員才能接觸您的資料，相關處理人員皆簽有保密合約，如有違反保密義務者，將受相關法律處分。</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900">四、與第三人共用個人資料之政策</h4>
              <p>本系統<strong>絕不會</strong>提供、交換、出租或出售任何您的個人資訊給其他個人、團體、私人企業或公務機關，但有法律依據或合約義務者，不在此限。合作的第三方落點分析平台僅會接收到去識別化後的授權代碼，無法直接反查您的原始個資身分。</p>
            </div>
          </div>
          <button onClick={() => setShowPrivacyModal(false)} className="w-full py-4 border-2 border-slate-900 bg-slate-100 font-black text-slate-900 hover:bg-slate-200 transition-colors">
            我已詳閱並同意隱私權政策
          </button>
        </div>
      </div>
      )}

      {showDisclaimerModal && (
      <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white border-4 border-slate-900 p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-[8px_8px_0_#0F172A] relative">
          <button onClick={() => setShowDisclaimerModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors">
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-slate-100">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 flex items-center justify-center rounded-full border-2 border-rose-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">免責聲明</h3>
          </div>
          <div className="space-y-6 text-slate-600 text-sm leading-relaxed mb-8">
            <p className="font-bold text-slate-800 border-l-4 border-rose-400 pl-4 py-1">為了保障您的權益，在使用「全國會考分析系統」服務前，請務必詳細閱讀並同意以下免責聲明條款：</p>
            
            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900">1. 資料來源與結果準確性說明</h4>
              <p>本系統提供之所有落點估算、志願分析與學區數據，皆為開發團隊基於歷年錄取數據、考量少子化趨勢及本年度大數據集結所進行的<strong>統計與推估結果</strong>。本系統與各區免試入學委員會、教育部等官方機構無任何隸屬關係。系統產出之結果「僅供考生與家長參考」，絕不代表最終官方分發、錄取之保證。</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900">2. 使用風險與決策責任承擔</h4>
              <p>選填志願關乎考生的重大升學權益，影響因素包含但不限於招生名額變動、當年考題難易度、考區學生偏好改變等不可控變數。使用者知悉並同意，因參考本系統提供的數據、圖表或建議而做出的任何志願選填決策，其全部風險與最終結果均由使用者自行承擔。開發團隊、平台維運者及其關聯方，對於使用者因此產生的任何直接、間接、附帶或衍生性之損失（包含但不限於落榜、高分低就等），概不負任何法律或賠償責任。</p>
            </div>
            
            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900">3. 服務中斷或系統故障免責</h4>
              <p>本系統會盡最大努力維持穩定運作，但因硬體故障、網路連線問題、第三方服務異常、不可抗力因素（如天災），或例行性維護、資料庫更新等情況，導致系統中斷、資料遺失或延遲時，本團隊不負任何補償或賠償責任。使用者應自行備份重要資料並預留志願選填時間。</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-black text-slate-900">4. 聲明之修改與效力</h4>
              <p>本系統保留隨時修改、更新、暫停或完全終止提供本服務及本免責聲明內容之權利，修改後會於網站公告，不另行個別通知。使用者繼續使用本系統，即代表已瞭解並完全接受修改後的條款與聲明。</p>
            </div>
          </div>
          <button onClick={() => setShowDisclaimerModal(false)} className="w-full py-4 border-2 border-slate-900 bg-rose-50 font-black text-rose-700 hover:bg-rose-100 transition-colors shadow-[4px_4px_0_#0F172A] hover:translate-y-1 hover:translate-x-1 hover:shadow-none">
            我接受並同意本免責聲明
          </button>
        </div>
      </div>
      )}

      {showShareModal && (
      <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white border-4 border-slate-900 p-8 max-w-md w-full shadow-[8px_8px_0_#0F172A] relative text-center">
          <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900">
            <X className="w-6 h-6" />
          </button>
          <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 flex items-center justify-center rounded-full border-2 border-blue-200 mb-4">
            <Share2 className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black tracking-tight mb-2">分享本系統</h3>
          <p className="text-sm font-bold text-slate-500 mb-6">掃描 QRCode 或是複製連結分享給其他人</p>
          
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-white border-4 border-slate-900 rounded-xl inline-block shadow-[4px_4px_0_#0F172A]">
              <QRCodeSVG 
                value={window.location.href}
                size={160}
                bgColor={"#ffffff"}
                fgColor={"#0f172a"}
                level={"M"}
                includeMargin={false}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-2 mb-6">
            <button onClick={() => window.open(`https://line.me/R/msg/text/?${encodeURIComponent('推薦這個落點分析系統！ \n' + window.location.href)}`, '_blank')} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-full border-2 border-slate-900 shadow-[2px_2px_0_#0F172A] bg-[#00b900] flex items-center justify-center text-white transition-all group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_#0F172A]">
                <MessageCircle className="w-5 h-5 fill-current" />
              </div>
              <span className="text-[10px] font-bold text-slate-500">LINE</span>
            </button>
            <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-full border-2 border-slate-900 shadow-[2px_2px_0_#0F172A] bg-[#1877f2] flex items-center justify-center text-white transition-all group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_#0F172A]">
                <Facebook className="w-5 h-5 fill-current" />
              </div>
              <span className="text-[10px] font-bold text-slate-500">Facebook</span>
            </button>
            <button onClick={() => window.open(`https://threads.net/intent/post?text=${encodeURIComponent('推薦這個落點分析系統！ \n' + window.location.href)}`, '_blank')} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-full border-2 border-slate-900 shadow-[2px_2px_0_#0F172A] bg-black flex items-center justify-center text-white transition-all group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_#0F172A]">
                <AtSign className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-500">Threads</span>
            </button>
            <button onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('已複製網址！請前往 Instagram 貼上分享。');
              window.open('https://instagram.com', '_blank');
            }} className="flex flex-col items-center gap-2 group">
              <div className="w-12 h-12 rounded-full border-2 border-slate-900 shadow-[2px_2px_0_#0F172A] bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white transition-all group-hover:-translate-y-1 group-hover:shadow-[4px_4px_0_#0F172A]">
                <Instagram className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-slate-500">Instagram</span>
            </button>
          </div>
          
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('網址已複製！');
            }}
            className="w-full relative group py-3 bg-slate-900 text-white font-black overflow-hidden"
          >
            <div className="absolute inset-0 bg-blue-600 -translate-x-[101%] group-hover:translate-x-0 transition-transform duration-300"></div>
            <span className="relative flex justify-center items-center gap-2">
              <Copy className="w-5 h-5" />
              複製網址連結
            </span>
          </button>
        </div>
      </div>
      )}

      {/* Simplified simple modals to keep size down and focus on new feature */}
      {validationErrors.length > 0 && (
      <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-all">
        <div className="bg-white border-4 border-slate-900 p-8 max-w-sm w-full shadow-[8px_8px_0_#0F172A] relative">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 flex items-center justify-center rounded-full border-2 border-rose-200 mb-4 shadow-[4px_4px_0_#FDA4AF]">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">資料尚未完整</h3>
            <p className="text-sm font-bold text-slate-500 mt-1">請補齊以下必填資訊後再送出</p>
          </div>
          
          <div className="bg-rose-50 p-4 border-2 border-rose-100 rounded-xl mb-6">
            <ul className="space-y-2">
              {validationErrors.map((error, idx) => (
                <li key={idx} className="flex items-start gap-2 text-rose-800 text-sm font-bold">
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <button 
            type="button" 
            onClick={() => setValidationErrors([])} 
            className="w-full py-3 bg-slate-900 text-white font-black hover:bg-slate-800 transition-colors border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
          >
            返回繼續填寫
          </button>
        </div>
      </div>
      )}

    </>
  );
}
