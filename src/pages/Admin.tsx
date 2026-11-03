import { getExamYears, formatTaipeiTime, announcementForYear } from '../utils/surveyTime';
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Link, useBlocker } from 'react-router-dom';
import { DEFAULT_ANNOUNCEMENT, taipeiInput, taipeiISO, toSettingsDraft, settingsPayload, settingsDiff, settingsIssues, type SettingsDraft } from '../utils/adminSettings';
import { EXPORT_FIELDS, exportCsvRow, type ExportField } from '../utils/adminExport';
import { toCsvCell } from '../utils/spreadsheet';
import { parseSurveyConfig } from '../utils/surveyConfig';
import { EMPTY_ADMIN_FILTERS, EMPTY_ADMIN_STATS, validateAdminFilters, type AdminFilters, type AdminStats, type SurveyKind } from '../utils/adminSurvey';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Lock, LayoutDashboard, Users, MapPin, Loader2, Download, Table, ClipboardList, Calendar, LogOut, ArrowUpDown, ArrowUp, ArrowDown, Eye, X, ExternalLink, Settings } from 'lucide-react';
import { Header } from '../components/Header';
import { ShareDialog } from '../components/ShareDialog';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const DEFAULT_ANNOUNCEMENT_CONTENT = DEFAULT_ANNOUNCEMENT;

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pageRows, setPageRows] = useState<any[]>([]);
  const [pageTotal, setPageTotal] = useState(0);
  const [stats, setStats] = useState<AdminStats>(EMPTY_ADMIN_STATS);
  const [statsLoading, setStatsLoading] = useState(false);
  const [queryError, setQueryError] = useState('');
  const [draftFilters, setDraftFilters] = useState<AdminFilters>({ ...EMPTY_ADMIN_FILTERS });
  const [filters, setFilters] = useState<AdminFilters>({ ...EMPTY_ADMIN_FILTERS });
  const [filterError, setFilterError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const exportController = useRef<AbortController | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'full' | 'skip' | 'settings' | 'backups' | 'logs'>('overview');

  // Settings State
  const [announcementDate, setAnnouncementDate] = useState('');
  const [announcementPreviewYear, setAnnouncementPreviewYear] = useState(getExamYears()[0]);
  const [announcementContent, setAnnouncementContent] = useState(DEFAULT_ANNOUNCEMENT_CONTENT);
  const [customQuestions, setCustomQuestions] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [showBackupPreview, setShowBackupPreview] = useState<any | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [baseline, setBaseline] = useState<SettingsDraft | null>(null);
  const [configVersion, setConfigVersion] = useState<{ id: number | null; revision: number | null }>({ id: null, revision: null });
  const [remoteConfig, setRemoteConfig] = useState<{ current: any } | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [includePersonal, setIncludePersonal] = useState(false);
  const [exportFields, setExportFields] = useState<ExportField[]>(EXPORT_FIELDS.map(([key]) => key));
  const [subjectScoreStartTime, setSubjectScoreStartTime] = useState('');
  const [subjectScoreEndTime, setSubjectScoreEndTime] = useState('');
  const [subjectScoreEnabled, setSubjectScoreEnabled] = useState(true);
  const [systemStartTime, setSystemStartTime] = useState('');
  const [systemEndTime, setSystemEndTime] = useState('');
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  
  // Preview Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});

  // Table view state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const draft: SettingsDraft = {
    announcement_date: announcementDate, announcement_content: announcementContent, custom_questions: customQuestions,
    subject_score_start_time: subjectScoreStartTime, subject_score_end_time: subjectScoreEndTime,
    subject_score_enabled: subjectScoreEnabled, system_start_time: systemStartTime, system_end_time: systemEndTime, system_enabled: systemEnabled,
  };
  const announcementPreview = announcementForYear(announcementContent, announcementPreviewYear, getExamYears()[0], taipeiISO(announcementDate));
  const changes = baseline ? settingsDiff(baseline, draft) : [];
  if (baseline && configVersion.id === null) changes.unshift({ label: '設定建立', before: '尚未設定', after: '建立表單設定' });
  const dirty = baseline !== null && changes.length > 0;
  const issues = settingsIssues(draft);
  const blocker = useBlocker(dirty);

  useEffect(() => { if (dirty) setMessage(''); }, [dirty]);

  useEffect(() => {
    if (!showSaveConfirm && !showExportModal) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const dialog = document.querySelector<HTMLElement>('[data-admin-modal]');
    dialog?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        if (showExportModal) { exportController.current?.abort(); setShowExportModal(false); }
        else setShowSaveConfirm(false);
      }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [showSaveConfirm, showExportModal, saving]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('尚有未儲存的設定，離開將捨棄草稿。確定離開？')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!isAuthenticated || !baseline || !supabase) return;
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      const { data, error } = await supabase.from('survey_config').select('id,revision').order('id').limit(1).maybeSingle();
      if (cancelled || error) return;
      if ((data?.id ?? null) !== configVersion.id || (data?.revision ?? null) !== configVersion.revision) {
        const latest = await supabase.from('survey_config').select('*').order('id').limit(1).maybeSingle();
        if (!cancelled && !latest.error) setRemoteConfig({ current: latest.data });
      }
    };
    const interval = window.setInterval(check, 30000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [isAuthenticated, baseline, configVersion]);

  useEffect(() => () => exportController.current?.abort(), []);

  useEffect(() => {
    if (!isAuthenticated || !supabase) return;
    const controller = new AbortController();
    setStatsLoading(true);
    setStats(EMPTY_ADMIN_STATS);
    setQueryError('');
    (async () => {
      try {
        const { data, error } = await supabase.rpc('admin_survey_stats', { p_filters: filters }).abortSignal(controller.signal);
        if (controller.signal.aborted) return;
        if (error) throw error;
        setStats({ ...EMPTY_ADMIN_STATS, ...data } as AdminStats);
      } catch {
        if (!controller.signal.aborted) setQueryError('無法載入統計，請重試或聯絡系統管理者。');
      } finally {
        if (!controller.signal.aborted) setStatsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [isAuthenticated, filters, reloadKey]);

  useEffect(() => {
    if (!isAuthenticated || !supabase || (activeTab !== 'full' && activeTab !== 'skip')) return;
    const controller = new AbortController();
    setLoading(true);
    setPageRows([]);
    setPageTotal(0);
    setQueryError('');
    (async () => {
      try {
        const { data, error } = await supabase.rpc('admin_survey_page', {
          p_filters: filters, p_kind: activeTab, p_offset: (currentPage - 1) * rowsPerPage,
          p_limit: rowsPerPage, p_sort: sortConfig?.key || 'timestamp',
          p_ascending: sortConfig?.direction === 'asc',
        }).abortSignal(controller.signal);
        if (controller.signal.aborted) return;
        if (error) throw error;
        const total = Number(data.total);
        const lastPage = Math.max(1, Math.ceil(total / rowsPerPage));
        if (currentPage > lastPage) { setCurrentPage(lastPage); return; }
        setPageRows(data.rows);
        setPageTotal(total);
      } catch {
        if (!controller.signal.aborted) setQueryError('無法載入填答資料，請重試或聯絡系統管理者。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [isAuthenticated, filters, activeTab, currentPage, rowsPerPage, sortConfig, reloadKey]);

  const applyFilters = (next: AdminFilters) => {
    const invalid = validateAdminFilters(next);
    setFilterError(invalid || '');
    if (invalid) return;
    setPageRows([]);
    setPageTotal(0);
    setStats(EMPTY_ADMIN_STATS);
    setFilters({ ...next, search: next.search.trim() });
    setCurrentPage(1);
    if (next.ranking !== 'all' && (activeTab === 'full' || activeTab === 'skip')) setActiveTab(next.ranking);
  };

  useEffect(() => {
    const restoreAdminSession = async () => {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (!isAdmin) {
        await supabase.auth.signOut();
        return;
      }

      setIsAuthenticated(true);
      fetchSettings();
      fetchLogs();
    };

    restoreAdminSession();
  }, []);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setCurrentPage(1);
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50 inline" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 inline text-slate-900" /> : <ArrowDown className="w-4 h-4 ml-1 inline text-slate-900" />;
  };

  const fetchLogs = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('admin_logs').select('*').order('login_time', { ascending: false }).limit(100);
      if (error) throw error;
      if (data) setAdminLogs(data);
    } catch (e) {
      setAdminLogs([]);
      setError('無法讀取登入紀錄，請確認管理權限與日誌設定。');
      console.error(e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('尚未設定安全的 Supabase 連線，無法登入管理介面。');
      return;
    }

    try {
      setError('');
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin');
      if (roleError || !isAdmin) {
        await supabase.auth.signOut();
        throw new Error('此帳號沒有管理員權限');
      }

      setIsAuthenticated(true);
      fetchSettings();
      fetchLogs();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '登入失敗，請確認帳號、密碼與權限。');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newPassword) return;
    if (newPassword.length < 12) {
      alert('密碼長度需至少 12 個字元');
      return;
    }
    
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPassword(newPassword);
      setNewPassword('');
      alert('密碼修改成功');
    } catch (err: any) {
      alert('修改失敗: ' + err.message);
    }
  };

  const formatDateTimeLocal = taipeiInput;
  const loadDraft = (next: SettingsDraft) => {
    setAnnouncementDate(next.announcement_date);
    setAnnouncementContent(next.announcement_content);
    setCustomQuestions(next.custom_questions);
    setSubjectScoreStartTime(next.subject_score_start_time);
    setSubjectScoreEndTime(next.subject_score_end_time);
    setSubjectScoreEnabled(next.subject_score_enabled);
    setSystemStartTime(next.system_start_time);
    setSystemEndTime(next.system_end_time);
    setSystemEnabled(next.system_enabled);
  };
  const acceptConfig = (raw: any, preserveDraft = false) => {
    const next = toSettingsDraft(raw ? parseSurveyConfig(raw) : null);
    setBaseline(next);
    setConfigVersion({ id: raw?.id ?? null, revision: raw?.revision ?? null });
    setBackups(raw?.custom_questions?.find((q: any) => q.id === '__SYSTEM_BACKUPS__')?.data || []);
    if (!preserveDraft) loadDraft(next);
    setRemoteConfig(null);
    setSettingsError('');
  };
  const fetchSettings = async () => {
    if (!supabase) return;
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase.from('survey_config').select('*').order('id').limit(1).maybeSingle();
      if (error || (data && typeof data.revision !== 'number')) throw error || new Error('Missing settings version');
      acceptConfig(data);
    } catch {
      setSettingsError('無法載入可編輯的設定，請重試或聯絡系統管理者。');
    } finally { setSettingsLoading(false); }
  };
  const preparePublish = async () => {
    if (!baseline || saving || issues.errors.length) return;
    setSettingsError('');
    // Give an early warning; the publish RPC still compares revisions atomically.
    const latest = await supabase.from('survey_config').select('*').order('id').limit(1).maybeSingle();
    if (latest.error) { setSettingsError('無法確認線上版本，請稍後重試。'); return; }
    if ((latest.data?.id ?? null) !== configVersion.id || (latest.data?.revision ?? null) !== configVersion.revision) {
      setRemoteConfig({ current: latest.data });
    }
    setShowSaveConfirm(true);
  };
  const saveSettings = async () => {
    if (!baseline || saving || !dirty || issues.errors.length || remoteConfig) return;
    setSaving(true);
    setSettingsError('');
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('publish_survey_config', {
        p_id: configVersion.id, p_revision: configVersion.revision, p_settings: settingsPayload(draft),
      });
      if (error) throw error;
      if (data.status === 'conflict') { setRemoteConfig({ current: data.current }); return; }
      if (data.status !== 'saved') throw new Error('Unexpected publish response');
      acceptConfig(data.current);
      setShowSaveConfirm(false);
      setMessage('設定已成功發布。');
      fetchData();
    } catch (err: any) {
      setSettingsError(err?.code === '22023' ? err.message : '發布失敗，請重試或聯絡系統管理者。');
    } finally { setSaving(false); }
  };

  const addCustomQuestion = () => {
    setCustomQuestions([...customQuestions, { id: 'q_' + Date.now(), type: 'text', question: '', options: [], required: false }]);
  };

  const updateQuestion = (id: string, updates: any) => {
    setCustomQuestions(customQuestions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQuestion = (id: string) => {
    setCustomQuestions(customQuestions.filter(q => q.id !== id));
  };

  const handlePreviewAnswerChange = (questionId: string, value: any, type: string) => {
    setPreviewAnswers(prev => {
      const next = { ...prev };
      if (type === 'checkbox') {
        const current = next[questionId] || [];
        if (current.includes(value)) {
          next[questionId] = current.filter((v: string) => v !== value);
        } else {
          next[questionId] = [...current, value];
        }
      } else {
        next[questionId] = value;
      }
      return next;
    });
  };

  const formatCustomAnswers = (answers: unknown) => {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return '';

    return Object.entries(answers as Record<string, unknown>)
      .filter(([questionId, answer]) => questionId !== '__question_labels' && answer !== undefined && answer !== null && answer !== '')
      .map(([questionId, answer]) => {
        const question = customQuestions.find(q => q.id === questionId);
        const label = question?.question?.trim() || `已移除題目（${questionId}）`;
        const value = Array.isArray(answer) ? answer.join('、') : String(answer);
        return `${label}：${value}`;
      })
      .join('\n');
  };

  const fetchData = () => setReloadKey(key => key + 1);

  const exportToCSV = async (exportType: SurveyKind) => {
    if (!supabase || exporting || exportFields.length === 0) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportProgress(0);
    setQueryError('');
    const capturedFilters = { ...filters };
    const target = { label: { full: '完整填寫資料', skip: '無序位填寫資料', all: '全部資料' }[exportType] };
    try {
      const selectedFields = EXPORT_FIELDS.filter(([key]) => exportFields.includes(key));
      const headers = selectedFields.map(([, label]) => label);
      const generateRow = (row: any) => exportCsvRow(row, selectedFields.map(([key]) => key), includePersonal, formatCustomAnswers);

      // Only an explicit export downloads matching rows; normal navigation fetches one page.
      const chunks: BlobPart[] = ['\uFEFF' + headers.map(toCsvCell).join(',')];
      let exported = 0;
      let afterSource = '';
      let afterId = 0;
      let fullMax: number | null = null;
      let skipMax: number | null = null;
      while (true) {
        const { data, error } = await supabase.rpc('admin_survey_export_selected', {
          p_filters: capturedFilters, p_kind: exportType, p_after_source: afterSource,
          p_after_id: afterId, p_full_max: fullMax, p_skip_max: skipMax,
          p_fields: selectedFields.map(([key]) => key), p_include_personal: includePersonal,
        }).abortSignal(controller.signal);
        if (controller.signal.aborted) return;
        if (error) throw error;
        fullMax = data.fullMax;
        skipMax = data.skipMax;
        if (!data.rows.length) break;
        chunks.push('\n' + data.rows.map(generateRow).join('\n'));
        exported += data.rows.length;
        setExportProgress(exported);
        const last = data.rows[data.rows.length - 1];
        afterSource = last._source;
        afterId = last.id;
      }
      if (!exported) { setQueryError('目前篩選條件沒有可匯出的資料。'); return; }
      const blob = new Blob(chunks, { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `會考落點分析_${target.label}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setShowExportModal(false);
    } catch {
      if (!controller.signal.aborted) setQueryError('匯出失敗，請重試；未產生不完整的下載檔案。');
    } finally {
      if (exportController.current === controller) {
        exportController.current = null;
        setExporting(false);
      }
    }
  };

  const handleLogout = () => {
    if (dirty && !window.confirm('尚有未儲存的設定，確定捨棄草稿並登出？')) return;
    exportController.current?.abort();
    supabase?.auth.signOut();
    setIsAuthenticated(false);
    setBaseline(null);
    setRemoteConfig(null);
    setPageRows([]);
    setPageTotal(0);
    setStats(EMPTY_ADMIN_STATS);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[100dvh] bg-slate-100 font-sans flex flex-col relative w-full pt-16 sm:pt-24 pb-12">
        <Header onShareClick={() => setIsShareOpen(true)} />
        <div className="flex-1 w-full flex flex-col items-center justify-center p-4 mx-auto my-auto mt-8 sm:mt-16">
          <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_#0F172A] p-6 sm:p-8 max-w-sm w-full animate-in fade-in zoom-in relative z-10">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-slate-900 flex items-center justify-center rounded-full text-white">
                <Lock className="w-8 h-8" />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-center mb-6">系統管理員登入</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="管理員 Email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border-2 border-slate-300 p-3 font-bold focus:border-slate-900 focus:outline-none text-sm sm:text-base"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="管理員密碼"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border-2 border-slate-300 p-3 font-bold focus:border-slate-900 focus:outline-none text-sm sm:text-base"
                  autoComplete="current-password"
                  minLength={12}
                  required
                />
              </div>
              {error && <p className="text-red-500 font-bold text-sm tracking-wide">{error}</p>}
              <button type="submit" className="w-full bg-emerald-400 border-2 border-slate-900 py-3 font-black text-slate-900 shadow-[4px_4px_0_#0F172A] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                登入系統
              </button>
            </form>
          </div>
          <div className="mt-8 text-slate-500 text-xs font-bold tracking-widest relative z-10 flex flex-col items-center gap-2">
            <p>&copy; {new Date().getFullYear()} 全國會考分析系統 版權所有</p>
          </div>
          <ShareDialog open={isShareOpen} onClose={() => setIsShareOpen(false)} url={`${window.location.origin}${window.location.pathname}#/`} />
        </div>
      </div>
    );
  }

  const regionChartData = stats.regions;
  const identityChartData = stats.identities;
  const totalScoreChartData = stats.scores;
  const dailyTrendData = stats.days;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header onShareClick={() => setIsShareOpen(true)} />
      <div className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div><h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-slate-900">
            <LayoutDashboard className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            管理員分析看板
          </h1><Link to="/" className="mt-2 inline-block text-sm underline text-slate-600">返回首頁</Link></div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4 w-full sm:w-auto whitespace-nowrap">
            <button 
              onClick={() => window.open(window.location.pathname + '#/', '_blank')}
              className="flex-1 sm:flex-none px-4 py-2 border-2 border-slate-900 bg-sky-200 font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none transition-all text-slate-900"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="hidden sm:inline">檢視前台</span>
              <span className="sm:hidden">前台</span>
            </button>
            <button 
              onClick={() => { setIncludePersonal(false); setShowExportModal(true); }}
              disabled={statsLoading || stats.total === 0 || exporting}
              className="flex-1 sm:flex-none px-4 py-2 border-2 border-slate-900 bg-emerald-400 font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">匯出 CSV</span>
              <span className="sm:hidden">匯出</span>
            </button>
            <button 
              onClick={fetchData} 
              className="flex-1 sm:flex-none px-4 py-2 border-2 border-slate-900 bg-white font-bold hover:bg-slate-100 flex items-center justify-center gap-2 shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              {loading || statsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '重新載入'}
            </button>
            <button 
              onClick={handleLogout} 
              className="flex-1 sm:flex-none px-4 py-2 border-2 border-slate-900 bg-rose-400 font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none transition-all text-slate-900"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className="hidden sm:inline">登出系統</span>
              <span className="sm:hidden">登出</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 border-2 border-red-500 font-bold mb-6 flex flex-col sm:flex-row">
            <span>{error}</span>

          </div>
        )}

        {message && (
          <div className="bg-emerald-50 text-emerald-800 p-4 border-2 border-emerald-500 font-bold mb-6">
            {message}
          </div>
        )}

        {dirty && <div role="status" className="mb-4 border-2 border-amber-400 bg-amber-50 p-4 font-bold text-amber-900">有 {changes.length} 項未儲存變更；切換管理分頁會保留草稿，發布後才會生效。</div>}
        {settingsError && <div role="alert" className="mb-4 bg-red-50 p-4 text-red-700">{settingsError} {!baseline && <button onClick={fetchSettings} className="underline">重新載入設定</button>}</div>}
        {remoteConfig && !showSaveConfirm && <div role="alert" className="mb-4 border-2 border-amber-400 p-4">線上設定已有新版本，可能來自其他管理員或分頁。您的草稿仍保留。<button onClick={() => setShowSaveConfirm(true)} className="ml-3 underline font-bold">比較最新版本</button></div>}

        <form onSubmit={event => { event.preventDefault(); applyFilters(draftFilters); }} className="mb-6 border-2 border-slate-300 bg-white p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-black text-lg">資料篩選</h2>
            <span className="text-sm text-slate-500" role="status">{statsLoading ? '統計載入中…' : `符合條件 ${stats.total} 筆`}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {([
              ['examYear', '會考年度', stats.years],
              ['region', '招生區', stats.regionOptions],
              ['identity', '身分', stats.identityOptions],
            ] as const).map(([key, label, options]) => (
              <label key={key} className="text-sm font-bold">{label}
                <select aria-label={label} value={draftFilters[key]} onChange={event => setDraftFilters(prev => ({ ...prev, [key]: event.target.value }))} className="mt-1 w-full border-2 border-slate-300 p-2 bg-white">
                  <option value="">全部</option>
                  {Array.from(new Set([...options, draftFilters[key]].filter(Boolean))).map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            ))}
            <label className="text-sm font-bold">序位資料
              <select aria-label="序位資料" value={draftFilters.ranking} onChange={event => setDraftFilters(prev => ({ ...prev, ranking: event.target.value as SurveyKind }))} className="mt-1 w-full border-2 border-slate-300 p-2 bg-white">
                <option value="all">全部</option><option value="full">有提供序位</option><option value="skip">未提供序位</option>
              </select>
            </label>
            <label className="text-sm font-bold">開始日期（台北時間）
              <input type="date" value={draftFilters.startDate} onChange={event => setDraftFilters(prev => ({ ...prev, startDate: event.target.value }))} className="mt-1 w-full border-2 border-slate-300 p-2" />
            </label>
            <label className="text-sm font-bold">結束日期（包含當日）
              <input type="date" value={draftFilters.endDate} onChange={event => setDraftFilters(prev => ({ ...prev, endDate: event.target.value }))} className="mt-1 w-full border-2 border-slate-300 p-2" />
            </label>
            <label className="text-sm font-bold sm:col-span-2">關鍵字
              <input type="search" placeholder="搜尋 Email、成績或自訂回答…" value={draftFilters.search} onChange={event => setDraftFilters(prev => ({ ...prev, search: event.target.value }))} className="mt-1 w-full border-2 border-slate-300 p-2" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" className="border-2 border-slate-900 bg-emerald-300 px-4 py-2 font-bold">套用篩選</button>
            <button type="button" onClick={() => { setDraftFilters({ ...EMPTY_ADMIN_FILTERS }); applyFilters({ ...EMPTY_ADMIN_FILTERS }); }} className="border-2 border-slate-300 px-4 py-2 font-bold">清除篩選</button>
            <span className="text-xs text-slate-500">圖表、資料列表與匯出共用篩選；列表分頁另依所選資料類別顯示。</span>
          </div>
          {JSON.stringify(draftFilters) !== JSON.stringify(filters) && <p className="mt-3 text-sm text-amber-700">篩選條件已變更，按「套用篩選」後生效。</p>}
          {filterError && <p role="alert" className="mt-3 text-red-700">{filterError}</p>}
        </form>
        {queryError && <div role="alert" className="mb-6 border-2 border-red-400 bg-red-50 p-4 text-red-700">{queryError} <button type="button" onClick={fetchData} className="underline font-bold">重試</button></div>}

        <div className="flex border-b-2 border-slate-300 mb-8 overflow-x-auto whitespace-nowrap">
          {[
            { id: 'overview', label: '分析圖表' },
            { id: 'full', label: '完整填寫資料' },
            { id: 'skip', label: '無序位填寫資料' },
            { id: 'settings', label: '系統設定與自訂問卷' },
            { id: 'backups', label: '系統版本備份紀錄' },
            { id: 'logs', label: '系統安全與日誌' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { if (activeTab !== tab.id) { setActiveTab(tab.id as any); setCurrentPage(1); setPageRows([]); } }}
              className={`px-6 py-3 font-bold text-sm sm:text-base border-b-4 transition-colors ${activeTab === tab.id ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="mb-6 border-2 border-slate-300 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-sm text-slate-500">目前線上表單狀態（依已發布設定）</p><p className="font-black text-xl">{statsLoading ? '載入中…' : ({open:'開放填寫',closed:'已關閉',scheduled:'尚未開始',ended:'已結束',missing:'尚未設定'} as Record<string,string>)[stats.formStatus.state] || '無法確認'}</p></div>
              <div className="text-xs text-slate-500">{stats.formStatus.start && <p>開始：{taipeiInput(stats.formStatus.start).replace('T',' ')}</p>}{stats.formStatus.end && <p>結束：{taipeiInput(stats.formStatus.end).replace('T',' ')}</p>}{stats.formStatus.checkedAt && <p>更新：{taipeiInput(stats.formStatus.checkedAt).replace('T',' ')}</p>}<p>台北時間；重新載入可更新狀態。</p></div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {([['符合條件樣本',stats.total],['今日新增',stats.today],['有效樣本',stats.valid],['提供序位',stats.full]] as const).map(([label,value]) => <div key={label} className="bg-white border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] p-4 sm:p-6"><p className="text-slate-500 font-bold text-sm mb-2">{label}</p><p className="text-3xl sm:text-4xl font-black">{statsLoading ? '…' : value}</p></div>)}
            </div>
            <p className="mb-6 text-xs text-slate-500">有效樣本：五科成績完整且選項有效；有提供序位者，序位與比率區間也須合法。此數字不代表已驗證填答真實性。所有數量均套用目前篩選。</p>
            <div className="mb-8 border-2 border-slate-900 bg-white p-4 sm:p-6">
              <h3 className="font-bold text-lg mb-4">近七日填寫趨勢</h3>
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.recentDays}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{fontSize:11}} /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="count" name="新增筆數" stroke="#059669" fill="#A7F3D0" /></AreaChart></ResponsiveContainer></div>
              <p className="text-xs text-slate-500 mt-2">含今日的七個台北日期，無填答日顯示 0；同樣套用目前篩選。</p>
            </div>

            <div className="mb-6 flex flex-wrap gap-2" aria-label="各區樣本數">{stats.regions.map(region => <span key={region.name} className="border border-slate-300 bg-white px-3 py-2 text-sm">{region.name}：<strong>{region.count}</strong> 筆</span>)}</div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div className="bg-white border-2 border-slate-900 p-4 sm:p-6 shadow-[4px_4px_0_#0F172A]">
                <h3 className="text-lg sm:text-xl font-bold mb-6 flex items-center pb-2 border-b-2 border-slate-100">
                  <MapPin className="w-5 h-5 mr-2 text-rose-500" />
                  各區樣本量
                </h3>
                <div className="h-64 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 'bold'}} interval={0} angle={-(window.innerWidth < 640 ? 45 : 0)} textAnchor={window.innerWidth < 640 ? "end" : "middle"} height={window.innerWidth < 640 ? 60 : 30} />
                      <YAxis tick={{fontSize: 11, fontWeight: 'bold'}} allowDecimals={false} />
                      <Tooltip wrapperStyle={{ fontWeight: 'bold' }} />
                      <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="填寫人數" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border-2 border-slate-900 p-4 sm:p-6 shadow-[4px_4px_0_#0F172A]">
                <h3 className="text-lg sm:text-xl font-bold mb-6 flex items-center pb-2 border-b-2 border-slate-100">
                  <Users className="w-5 h-5 mr-2 text-emerald-500" />
                  填寫者身分比例
                </h3>
                <div className="h-64 sm:h-80 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={identityChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={window.innerWidth < 640 ? 80 : 100}
                        fill="#8884d8"
                        dataKey="count"
                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={window.innerWidth >= 640}
                      >
                        {identityChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip wrapperStyle={{ fontWeight: 'bold' }} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div className="bg-white border-2 border-slate-900 p-4 sm:p-6 shadow-[4px_4px_0_#0F172A]">
                <h3 className="text-lg sm:text-xl font-bold mb-6 flex items-center pb-2 border-b-2 border-slate-100">
                  <ClipboardList className="w-5 h-5 mr-2 text-indigo-500" />
                  會考總積分分佈
                </h3>
                <div className="h-64 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={totalScoreChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 'bold'}} interval={0} angle={-(window.innerWidth < 640 ? 45 : 0)} textAnchor={window.innerWidth < 640 ? "end" : "middle"} height={window.innerWidth < 640 ? 60 : 30} />
                      <YAxis tick={{fontSize: 11, fontWeight: 'bold'}} allowDecimals={false} />
                      <Tooltip wrapperStyle={{ fontWeight: 'bold' }} />
                      <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="人數" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border-2 border-slate-900 p-4 sm:p-6 shadow-[4px_4px_0_#0F172A]">
                <h3 className="text-lg sm:text-xl font-bold mb-6 flex items-center pb-2 border-b-2 border-slate-100">
                  <Calendar className="w-5 h-5 mr-2 text-amber-500" />
                  每日填寫趨勢
                </h3>
                <div className="h-64 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{fontSize: 11, fontWeight: 'bold'}} />
                      <YAxis tick={{fontSize: 11, fontWeight: 'bold'}} allowDecimals={false} />
                      <Tooltip wrapperStyle={{ fontWeight: 'bold' }} />
                      <Area type="monotone" dataKey="count" stroke="#F59E0B" fill="#FDE68A" name="填寫人數" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {(activeTab === 'full' || activeTab === 'skip') && (
          <div className="bg-white border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] overflow-hidden mb-12">
            <div className="p-4 sm:p-6 border-b-2 border-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <Table className="w-6 h-6 text-slate-900" />
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  {activeTab === 'full' ? '完整填寫資料 (含序位)' : '無序位填寫資料 (未提供序位區間)'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="每頁筆數"
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="border-2 border-slate-300 px-2 py-1 text-sm focus:border-slate-900 focus:outline-none bg-white"
                >
                  <option value={10}>10 筆/頁</option>
                  <option value={50}>50 筆/頁</option>
                  <option value={100}>100 筆/頁</option>
                </select>
              </div>
            </div>
            
            {(() => {
              const totalPages = Math.max(1, Math.ceil(pageTotal / rowsPerPage));
              const startIndex = (currentPage - 1) * rowsPerPage;
              const paginatedData = pageRows;

              return (
                <>
                  <div className="overflow-x-auto w-full">
                    <table className="min-w-full text-left text-sm whitespace-nowrap select-none">
                      <thead className="bg-slate-100 border-b-2 border-slate-900 font-bold uppercase tracking-wider text-slate-600">
                        <tr>
                          <th scope="col" className="px-6 py-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('timestamp')}>
                            填寫時間 {renderSortIcon('timestamp')}
                          </th>
                          <th scope="col" className="px-6 py-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('region')}>
                            招生區 {renderSortIcon('region')}
                          </th>
                          <th scope="col" className="px-6 py-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('identity')}>
                            身分 {renderSortIcon('identity')}
                          </th>
                          <th scope="col" className="px-6 py-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('examYear')}>
                            會考年度 {renderSortIcon('examYear')}
                          </th>
                          <th scope="col" className="px-6 py-4 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('totalScore')}>
                            各科會考成績 (依總積分排序) {renderSortIcon('totalScore')}
                          </th>
                          {activeTab === 'full' && (
                            <>
                              <th scope="col" className="px-6 py-4">比率區間</th>
                              <th scope="col" className="px-6 py-4">序位區間</th>
                            </>
                          )}
                          <th scope="col" className="px-6 py-4 min-w-64">自訂題目回答</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {paginatedData.map((row: any, idx: number) => (
                          <tr key={row.id || idx} className="hover:bg-blue-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs">
                              {new Date(row.timestamp).toLocaleString('zh-TW', {
                                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                            <td className="px-6 py-4 font-bold">{row.region}</td>
                            <td className="px-6 py-4 text-slate-500">{row.identity || '-'}</td>
                            <td className="px-6 py-4">{row.examYear}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-4">
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500 font-bold mb-1">國文</span>
                                  <span className="font-mono font-bold text-slate-900 border-2 border-slate-900 bg-white px-2 py-0.5 rounded-sm shadow-[1px_1px_0_#0F172A] w-9 text-center">{row.chineseScore || '-'}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500 font-bold mb-1">數學</span>
                                  <span className="font-mono font-bold text-slate-900 border-2 border-slate-900 bg-white px-2 py-0.5 rounded-sm shadow-[1px_1px_0_#0F172A] w-9 text-center">{row.mathScore || '-'}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500 font-bold mb-1">英文</span>
                                  <span className="font-mono font-bold text-slate-900 border-2 border-slate-900 bg-white px-2 py-0.5 rounded-sm shadow-[1px_1px_0_#0F172A] w-9 text-center">{row.englishScore || '-'}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500 font-bold mb-1">社會</span>
                                  <span className="font-mono font-bold text-slate-900 border-2 border-slate-900 bg-white px-2 py-0.5 rounded-sm shadow-[1px_1px_0_#0F172A] w-9 text-center">{row.socialScore || '-'}</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500 font-bold mb-1">自然</span>
                                  <span className="font-mono font-bold text-slate-900 border-2 border-slate-900 bg-white px-2 py-0.5 rounded-sm shadow-[1px_1px_0_#0F172A] w-9 text-center">{row.scienceScore || '-'}</span>
                                </div>
                                <div className="flex flex-col items-center pl-4 border-l-2 border-slate-200">
                                  <span className="text-[10px] text-slate-500 font-bold mb-1">作文</span>
                                  <span className="font-mono font-bold text-slate-900 bg-slate-100 border-2 border-slate-300 px-2 py-0.5 rounded-sm w-9 text-center">{row.essayScore || '-'}</span>
                                </div>
                              </div>
                            </td>
                            {activeTab === 'full' && (
                              <>
                                <td className="px-6 py-4 font-mono text-xs">
                                  {row.minRatio != null ? `${row.minRatio}% ~ ${row.maxRatio}%` : <span className="text-slate-400">未提供</span>}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs">
                                  {row.minRankInterval != null ? `${row.minRankInterval} ~ ${row.maxRankInterval}` : <span className="text-slate-400">未提供</span>}
                                </td>
                              </>
                            )}
                            <td className="px-6 py-4 whitespace-normal min-w-64 max-w-md">
                              {formatCustomAnswers(row.custom_answers) ? (
                                <div className="space-y-1 text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                                  {formatCustomAnswers(row.custom_answers)}
                                </div>
                              ) : (
                                <span className="text-slate-400">未填寫</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {paginatedData.length === 0 && (
                          <tr>
                            <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-bold">
                              {loading ? '資料載入中…' : queryError ? '資料載入失敗，請重試' : '目前篩選條件沒有資料'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="p-4 sm:p-5 border-t-2 border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
                    <span className="text-sm font-bold text-slate-600">
                      顯示 {pageTotal === 0 ? 0 : startIndex + 1} 到 {Math.min(startIndex + rowsPerPage, pageTotal)} 筆，共 {pageTotal} 筆
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={loading || currentPage === 1}
                        className="px-3 py-1 font-bold text-sm bg-white border-2 border-slate-300 rounded hover:border-slate-900 disabled:opacity-50 disabled:hover:border-slate-300 transition-colors"
                      >
                        上一頁
                      </button>
                      <span className="px-3 py-1 font-bold text-sm text-slate-700 flex items-center">
                        第 {currentPage} / {totalPages} 頁
                      </span>
                      <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={loading || currentPage >= totalPages}
                        className="px-3 py-1 font-bold text-sm bg-white border-2 border-slate-300 rounded hover:border-slate-900 disabled:opacity-50 disabled:hover:border-slate-300 transition-colors"
                      >
                        下一頁
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === 'settings' && (
          <fieldset disabled={!baseline || saving || settingsLoading} className="space-y-8 mb-12 disabled:opacity-60">
            <div className="bg-white border-2 border-slate-900 p-6 sm:p-8 shadow-[4px_4px_0_#0F172A]">
              <h3 className="text-xl font-bold mb-6 pb-2 border-b-2 border-slate-100 flex items-center">
                系統設定
              </h3>
              
              <div className="bg-slate-50 border-2 border-slate-200 p-4 rounded-md mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <label className="block font-bold text-slate-700 text-lg">系統全域開放設定</label>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={systemEnabled}
                      onChange={(e) => setSystemEnabled(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shrink-0"></div>
                    <span className="ml-3 text-sm font-bold text-slate-900">{systemEnabled ? '開放填寫' : '關閉填寫'}</span>
                  </label>
                </div>
                
                {systemEnabled && (
                  <>
                    <h4 className="font-bold text-slate-700 mb-2 mt-4 text-sm">系統開放區間 (選填)</h4>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-slate-500 mb-1">開放開始時間</label>
                        <input 
                          type="datetime-local" step="any" aria-label="表單開始時間"
                          value={systemStartTime} 
                          onChange={(e) => setSystemStartTime(e.target.value)}
                          className="border-2 border-slate-200 p-3 w-full focus:border-slate-900 focus:outline-none bg-white font-mono text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-slate-500 mb-1">開放結束時間</label>
                        <input 
                          type="datetime-local" step="any" aria-label="表單結束時間"
                          value={systemEndTime} 
                          onChange={(e) => setSystemEndTime(e.target.value)}
                          className="border-2 border-slate-200 p-3 w-full focus:border-slate-900 focus:outline-none bg-white font-mono text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">若未設定區間，只要開啟上方按鈕即為無限期開放。若設定了區間，則只會在區間內開放填寫。</p>
                  </>
                )}
              </div>

              <div className="mb-6">
                <label className="block font-bold text-slate-700 mb-2">序位資訊公告時間</label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="datetime-local" step="any" aria-label="序位公告時間"
                    value={announcementDate} 
                    onChange={(e) => setAnnouncementDate(e.target.value)}
                    className="border-2 border-slate-300 p-3 w-full sm:w-auto flex-1 focus:border-slate-900 focus:outline-none"
                  />
                  {announcementDate && (
                    <div className="flex items-center text-emerald-600 bg-emerald-50 px-4 py-2 border-2 border-emerald-200">
                      目前設定為：{formatTaipeiTime(announcementDate)}
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-2">在公告時間之前，系統會強制關閉「填寫序位資訊」功能，讓使用者直接獲取邀請碼。</p>
              </div>

              <div className="mb-6 border-2 border-blue-200 bg-blue-50 p-5">
                <h4 className="font-bold text-slate-900">序位開放後公告內容</h4>
                <p className="mt-1 text-sm text-slate-600">公告時間到達後，前台將顯示以下內容與連結。</p>
                <p className="mt-2 text-xs text-slate-600">標題、說明與按鈕文字可使用 {'{examYear}'} 跟隨學生所選年度；{'{announcementTime}'} 會顯示設定的公告時間。最新年度之前的資料會顯示歷年填寫說明。</p>
                <div className="mt-3 border border-blue-200 bg-white p-3">
                  <label className="text-sm font-bold">公告預覽年度 <select aria-label="公告預覽年度" value={announcementPreviewYear} onChange={event=>setAnnouncementPreviewYear(event.target.value)} className="ml-2 border border-slate-300 p-2">{getExamYears().map(year=><option key={year} value={year}>{year} 年度</option>)}</select></label>
                  <p className="font-bold mt-3">{announcementPreview.title}</p><p className="mt-2 text-sm">{announcementPreview.body}</p>
                  {announcementPreview.linkLabel && <p className="mt-2 text-sm">按鈕：{announcementPreview.linkLabel}</p>}
                </div>
                <div className="mt-4 grid gap-4">
                  <label className="text-sm font-bold text-slate-700">公告標題
                    <input value={announcementContent.title} onChange={(e) => setAnnouncementContent(prev => ({ ...prev, title: e.target.value }))} className="mt-1.5 w-full border-2 border-slate-300 bg-white p-3 font-medium focus:border-slate-900 focus:outline-none" />
                  </label>
                  <label className="text-sm font-bold text-slate-700">公告說明
                    <textarea value={announcementContent.body} onChange={(e) => setAnnouncementContent(prev => ({ ...prev, body: e.target.value }))} rows={3} className="mt-1.5 w-full resize-y border-2 border-slate-300 bg-white p-3 font-medium leading-relaxed focus:border-slate-900 focus:outline-none" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-slate-700">按鈕文字
                      <input value={announcementContent.linkLabel} onChange={(e) => setAnnouncementContent(prev => ({ ...prev, linkLabel: e.target.value }))} className="mt-1.5 w-full border-2 border-slate-300 bg-white p-3 font-medium focus:border-slate-900 focus:outline-none" />
                    </label>
                    <label className="text-sm font-bold text-slate-700">按鈕連結
                      <input type="url" value={announcementContent.linkUrl} onChange={(e) => setAnnouncementContent(prev => ({ ...prev, linkUrl: e.target.value }))} className="mt-1.5 w-full border-2 border-slate-300 bg-white p-3 font-medium focus:border-slate-900 focus:outline-none" placeholder="https://..." />
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-slate-100 pt-6 mt-6 mb-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <label className="block font-bold text-slate-700">各科會考成績開放填寫</label>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={subjectScoreEnabled}
                      onChange={(e) => setSubjectScoreEnabled(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shrink-0"></div>
                    <span className="ml-3 text-sm font-bold text-slate-900">{subjectScoreEnabled ? '啟用' : '停用'}</span>
                  </label>
                </div>
                
                {subjectScoreEnabled && (
                  <>
                    <h4 className="font-bold text-slate-700 mb-2 mt-4 text-sm">成績開放填寫區間 (選填)</h4>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-slate-500 mb-1">開放開始時間</label>
                        <input 
                          type="datetime-local" step="any" aria-label="成績輸入開始時間"
                          value={subjectScoreStartTime} 
                          onChange={(e) => setSubjectScoreStartTime(e.target.value)}
                          className="border-2 border-slate-300 p-3 w-full focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-slate-500 mb-1">開放結束時間</label>
                        <input 
                          type="datetime-local" step="any" aria-label="成績輸入結束時間"
                          value={subjectScoreEndTime} 
                          onChange={(e) => setSubjectScoreEndTime(e.target.value)}
                          className="border-2 border-slate-300 p-3 w-full focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">若設定了此區間，填寫表單中的【各科成績】區域只會在此區間內顯示，跨出區間將自動隱藏並且不強制必填。</p>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white border-2 border-slate-900 p-6 sm:p-8 shadow-[4px_4px_0_#0F172A]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-slate-100">
                <h3 className="text-xl font-bold flex items-center">自訂問卷題目</h3>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setShowPreviewModal(true)}
                    className="flex-1 sm:flex-none px-4 py-2 border-2 border-slate-900 bg-white text-slate-900 font-bold text-sm flex items-center justify-center gap-2 shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    <span>表單預覽</span>
                  </button>
                  <button 
                    onClick={addCustomQuestion}
                    className="flex-1 sm:flex-none px-4 py-2 border-2 border-slate-900 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors shadow-[2px_2px_0_#34D399]"
                  >
                    + 新增題目
                  </button>
                </div>
              </div>
              
              <p className="mb-4 text-sm text-slate-500">自訂題目開始與結束時間一律採台北時間（UTC+8），不受學生裝置時區影響。</p>
              <div className="space-y-6">
                {customQuestions.map((q, idx) => (
                  <div key={q.id} className="relative group">
                    <div className="absolute inset-0 bg-slate-900 translate-x-1.5 translate-y-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border-2 border-slate-900"></div>
                    <div className="bg-white border-2 border-slate-900 p-5 sm:p-6 relative z-10 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-200">
                      <button 
                        onClick={() => removeQuestion(q.id)}
                        className="absolute top-4 right-4 text-rose-500 font-bold text-sm border-2 border-transparent hover:border-rose-200 hover:bg-rose-50 px-2 py-1 rounded transition-colors"
                      >
                        移除
                      </button>
                      <div className="flex flex-col sm:flex-row gap-4 mb-4 pr-12">
                        <div className="flex-1">
                          <label className="block font-black text-slate-900 mb-2 tracking-wide text-sm flex items-center">
                            <span className="w-1.5 h-3 bg-slate-900 mr-2 inline-block"></span>
                            題目 {idx + 1}
                          </label>
                          <input 
                            type="text" 
                            value={q.question} 
                            onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                            className="w-full border-2 border-slate-300 p-3 font-bold focus:border-slate-900 focus:outline-none focus:shadow-[4px_4px_0_#0F172A] transition-all"
                            placeholder="請輸入題目"
                          />
                        </div>
                        <div className="w-full sm:w-48">
                          <label className="block font-black text-slate-900 mb-2 tracking-wide text-sm flex items-center">
                            <span className="w-1.5 h-3 bg-slate-900 mr-2 inline-block"></span>
                            題型
                          </label>
                          <select 
                            value={q.type} 
                            onChange={(e) => updateQuestion(q.id, { type: e.target.value })}
                            className="w-full border-2 border-slate-300 p-3 font-bold bg-white focus:border-slate-900 focus:outline-none focus:shadow-[4px_4px_0_#0F172A] transition-all cursor-pointer"
                          >
                            <option value="text">簡答題</option>
                            <option value="radio">單選題</option>
                            <option value="checkbox">多選題</option>
                          </select>
                        </div>
                      </div>
                      
                      {(q.type === 'radio' || q.type === 'checkbox') && (
                        <div className="mb-4">
                          <label className="block font-black text-slate-900 mb-2 tracking-wide text-sm flex items-center">
                            <span className="w-1.5 h-3 bg-slate-900 mr-2 inline-block"></span>
                            選項 <span className="text-slate-500 font-medium ml-2 text-xs">(以逗號分隔)</span>
                          </label>
                          <input 
                            type="text" 
                            value={q.options ? q.options.join(',') : ''} 
                            onChange={(e) => updateQuestion(q.id, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            className="w-full border-2 border-slate-300 p-3 font-bold focus:border-slate-900 focus:outline-none focus:shadow-[4px_4px_0_#0F172A] transition-all"
                            placeholder="例如: 選項A,選項B,選項C"
                          />
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="flex-1">
                          <label className="block font-black text-slate-900 mb-2 tracking-wide text-sm flex items-center">
                            <span className="w-1.5 h-3 bg-slate-400 mr-2 inline-block"></span>
                            開放填寫開始時間 <span className="text-slate-400 font-medium ml-2 text-xs">(選填)</span>
                          </label>
                          <input 
                            type="datetime-local" step="any"
                            value={q.startTime || ''} 
                            onChange={(e) => updateQuestion(q.id, { startTime: e.target.value })}
                            className="w-full border-2 border-slate-300 p-3 font-bold text-slate-700 focus:border-slate-900 focus:outline-none focus:shadow-[4px_4px_0_#0F172A] transition-all"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block font-black text-slate-900 mb-2 tracking-wide text-sm flex items-center">
                            <span className="w-1.5 h-3 bg-slate-400 mr-2 inline-block"></span>
                            開放填寫結束時間 <span className="text-slate-400 font-medium ml-2 text-xs">(選填)</span>
                          </label>
                          <input 
                            type="datetime-local" step="any"
                            value={q.endTime || ''} 
                            onChange={(e) => updateQuestion(q.id, { endTime: e.target.value })}
                            className="w-full border-2 border-slate-300 p-3 font-bold text-slate-700 focus:border-slate-900 focus:outline-none focus:shadow-[4px_4px_0_#0F172A] transition-all"
                          />
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t-2 border-slate-100">
                        <label className="flex items-center cursor-pointer inline-flex">
                          <div className="relative flex items-center">
                            <input 
                              type="checkbox" 
                              checked={q.required} 
                              onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                              className="w-5 h-5 border-2 border-slate-300 rounded text-slate-900 focus:ring-slate-900 focus:ring-2 cursor-pointer transition-all"
                            />
                          </div>
                          <span className="ml-3 font-black text-sm tracking-wide text-slate-900">此題為必填項目</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                {customQuestions.length === 0 && (
                  <div className="text-center py-8 text-slate-400 font-bold border-2 border-dashed border-slate-300">
                    目前沒有自訂題目
                  </div>
                )}

              </div>
            </div>

            <div className="pt-4 border-t-4 border-slate-900 mt-8">
              <p className="mb-3 text-sm text-slate-500">所有開放時間均為台北時間（UTC+8）。</p>
              {issues.errors.map(text => <p key={text} role="alert" className="mb-2 text-red-700">{text}</p>)}
              {issues.warnings.map(text => <p key={text} className="mb-2 text-amber-700">{text}</p>)}
              <button 
                onClick={preparePublish}
                disabled={!dirty || saving || issues.errors.length > 0}
                className="w-full py-4 bg-emerald-400 text-slate-900 font-black text-xl border-2 border-slate-900 shadow-[6px_6px_0_#0F172A] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center"
              >
                {loading || statsLoading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}
                儲存所有設定
              </button>
            </div>
          </fieldset>
        )}

        {activeTab === 'backups' && (
          <div className="space-y-8 mb-12">
            <div className="bg-white border-2 border-slate-900 p-6 sm:p-8 shadow-[4px_4px_0_#0F172A] mb-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-slate-100">
                <h3 className="text-xl font-bold flex items-center">系統版本備份</h3>
              </div>
              <p className="text-sm text-slate-600 mb-6 font-medium">系統會自動保存最近 3 次的設定紀錄。您可以隨時預覽或直接載入覆蓋至目前的草稿，再進行儲存發佈。</p>
              
              {backups.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border-2 border-dashed border-slate-300 text-slate-500 font-bold">
                  目前尚未有備份紀錄
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="block text-sm font-bold text-emerald-800 mb-1">目前線上正式版本最後發佈時間</span>
                      <span className="text-emerald-700 font-mono text-sm">{new Date(backups[0].timestamp).toLocaleString('zh-TW')}</span>
                    </div>
                  </div>
                  {backups.map((bk, i) => (
                    <div key={i} className={`flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 p-4 border-2 ${i === 0 ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-200 bg-slate-50'} hover:border-slate-900 transition-colors group`}>
                      <div>
                        <span className="font-bold text-slate-900 block mb-1">
                          版本紀錄 #{backups.length - i}
                          {i === 0 && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 border border-emerald-200">目前版本</span>}
                        </span>
                        <span className="text-xs font-mono text-slate-500 bg-white px-2 py-1 border border-slate-200 rounded">{new Date(bk.timestamp).toLocaleString('zh-TW')}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 w-full xl:w-auto mt-2 xl:mt-0">
                        <button 
                          onClick={() => setShowBackupPreview(bk)}
                          className="flex-1 sm:flex-none px-4 py-2 border-2 border-slate-900 bg-white text-slate-900 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none"
                        >
                          <Eye className="w-4 h-4" /> 預覽這版
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm('確定要載入此版本？\n此操作將覆蓋您目前尚未儲存的設定（直到您手動點擊「儲存所有設定」才會生效）')) {
                              loadDraft(toSettingsDraft(bk));
                              alert('已載入該版本設定！若要正式生效發佈，請回到「系統設定與自訂問卷」並點擊最下方「儲存所有設定」。');
                              setActiveTab('settings');
                            }
                          }}
                          className="flex-1 sm:flex-none px-4 py-2 bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 transition-colors shadow-[2px_2px_0_#312E81] border-2 border-indigo-900"
                        >
                          套用到目前草稿
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] p-6 lg:p-10 mb-12">
            <h3 className="text-xl font-bold mb-6 pb-2 border-b-2 border-slate-100 flex items-center">
              修改管理員密碼
            </h3>
            <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md mb-12">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">新密碼</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="輸入至少 6 位的新密碼"
                  className="w-full border-2 border-slate-300 px-4 py-2 focus:border-slate-900 focus:outline-none bg-white font-mono"
                  required
                />
              </div>
              <button 
                type="submit"
                className="py-2 px-6 bg-slate-900 text-white font-bold border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all"
              >
                儲存新密碼
              </button>
            </form>

            <h3 className="text-xl font-bold mb-6 pb-2 border-b-2 border-slate-100 flex items-center flex-wrap gap-4 justify-between">
              <span>近期登入紀錄</span>
              <button 
                onClick={fetchLogs}
                className="text-sm border-2 border-slate-300 py-1 px-4 bg-slate-50 hover:bg-slate-100 font-bold"
              >
                重新整理
              </button>
            </h3>
            
            <div className="overflow-x-auto w-full border-2 border-slate-900">
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 border-b-2 border-slate-900 font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th scope="col" className="px-6 py-4">時間</th>
                    <th scope="col" className="px-6 py-4">狀態</th>
                    <th scope="col" className="px-6 py-4">紀錄來源</th>
                    <th scope="col" className="px-6 py-4">IP 位址</th>
                    <th scope="col" className="px-6 py-4">User Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {adminLogs.map((log: any, idx: number) => (
                    <tr key={log.id || idx}>
                      <td className="px-6 py-4 font-mono text-xs">
                        {new Date(log.login_time).toLocaleString('zh-TW', {
                          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 font-bold">
                        <span className={`px-2 py-1 rounded text-xs ${log.event_source !== 'supabase_auth' ? 'bg-amber-100 text-amber-800' : log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {log.event_source === 'supabase_auth' ? log.status : '未驗證歷史紀錄'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {log.event_source === 'supabase_auth' ? '驗證服務' : '舊版紀錄（來源未驗證）'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">{log.ip_address || 'unknown'}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 overflow-hidden text-ellipsis max-w-[200px]" title={log.user_agent}>
                        {log.user_agent || 'unknown'}
                      </td>
                    </tr>
                  ))}
                  {adminLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold">
                        目前尚無登入紀錄
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-slate-500 font-bold">
               此處顯示驗證服務產生的管理員成功登入紀錄；舊版紀錄標示為未驗證。登入失敗請至驗證服務的系統紀錄查閱。IP 或瀏覽器資訊未提供時顯示 unknown。
            </p>
          </div>
        )}

      </div>
      
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border-4 border-slate-900 w-full max-w-3xl my-8 relative shadow-[12px_12px_0_#0F172A] animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setShowPreviewModal(false)}
              className="absolute -top-4 -right-4 w-10 h-10 bg-rose-400 border-2 border-slate-900 flex items-center justify-center rounded-none shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none transition-all z-10"
            >
              <X className="w-6 h-6 text-slate-900" />
            </button>
            <div className="p-6 border-b-2 border-slate-900 bg-emerald-400">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-widest flex items-center">
                表單預覽
              </h2>
            </div>
            
            <div className="p-6 sm:p-10 max-h-[75vh] overflow-y-auto bg-slate-50 grid-pattern">
              
              <div className="max-w-2xl mx-auto space-y-8">
                
                {/* System Status Card */}
                <div className="bg-white border-2 border-slate-900 p-6 sm:p-8 relative group">
                  <div className="absolute inset-0 bg-indigo-500 translate-x-2 translate-y-2 -z-10 border-2 border-slate-900 pointer-events-none"></div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-slate-100">
                    <h3 className="text-xl font-black flex items-center text-slate-900 uppercase tracking-widest">
                      <LayoutDashboard className="w-6 h-6 mr-3 text-indigo-500" />
                      系統狀態與排程
                    </h3>
                    <div className={`px-4 py-1.5 border-2 border-slate-900 font-bold text-sm flex items-center ${systemEnabled ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                      <span className={`w-2 h-2 rounded-full mr-2 ${systemEnabled ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></span>
                      {systemEnabled ? '系統開放中' : '系統已停用'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    <div className="bg-slate-50 border-2 border-slate-200 p-4">
                      <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">序位公告時間</p>
                      <p className="font-bold text-slate-900 text-sm">
                        {announcementDate ? formatTaipeiTime(announcementDate) : '未設定'}
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 border-2 border-slate-200 p-4">
                      <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">系統總開放期間</p>
                      <p className="font-bold text-slate-900 text-sm leading-tight">
                        <span className="text-slate-500 inline-block w-6">起</span> {systemStartTime ? formatTaipeiTime(systemStartTime) : '不限'}<br/>
                        <span className="text-slate-500 inline-block w-6 text-xs mt-1">迄</span> {systemEndTime ? formatTaipeiTime(systemEndTime) : '不限'}
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 border-2 border-slate-200 p-4 md:col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">會考成績選填期間</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 uppercase border-2 ${subjectScoreEnabled ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-rose-100 border-rose-200 text-rose-700'}`}>
                          {subjectScoreEnabled ? '開放中' : '已停用'}
                        </span>
                      </div>
                      
                      {!subjectScoreEnabled ? (
                        <p className="font-bold text-slate-400 text-sm italic">成績選填功能已關閉</p>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1">
                            <span className="text-slate-400 text-xs font-bold mr-2">START</span>
                            <span className="font-bold text-slate-900 text-sm">{subjectScoreStartTime ? formatTaipeiTime(subjectScoreStartTime) : '不限'}</span>
                          </div>
                          <div className="flex-1">
                            <span className="text-slate-400 text-xs font-bold mr-2">END</span>
                            <span className="font-bold text-slate-900 text-sm">{subjectScoreEndTime ? formatTaipeiTime(subjectScoreEndTime) : '不限'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Custom Questions Section */}
                <div>
                  <div className="flex items-center justify-center mb-8 relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t-2 border-slate-300 border-dashed"></div>
                    </div>
                    <div className="relative bg-slate-50 px-4">
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center">
                        <span className="w-3 h-3 bg-emerald-400 border-2 border-slate-900 mr-3"></span>
                        自訂問卷預覽
                        <span className="w-3 h-3 bg-emerald-400 border-2 border-slate-900 ml-3"></span>
                      </h3>
                    </div>
                  </div>
                  
                  {customQuestions.length === 0 ? (
                    <div className="text-center py-16 bg-white outline-dashed outline-2 outline-slate-300 text-slate-400 font-bold border-2 border-white shadow-sm">
                      <ClipboardList className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      目前尚未新增任何自訂題目
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {customQuestions.map((q, idx) => (
                        <div key={q.id} className="relative group">
                          <div className="absolute inset-0 bg-emerald-400 translate-x-1.5 translate-y-1.5 -z-10 border-2 border-slate-900 pointer-events-none"></div>
                          <div className="bg-white border-2 border-slate-900 p-6 sm:p-8 relative z-10 hover:-translate-y-0.5 hover:-translate-x-0.5 transition-transform duration-200">
                            
                            <div className="flex items-start justify-between mb-4">
                              <label className="text-base sm:text-lg font-black text-slate-900 flex items-start tracking-wide">
                                <span className="text-emerald-500 mr-2 mt-0.5">{String(idx + 1).padStart(2, '0')}.</span>
                                <span className="leading-tight pt-1">{q.question}</span>
                                {q.required && <span className="text-rose-500 ml-2 mt-1 text-2xl leading-none">*</span>}
                              </label>
                            </div>
                            
                            {(q.startTime || q.endTime) && (
                              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-5 text-xs font-bold text-amber-800 flex items-center">
                                <Calendar className="w-4 h-4 mr-2 text-amber-500 flex-shrink-0" />
                                <div>
                                  <span className="uppercase tracking-wider opacity-75 mr-1">Time Limit:</span>
                                  {q.startTime && <span>{formatTaipeiTime(q.startTime)} 起</span>}
                                  {q.startTime && q.endTime && <span className="mx-1">~</span>}
                                  {q.endTime && <span>{formatTaipeiTime(q.endTime)} 止</span>}
                                </div>
                              </div>
                            )}
                            
                            <div className="mt-4">
                              {q.type === 'text' && (
                                <input 
                                  type="text" 
                                  value={previewAnswers[q.id] || ''} 
                                  onChange={(e) => handlePreviewAnswerChange(q.id, e.target.value, 'text')}
                                  className="w-full border-2 border-slate-300 p-4 font-bold text-slate-900 focus:border-slate-900 focus:outline-none focus:shadow-[4px_4px_0_#0F172A] transition-all bg-slate-50 focus:bg-white placeholder:text-slate-400"
                                  placeholder="請輸入您的回答..."
                                />
                              )}
                              
                              {q.type === 'radio' && q.options && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {q.options.map((opt: string, i: number) => (
                                    <label key={i} className={`flex items-center p-4 border-2 cursor-pointer transition-all ${previewAnswers[q.id] === opt ? 'border-slate-900 bg-emerald-50 shadow-[2px_2px_0_#0F172A]' : 'border-slate-200 hover:border-slate-400 bg-white'}`}>
                                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 flex-shrink-0 ${previewAnswers[q.id] === opt ? 'border-slate-900' : 'border-slate-300'}`}>
                                        {previewAnswers[q.id] === opt && <div className="w-2.5 h-2.5 bg-slate-900 rounded-full"></div>}
                                      </div>
                                      <input 
                                        type="radio" 
                                        name={q.id} 
                                        value={opt}
                                        checked={previewAnswers[q.id] === opt}
                                        onChange={(e) => handlePreviewAnswerChange(q.id, e.target.value, 'radio')}
                                        className="sr-only"
                                      />
                                      <span className={`font-bold ${previewAnswers[q.id] === opt ? 'text-slate-900' : 'text-slate-600'}`}>{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              )}

                              {q.type === 'checkbox' && q.options && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {q.options.map((opt: string, i: number) => (
                                    <label key={i} className={`flex items-center p-4 border-2 cursor-pointer transition-all ${(previewAnswers[q.id] || []).includes(opt) ? 'border-slate-900 bg-emerald-50 shadow-[2px_2px_0_#0F172A]' : 'border-slate-200 hover:border-slate-400 bg-white'}`}>
                                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 flex-shrink-0 ${((previewAnswers[q.id] || []).includes(opt)) ? 'border-slate-900 bg-slate-900' : 'border-slate-300'}`}>
                                        {((previewAnswers[q.id] || []).includes(opt)) && (
                                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <input 
                                        type="checkbox" 
                                        checked={(previewAnswers[q.id] || []).includes(opt)}
                                        onChange={() => handlePreviewAnswerChange(q.id, opt, 'checkbox')}
                                        className="sr-only"
                                      />
                                      <span className={`font-bold ${((previewAnswers[q.id] || []).includes(opt)) ? 'text-slate-900' : 'text-slate-600'}`}>{opt}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t-2 border-slate-900 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="px-6 py-2 bg-slate-900 text-white font-bold border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[2px_2px_0_#0F172A] transition-all"
              >
                關閉預覽
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackupPreview && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border-4 border-slate-900 w-full max-w-3xl my-8 relative shadow-[12px_12px_0_#0F172A] animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setShowBackupPreview(null)}
              className="absolute -top-4 -right-4 w-10 h-10 bg-rose-400 border-2 border-slate-900 flex items-center justify-center rounded-none shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none transition-all z-10"
            >
              <X className="w-6 h-6 text-slate-900" />
            </button>
            <div className="p-6 border-b-2 border-slate-900 bg-indigo-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-widest flex items-center">
                備份版本預覽
              </h2>
              <span className="bg-slate-900 text-white px-3 py-1 text-sm font-mono font-bold whitespace-nowrap">
                {new Date(showBackupPreview.timestamp).toLocaleString('zh-TW')}
              </span>
            </div>
            
            <div className="p-6 bg-slate-50 border-b-2 border-slate-900 space-y-4 font-medium text-sm text-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 border-2 border-slate-200">
                  <span className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-bold">系統開放狀態</span>
                  <span className={showBackupPreview.system_enabled ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{showBackupPreview.system_enabled ? '開放中' : '關閉中'}</span>
                </div>
                <div className="bg-white p-4 border-2 border-slate-200">
                  <span className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-bold">成績輸入功能</span>
                  <span className={showBackupPreview.subject_score_enabled ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{showBackupPreview.subject_score_enabled ? '開放中' : '關閉中'}</span>
                </div>
                <div className="bg-white p-4 border-2 border-slate-200 col-span-2">
                  <span className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-bold">序位區間公告時間</span>
                  <span className="font-bold text-slate-900">{showBackupPreview.announcement_date ? formatTaipeiTime(showBackupPreview.announcement_date) : '未設定'}</span>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 bg-white max-h-[50vh] overflow-y-auto">
              {(!showBackupPreview.custom_questions || showBackupPreview.custom_questions.length === 0) ? (
                <div className="text-center py-12 text-slate-400 font-bold">
                  此版本沒有自訂問卷題目
                </div>
              ) : (
                <div className="space-y-8 pointer-events-none opacity-90">
                  {showBackupPreview.custom_questions.map((q: any) => (
                    <div key={q.id} className="border-2 border-slate-200 p-6 relative">
                      <div className="absolute -top-3 -left-3 bg-indigo-100 text-indigo-700 px-2 py-1 text-xs font-bold border-2 border-indigo-200">
                        {q.type === 'text' ? '簡答題' : q.type === 'radio' ? '單選題' : '多選題'}
                      </div>
                      {q.required && <span className="absolute -top-3 -right-3 bg-rose-100 text-rose-700 px-2 py-1 text-xs font-bold border-2 border-rose-200">必填</span>}
                      
                      <label className="block text-lg font-bold text-slate-900 mb-4 mt-2">
                        {q.question}
                      </label>
                      
                      {(q.type === 'radio' || q.type === 'checkbox') && (
                        <div className="space-y-3">
                          {q.options?.map((opt: string, i: number) => (
                            <label key={i} className="flex items-center p-3 border-2 border-slate-200 bg-slate-50">
                              <input 
                                type={q.type} 
                                className="w-5 h-5 accent-slate-900 border-2 border-slate-400 bg-white"
                              />
                              <span className="ml-3 font-medium text-slate-700">{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      
                      {q.type === 'text' && (
                        <input 
                          type="text" 
                          placeholder="簡答題填寫區..."
                          className="w-full border-2 border-slate-200 p-3 bg-slate-50"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t-2 border-slate-900 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => {
                  if (window.confirm('確定要載入此版本？\n此操作將覆蓋您目前尚未儲存的設定（直到您手動點擊「儲存所有設定」才會生效）')) {
                    const bk = showBackupPreview;
                    loadDraft(toSettingsDraft(bk));
                    setShowBackupPreview(null);
                    alert('已載入該版本設定！若要正式生效發佈，請點擊最下方「儲存所有設定」。');
                  }
                }}
                className="px-6 py-2 bg-emerald-400 text-slate-900 font-black border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[2px_2px_0_#0F172A] transition-all"
              >
                套用這版
              </button>
              <button 
                onClick={() => setShowBackupPreview(null)}
                className="px-6 py-2 bg-slate-900 text-white font-bold border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] hover:translate-y-0.5 hover:translate-x-0.5 hover:shadow-[2px_2px_0_#0F172A] transition-all"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="publish-title" data-admin-modal tabIndex={-1} className="bg-white border-4 border-slate-900 p-4 sm:p-6 max-w-4xl w-full max-h-[90dvh] overflow-y-auto shadow-[8px_8px_0_#0F172A]">
            <h2 id="publish-title" className="text-2xl font-black mb-3">發布前設定比較</h2>
            <p className="mb-4 text-sm text-slate-600">原設定 → 新設定。確認發布後立即生效；所有時間為台北時間。</p>
            {remoteConfig && <div role="alert" className="mb-4 border-2 border-amber-500 bg-amber-50 p-4">
              <p className="font-bold">線上版本已更新，這次發布已被擋下，您的草稿仍保留。</p>
              <p className="mt-2 text-sm">下方先比較您載入的原設定與草稿。選擇「以最新版重新比較」後，原設定會換成最新線上版本，再次確認才能發布。</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button disabled={saving} onClick={() => acceptConfig(remoteConfig.current, true)} className="border-2 border-slate-900 px-3 py-2 font-bold">保留草稿，以最新版重新比較</button>
                <button disabled={saving} onClick={() => { if (window.confirm('確定捨棄目前草稿，載入最新線上設定？')) { acceptConfig(remoteConfig.current); setShowSaveConfirm(false); } }} className="border-2 border-slate-300 px-3 py-2">捨棄草稿並載入線上版本</button>
              </div>
            </div>}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm border-collapse">
                <thead><tr className="bg-slate-100"><th className="p-3 w-1/4">設定項目</th><th className="p-3">原設定</th><th className="p-3">新設定</th></tr></thead>
                <tbody>{changes.map((change, index) => <tr key={index} className="border-b border-slate-200 align-top"><th className="p-3 break-words">{change.label}</th><td className="p-3 whitespace-pre-wrap break-words text-slate-600">{change.before}</td><td className="p-3 whitespace-pre-wrap break-words bg-emerald-50">{change.after}</td></tr>)}</tbody>
              </table>
            </div>
            {!changes.length && <p className="py-6 text-center">沒有待發布的變更。</p>}
            {issues.errors.map(text => <p key={text} role="alert" className="mt-3 text-red-700">{text}</p>)}
            {issues.warnings.map(text => <p key={text} className="mt-3 text-amber-700">提醒：{text}</p>)}
            {settingsError && <p role="alert" className="mt-3 text-red-700">{settingsError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button disabled={saving} onClick={() => setShowSaveConfirm(false)} className="border-2 border-slate-300 px-4 py-3 font-bold">返回編輯</button>
              <button disabled={saving || !dirty || issues.errors.length > 0 || !!remoteConfig} onClick={saveSettings} className="border-2 border-slate-900 bg-emerald-300 px-4 py-3 font-black disabled:opacity-50">{saving ? '發布中…' : '確認發佈'}</button>
            </div>
          </section>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="CSV 匯出選項" data-admin-modal tabIndex={-1} className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_#0F172A] p-6 sm:p-8 max-w-2xl w-full max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-100">
              <div>
                <h3 className="text-2xl font-extrabold flex items-center text-slate-900">
                  <Download className="w-6 h-6 mr-3 text-emerald-600" />
                  選擇匯出資料
                </h3>
                <p className="text-sm font-bold text-slate-500 mt-2">請選擇要下載的 CSV 資料範圍</p>
              </div>
              <button
                onClick={() => { exportController.current?.abort(); setShowExportModal(false); }}
                className="p-2 hover:bg-slate-100 transition-colors border-2 border-slate-900 shadow-[2px_2px_0_#0F172A] active:translate-y-0.5 active:shadow-none"
                aria-label="關閉匯出選單"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="mb-5 text-sm text-slate-600">套用畫面上已生效的共用篩選條件；包含所有符合條件的頁面。日期以台北時間計算。</p>
            <fieldset disabled={exporting} className="mb-4 border-2 border-slate-200 p-4">
              <legend className="px-2 font-bold">匯出欄位</legend>
              <div className="mb-3 flex gap-4 text-sm"><button type="button" onClick={() => setExportFields(EXPORT_FIELDS.map(([key]) => key))} className="underline">全選欄位</button><button type="button" onClick={() => setExportFields([])} className="underline">清除欄位</button></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">{EXPORT_FIELDS.map(([key,label]) => <label key={key} className="flex gap-2 items-center"><input type="checkbox" checked={exportFields.includes(key)} onChange={event => setExportFields(prev => event.target.checked ? [...prev,key] : prev.filter(field => field !== key))} />{label}</label>)}</div>
              <label className="mt-4 flex items-center gap-2 font-bold"><input type="checkbox" checked={includePersonal} disabled={!exportFields.includes('email')} onChange={event => setIncludePersonal(event.target.checked)} />包含完整 Email（個資）</label>
              <p className="mt-2 text-xs text-slate-500">Email 預設遮蔽為 ***@***。自訂回答可能含個資，遮蔽 Email 不代表整份資料已去識別化。</p>
              {includePersonal && exportFields.includes('email') && <p className="mt-2 text-sm text-amber-800">本次檔案將包含完整 Email，請確認下載及分享對象。</p>}
              {!exportFields.length && <p role="alert" className="mt-2 text-red-700">請至少選擇一個匯出欄位。</p>}
            </fieldset>
            {exporting && <p role="status" className="mb-4 font-bold">正在準備匯出，已讀取 {exportProgress} 筆…</p>}
            {queryError && <p role="alert" className="mb-4 text-red-700">{queryError}</p>}
            <div className="space-y-3">
              {[
                { id: 'full', title: '完整填寫資料', desc: '符合篩選且包含序位的資料', count: stats.full },
                { id: 'skip', title: '無序位填寫資料', desc: '符合篩選且未提供序位的資料', count: stats.skip },
                { id: 'all', title: '全部資料', desc: '符合篩選的兩類資料合併匯出', count: stats.total }
              ].map(option => (
                <button
                  key={option.id}
                  onClick={() => exportToCSV(option.id as 'full' | 'skip' | 'all')}
                  disabled={exporting || statsLoading || option.count === 0 || exportFields.length === 0}
                  className="w-full border-2 border-slate-900 bg-slate-50 p-4 text-left shadow-[3px_3px_0_#0F172A] hover:bg-emerald-50 hover:translate-y-0.5 hover:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-50 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_#0F172A]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-black text-slate-900">{option.title}</span>
                    <span className="text-sm font-black text-emerald-700 bg-white border-2 border-slate-900 px-2 py-1">
                      {option.count} 筆
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-500 mt-2">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer / Copyright */}
      <footer className="mt-12 py-8 border-t-2 border-slate-900 bg-slate-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-400 flex items-center justify-center -rotate-6 shadow-[2px_2px_0_#34D399]">
              <Lock className="w-4 h-4 text-slate-900" />
            </div>
            <p className="text-white font-black tracking-widest text-sm">管理員作業系統</p>
          </div>
          <p className="text-slate-500 font-bold text-xs tracking-widest uppercase flex items-center gap-2">
            &copy; {new Date().getFullYear()} 全國會考分析系統 版權所有
          </p>
        </div>
      </footer>
      <ShareDialog open={isShareOpen} onClose={() => setIsShareOpen(false)} url={`${window.location.origin}${window.location.pathname}#/`} />
    </div>
  );
}
