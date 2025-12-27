import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UserFormData, ScoreData } from '../types';
import { FormInput } from './FormInput';
import { FormSelect } from './FormSelect';
import { ArrowRight, Share2, Sparkles, CheckCheck } from './Icons';
import { Captcha, CaptchaHandle } from './Captcha';

interface ApplicationFormProps {
  onSubmit: (data: UserFormData) => void;
  isSubmitting: boolean;
  enableScoreEntry: boolean; 
}

const IDENTITY_OPTIONS = ["國九應屆考生", "八年級學生", "學生家長", "學校教師", "補教業者", "其他"];
const REGION_OPTIONS = ["基北區 (基隆/台北/新北)", "桃連區 (桃園/連江)", "竹苗區 (新竹/苗栗)", "中投區 (台中/南投)", "彰化區", "雲林區", "嘉義區", "台南區", "高雄區", "屏東區", "宜蘭區", "花蓮區", "台東區", "澎湖區", "金門區"];
const SOURCE_OPTIONS = ["Google 搜尋", "Facebook 社團/粉專", "Instagram", "Threads", "親友/同學推薦", "學校/補習班告知", "其他"];
const GRADE_OPTIONS = ["A++", "A+", "A", "B++", "B+", "B", "C"];
const COMPOSITION_OPTIONS = ["6級分", "5級分", "4級分", "3級分", "2級分", "1級分", "0級分"];

export const ApplicationForm: React.FC<ApplicationFormProps> = ({ onSubmit, isSubmitting, enableScoreEntry }) => {
  const [formData, setFormData] = useState<UserFormData>({ email: '', identity: '', region: '', source: '' });

  useEffect(() => {
    const savedData = sessionStorage.getItem('tw_app_form_step1');
    if (savedData) {
      try {
        setFormData(JSON.parse(savedData));
      } catch (e) {
        console.error("Failed to load saved form data", e);
      }
    }
  }, []);

  const [scoreData, setScoreData] = useState<ScoreData>({
    chinese: '', math: '', english: '', social: '', science: '', composition: '',
    rankMinPercent: '', rankMaxPercent: '', rankMin: '', rankMax: ''
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    if (!enableScoreEntry && currentStep === 2) {
      alert("⚠️ 成績填寫開放時間已結束，系統將自動切換回一般申請模式。");
      setCurrentStep(1);
      setDirection('left');
    }
  }, [enableScoreEntry, currentStep]);

  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const captchaRef = useRef<CaptchaHandle>(null);

  const handleBaseChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    sessionStorage.setItem('tw_app_form_step1', JSON.stringify(newData));
  };

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setScoreData(prev => ({ ...prev, [name]: value }));
  };

  const handleCaptchaChange = useCallback((code: string) => {
    setCaptchaToken(code);
  }, []);

  const handleShareApp = async () => {
    const shareData = {
      title: 'TW會考落點分析平台',
      text: '我發現一個免費的會考落點分析工具，可以獲取邀請碼進行預測，推薦給你試試！',
      url: window.location.href
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert("已複製分享連結！");
      }
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  const validateStep1 = () => formData.email && formData.identity && formData.region && formData.source;

  const handleNextStep = () => {
    if (!validateStep1()) {
      alert("請填寫所有必填欄位");
      return;
    }
    setDirection('right');
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setDirection('left');
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCaptchaError('');

    if (captchaInput.trim() !== captchaToken) {
      setCaptchaError('答案錯誤，已更換題目');
      captchaRef.current?.refresh();
      setCaptchaInput('');
      return;
    }

    const defaultScoreData: ScoreData = {
      chinese: '1', math: '1', english: '1', social: '1', science: '1', composition: '1',
      rankMinPercent: '1', rankMaxPercent: '1', rankMin: '1', rankMax: '1'
    };

    const finalData: UserFormData = {
      ...formData,
      scores: enableScoreEntry ? scoreData : defaultScoreData
    };

    onSubmit(finalData);
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="glass-card rounded-[3rem] p-1 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] animate-fade-in-up relative overflow-hidden"
    >
      {/* Top Decoration */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400"></div>

      <div className="px-6 py-10 md:px-12 md:py-14 bg-white/40 rounded-[2.8rem]">
        
        {/* Header & Progress */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
             <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-bold uppercase tracking-wider mb-3">
                   <Sparkles className="w-3.5 h-3.5" />
                   2025 Prediction System
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
                  {currentStep === 1 ? '申請分析邀請碼' : '填寫會考成績'}
                </h2>
             </div>
             
             {/* Progress Bar */}
             <div className="flex items-center gap-2">
                 <div className={`h-2 rounded-full transition-all duration-500 ${currentStep >= 1 ? 'w-8 bg-violet-600' : 'w-2 bg-slate-200'}`}></div>
                 <div className={`h-2 rounded-full transition-all duration-500 ${currentStep >= 2 ? 'w-8 bg-violet-600' : 'w-2 bg-slate-200'}`}></div>
                 <span className="text-xs font-bold text-slate-400 ml-2">STEP {enableScoreEntry ? `0${currentStep}/02` : '01/01'}</span>
             </div>
          </div>
        </div>

        {/* Step 1 Content */}
        {currentStep === 1 && (
          <div className={`space-y-10 ${direction === 'left' ? 'animate-slide-in-left' : 'animate-fade-in'}`}>
            
            {/* New Info Card Design */}
            <div className="bg-gradient-to-br from-violet-50 to-white rounded-3xl p-6 md:p-8 border border-violet-100 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Sparkles className="w-24 h-24 text-violet-600 rotate-12" />
               </div>
               
               <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <span className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">🔔</span>
                 填寫須知
               </h3>
               
               <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-600">
                  <ul className="space-y-3">
                    <li className="flex gap-2">
                       <CheckCheck className="w-5 h-5 text-violet-500 shrink-0" />
                       <span>資料僅用於<strong className="text-slate-800">教育落點分析</strong>，絕無商業用途。</span>
                    </li>
                    <li className="flex gap-2">
                       <CheckCheck className="w-5 h-5 text-violet-500 shrink-0" />
                       <span>申請完成後，系統將即時生成您的<strong className="text-slate-800">專屬邀請碼</strong>。</span>
                    </li>
                    {enableScoreEntry ? (
                        <li className="flex gap-2">
                           <CheckCheck className="w-5 h-5 text-violet-500 shrink-0" />
                           <span>請準備好您的<strong className="text-slate-800">成績單</strong>與<strong className="text-slate-800">序位區間</strong>。</span>
                        </li>
                    ) : (
                        <li className="flex gap-2">
                           <CheckCheck className="w-5 h-5 text-violet-500 shrink-0" />
                           <span>目前尚未開放填寫成績，系統將自動帶入預設值。</span>
                        </li>
                    )}
                  </ul>
                  
                  <div className="bg-white/60 rounded-2xl p-4 border border-violet-50 flex flex-col justify-center space-y-2">
                      <p className="text-xs text-slate-500 font-medium">遇到問題？</p>
                      <div className="flex flex-wrap gap-2 text-xs font-bold">
                         <a href="mailto:tyctw.analyze@gmail.com" className="text-violet-600 hover:underline">聯絡我們</a>
                         <span className="text-slate-300">|</span>
                         <a href="https://tyctw.github.io/report_form" target="_blank" className="text-violet-600 hover:underline">回報問題</a>
                      </div>
                      <button onClick={handleShareApp} type="button" className="mt-2 text-xs flex items-center gap-1.5 text-slate-500 hover:text-violet-600 transition-colors">
                          <Share2 className="w-3.5 h-3.5" /> 分享給朋友
                      </button>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="md:col-span-2">
                <FormInput
                  id="email" name="email" type="email" label="電子郵件"
                  placeholder="請輸入常用信箱 (接收報告用)" required
                  value={formData.email} onChange={handleBaseChange}
                />
              </div>
              <FormSelect
                id="identity" name="identity" label="您的身份"
                placeholder="請選擇身份" required options={IDENTITY_OPTIONS}
                value={formData.identity} onChange={handleBaseChange}
              />
              <FormSelect
                id="region" name="region" label="會考考區"
                placeholder="請選擇考區" required options={REGION_OPTIONS}
                value={formData.region} onChange={handleBaseChange}
              />
              <div className="md:col-span-2">
                <FormSelect
                  id="source" name="source" label="資訊來源"
                  placeholder="您是如何得知我們的？" required options={SOURCE_OPTIONS}
                  value={formData.source} onChange={handleBaseChange}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 Content */}
        {currentStep === 2 && (
          <div className="animate-slide-in-right space-y-10">
            {/* Score Fields */}
            <div className="bg-white/50 p-6 md:p-8 rounded-3xl border border-white shadow-sm ring-1 ring-slate-100">
              <h4 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                 <span className="w-10 h-10 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center font-serif italic text-lg">A+</span>
                 各科等級標示
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                <FormSelect id="chinese" name="chinese" label="國文成績" options={GRADE_OPTIONS} required value={scoreData.chinese} onChange={handleScoreChange} />
                <FormSelect id="math" name="math" label="數學成績" options={GRADE_OPTIONS} required value={scoreData.math} onChange={handleScoreChange} />
                <FormSelect id="english" name="english" label="英文成績" options={GRADE_OPTIONS} required value={scoreData.english} onChange={handleScoreChange} />
                <FormSelect id="social" name="social" label="社會成績" options={GRADE_OPTIONS} required value={scoreData.social} onChange={handleScoreChange} />
                <FormSelect id="science" name="science" label="自然成績" options={GRADE_OPTIONS} required value={scoreData.science} onChange={handleScoreChange} />
                <FormSelect id="composition" name="composition" label="作文成績" options={COMPOSITION_OPTIONS} required value={scoreData.composition} onChange={handleScoreChange} />
              </div>
            </div>

            <div className="bg-white/50 p-6 md:p-8 rounded-3xl border border-white shadow-sm ring-1 ring-slate-100">
              <h4 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                 <span className="w-10 h-10 rounded-full bg-fuchsia-100 text-fuchsia-500 flex items-center justify-center font-bold">#</span>
                 個人序位資訊
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <FormInput id="rankMinPercent" name="rankMinPercent" type="number" label="序位最小比率 (%)" placeholder="例如：1.5" step="0.01" required value={scoreData.rankMinPercent} onChange={handleScoreChange} />
                <FormInput id="rankMaxPercent" name="rankMaxPercent" type="number" label="序位最大比率 (%)" placeholder="例如：2.0" step="0.01" required value={scoreData.rankMaxPercent} onChange={handleScoreChange} />
                <FormInput id="rankMin" name="rankMin" type="number" label="序位最小區間 (人)" placeholder="例如：1000" required value={scoreData.rankMin} onChange={handleScoreChange} />
                <FormInput id="rankMax" name="rankMax" type="number" label="序位最大區間 (人)" placeholder="例如：1200" required value={scoreData.rankMax} onChange={handleScoreChange} />
              </div>
            </div>
          </div>
        )}

        {/* Captcha */}
        {((enableScoreEntry && currentStep === 2) || (!enableScoreEntry && currentStep === 1)) && (
          <div className="mt-8 pt-8 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end animate-fade-in-up">
            <FormInput
              id="captcha" name="captcha" label="安全驗證" placeholder="請輸入右側答案" required
              value={captchaInput} onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(''); }}
              error={captchaError} autoComplete="off"
            />
            <div className="pb-1">
               <label className="block text-[11px] font-extrabold text-slate-500 ml-1 mb-2 uppercase tracking-wider">驗證題目</label>
               <Captcha ref={captchaRef} onCodeChange={handleCaptchaChange} />
            </div>
          </div>
        )}

      </div>

      {/* Footer Action */}
      <div className="bg-slate-50/80 backdrop-blur-md p-6 md:p-8 flex flex-col gap-4 border-t border-white/50">
          {currentStep === 2 && (
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={isSubmitting}
              className="w-full px-8 py-4 rounded-2xl text-slate-500 font-bold text-base hover:bg-white hover:text-slate-800 transition-all duration-300"
            >
              返回上一步
            </button>
          )}

          {enableScoreEntry && currentStep === 1 ? (
             <button
               type="button"
               onClick={handleNextStep}
               className="w-full relative overflow-hidden inline-flex items-center justify-center gap-3 px-10 py-4 rounded-2xl text-white font-bold text-lg tracking-wide bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-xl shadow-violet-300/50 hover:shadow-2xl hover:shadow-violet-400/50 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 ease-out group"
             >
               <span>繼續填寫成績</span>
               <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
             </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                w-full relative overflow-hidden inline-flex items-center justify-center gap-3 px-10 py-4 rounded-2xl text-white font-bold text-lg tracking-wide
                transition-all duration-300 ease-out group
                ${isSubmitting 
                  ? 'bg-slate-300 cursor-wait' 
                  : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-xl shadow-violet-300/50 hover:shadow-2xl hover:shadow-violet-400/50 hover:-translate-y-1 active:translate-y-0'
                }
              `}
            >
              {isSubmitting ? (
                 <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>資料處理中...</span>
                 </div>
              ) : (
                <>
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                  <span>生成專屬邀請碼</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          )}
      </div>
    </form>
  );
};