import React, { useState, useEffect } from 'react';
import { ApplicationForm } from './components/ApplicationForm';
import { ResultCard } from './components/ResultCard';
import { DataLoading } from './components/DataLoading';
import { GraduationCap, Menu, X, ArrowRight, Sparkles } from './components/Icons';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { Support } from './components/Support';
import { AdminPanel } from './components/AdminPanel';
import { Instructions } from './components/Instructions';
import { SystemErrorModal } from './components/SystemErrorModal';
import { UserFormData, InvitationResult, SystemConfig } from './types';
import { fetchInviteCode, getFormattedDate, getExpirationTime, getExpirationTimestamp, fetchSystemConfig } from './services/codeGenerator';

type ViewState = 'home' | 'privacy' | 'terms' | 'support' | 'admin' | 'instructions';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // System Config State
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [isScoreEntryEnabled, setIsScoreEntryEnabled] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    const loadConfig = async () => {
      const config = await fetchSystemConfig();
      setSystemConfig(config);
    };
    loadConfig();
  }, []);

  // Strictly check time window periodically
  useEffect(() => {
    const checkTimeValidity = () => {
        if (!systemConfig?.scoreEntryStart) {
            setIsScoreEntryEnabled(false);
            return;
        }

        const now = new Date();
        const start = new Date(systemConfig.scoreEntryStart);
        const end = systemConfig.scoreEntryEnd ? new Date(systemConfig.scoreEntryEnd) : null;
        
        let isValid = false;
        
        if (!isNaN(start.getTime()) && now >= start) {
            isValid = true;
            if (end && !isNaN(end.getTime()) && now > end) {
                isValid = false;
            }
        }
        
        setIsScoreEntryEnabled(isValid);
    };

    checkTimeValidity();
    const interval = setInterval(checkTimeValidity, 1000);
    return () => clearInterval(interval);
  }, [systemConfig]);

  // Close mobile menu when view changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentView]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const handleSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    const minDelay = new Promise(resolve => setTimeout(resolve, 2500));

    try {
      const codePromise = fetchInviteCode(data);
      const [code] = await Promise.all([codePromise, minDelay]);

      if (!code || typeof code !== 'string') {
        throw new Error("Invalid code generated");
      }

      setResult({
        code,
        generatedAt: getFormattedDate(),
        expiresAt: getExpirationTime(),
        expiresTimestamp: getExpirationTimestamp()
      });
    } catch (error) {
      console.error("Error during submission:", error);
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleReset = () => {
    sessionStorage.removeItem('tw_app_form_step1');
    setResult(null);
  };

  const navigateTo = (view: ViewState) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'instructions':
        return <Instructions />;
      case 'privacy':
        return <PrivacyPolicy />;
      case 'terms':
        return <TermsOfService />;
      case 'support':
        return <Support />;
      case 'admin':
        return <AdminPanel />;
      case 'home':
      default:
        return (
          <>
            <div className="transition-all duration-700 ease-in-out transform">
              {isSubmitting ? (
                <DataLoading />
              ) : result ? (
                <ResultCard result={result} onReset={handleReset} />
              ) : (
                <ApplicationForm 
                  onSubmit={handleSubmit} 
                  isSubmitting={isSubmitting} 
                  enableScoreEntry={isScoreEntryEnabled}
                />
              )}
            </div>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col font-sans text-slate-800 selection:bg-violet-200 selection:text-violet-800 overflow-x-hidden bg-aurora">
      
      {/* System Error Modal */}
      <SystemErrorModal isOpen={showErrorModal} onClose={() => setShowErrorModal(false)} />

      {/* Mobile Menu Drawer */}
      <>
        <div 
          className={`fixed inset-0 z-[60] bg-slate-900/10 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
        
        <div 
          className={`fixed inset-y-0 right-0 z-[70] w-full max-w-[280px] bg-white/90 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-out md:hidden flex flex-col border-l border-white/50 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="p-6 border-b border-slate-100/50 flex items-center justify-between">
             <span className="font-black text-lg text-slate-800 tracking-tight">功能選單</span>
             <button 
               onClick={() => setIsMobileMenuOpen(false)} 
               className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 rounded-full transition-colors"
             >
               <X className="w-6 h-6" />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-6 px-4">
             <nav className="flex flex-col gap-2">
                <button onClick={() => navigateTo('home')} className={`w-full text-left px-4 py-3 rounded-2xl font-bold transition-all ${currentView === 'home' ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>首頁</button>
                <button onClick={() => navigateTo('instructions')} className={`w-full text-left px-4 py-3 rounded-2xl font-bold transition-all ${currentView === 'instructions' ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>使用說明</button>
                <button onClick={() => navigateTo('support')} className={`w-full text-left px-4 py-3 rounded-2xl font-bold transition-all ${currentView === 'support' ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>支援中心</button>
                <button onClick={() => navigateTo('privacy')} className={`w-full text-left px-4 py-3 rounded-2xl font-bold transition-all ${currentView === 'privacy' ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>隱私權政策</button>
                <button onClick={() => navigateTo('admin')} className={`w-full text-left px-4 py-3 rounded-2xl font-bold transition-all ${currentView === 'admin' ? 'bg-violet-50 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}>管理員後台</button>
             </nav>
          </div>

          <div className="p-6">
             <button 
               onClick={() => navigateTo('home')}
               className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl font-bold shadow-lg shadow-violet-200 active:scale-95 transition-all flex items-center justify-center gap-2"
             >
               <Sparkles className="w-4 h-4" />
               <span>獲取邀請碼</span>
             </button>
          </div>
        </div>
      </>

      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-violet-300/30 rounded-full blur-[120px] mix-blend-multiply animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-fuchsia-200/30 rounded-full blur-[100px] mix-blend-multiply animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] bg-cyan-200/30 rounded-full blur-[100px] mix-blend-multiply animate-float" style={{ animationDelay: '4s' }}></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay"></div>
      </div>

      {/* Floating Pill Header */}
      <div className="sticky top-6 z-50 flex justify-center px-4 mb-4 md:mb-8">
          <header className="glass-card rounded-full px-2 py-2 pr-3 md:px-4 md:py-3 md:pr-4 flex items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.04)] w-full max-w-4xl transition-all hover:shadow-[0_8px_40px_rgba(124,58,237,0.1)]">
            <button 
                onClick={() => navigateTo('home')}
                className="flex items-center gap-3 group cursor-pointer focus:outline-none pl-2"
            >
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-tr from-violet-600 to-fuchsia-500 rounded-full flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform duration-300">
                   <GraduationCap className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="flex flex-col text-left">
                    <span className="font-black text-lg text-slate-800 tracking-tight leading-none group-hover:text-violet-600 transition-colors">TW會考</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">落點分析系統</span>
                </div>
            </button>
            
            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center bg-slate-100/50 rounded-full p-1.5 border border-slate-200/50 backdrop-blur-sm mx-4">
                <button onClick={() => navigateTo('home')} className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${currentView === 'home' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>首頁</button>
                <button onClick={() => navigateTo('instructions')} className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${currentView === 'instructions' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>說明</button>
                <button onClick={() => navigateTo('support')} className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${currentView === 'support' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>支援</button>
            </nav>

            <div className="flex items-center gap-2">
                 <button 
                    onClick={() => navigateTo('home')}
                    className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-full hover:bg-violet-600 hover:shadow-lg hover:shadow-violet-500/20 transition-all duration-300 transform font-bold text-sm"
                    >
                    <span>獲取邀請碼</span>
                    <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                    className="md:hidden p-2.5 text-slate-600 hover:bg-slate-100 rounded-full transition-colors active:scale-95"
                    onClick={() => setIsMobileMenuOpen(true)}
                >
                    <Menu className="w-6 h-6" />
                </button>
            </div>
          </header>
      </div>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 sm:px-6 py-4 md:py-8 lg:py-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="mt-auto py-8 text-center relative z-10">
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center">
             <div className="flex items-center gap-6 mb-4">
                <button onClick={() => navigateTo('privacy')} className="text-xs text-slate-500 hover:text-violet-600 font-bold transition-colors">隱私權政策</button>
                <button onClick={() => navigateTo('terms')} className="text-xs text-slate-500 hover:text-violet-600 font-bold transition-colors">服務條款</button>
                <button onClick={() => navigateTo('admin')} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">管理員登入</button>
             </div>
             <p className="text-[10px] text-slate-400 font-medium">
                &copy; {new Date().getFullYear()} TW會考落點分析平台. All Rights Reserved.
             </p>
        </div>
      </footer>
    </div>
  );
};

export default App;