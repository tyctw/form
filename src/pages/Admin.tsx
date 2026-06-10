import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Lock, LayoutDashboard, Users, MapPin, Loader2, Download, Table, ClipboardList, Calendar, LogOut, ArrowUpDown, ArrowUp, ArrowDown, Eye, X, ExternalLink } from 'lucide-react';
import { Header } from '../components/Header';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any[]>([]); // combined
  const [fullDataList, setFullDataList] = useState<any[]>([]);
  const [skipDataList, setSkipDataList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'full' | 'skip' | 'settings' | 'logs'>('overview');

  // Settings State
  const [announcementDate, setAnnouncementDate] = useState('2026-06-16T12:00');
  const [customQuestions, setCustomQuestions] = useState<any[]>([]);
  const [subjectScoreStartTime, setSubjectScoreStartTime] = useState('');
  const [subjectScoreEndTime, setSubjectScoreEndTime] = useState('');
  const [subjectScoreEnabled, setSubjectScoreEnabled] = useState(true);
  const [systemStartTime, setSystemStartTime] = useState('');
  const [systemEndTime, setSystemEndTime] = useState('');
  const [systemEnabled, setSystemEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [newPassword, setNewPassword] = useState('');
  
  // Preview Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});

  // Table view state
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    setCurrentPage(1);
    setTableSearch('');
  }, [activeTab, rowsPerPage]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
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
      if (data) setAdminLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      if (password === 'admin123') setIsAuthenticated(true);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('verify_admin_password', {
        p_password: password,
        p_user_agent: navigator.userAgent
      });

      if (error) {
        console.error('RPC Error:', error);
        // Fallback for before RPC setup
        if (password === 'admin123') {
           setIsAuthenticated(true);
           fetchData();
           fetchSettings();
           fetchLogs();
        } else {
           setError('登入失敗或後端未設定 (無法呼叫驗證函式)');
        }
      } else if (data === true) {
        setIsAuthenticated(true);
        fetchData();
        fetchSettings();
        fetchLogs();
      } else {
        setError('密碼錯誤');
      }
    } catch (err) {
      console.error(err);
      if (password === 'admin123') setIsAuthenticated(true);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newPassword) return;
    if (newPassword.length < 6) {
      alert('密碼長度需至少 6 個字元');
      return;
    }
    
    try {
      const { data, error } = await supabase.rpc('update_admin_password', {
        old_password: password,
        new_password: newPassword
      });
      if (error) throw error;
      if (data) {
        setPassword(newPassword);
        setNewPassword('');
        alert('密碼修改成功');
      } else {
        alert('修改失敗 (原密碼錯誤或其他因素)');
      }
    } catch (err: any) {
      alert('修改失敗: ' + err.message);
    }
  };

  const fetchSettings = async () => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase.from('survey_config').select('*').limit(1).maybeSingle();
      if (data) {
        if (data.announcement_date) setAnnouncementDate(new Date(data.announcement_date).toISOString().slice(0, 16));
        if (data.custom_questions) setCustomQuestions(data.custom_questions);
        if (data.subject_score_start_time) setSubjectScoreStartTime(new Date(data.subject_score_start_time).toISOString().slice(0, 16));
        if (data.subject_score_end_time) setSubjectScoreEndTime(new Date(data.subject_score_end_time).toISOString().slice(0, 16));
        if (data.subject_score_enabled !== undefined && data.subject_score_enabled !== null) setSubjectScoreEnabled(data.subject_score_enabled);
        if (data.system_start_time) setSystemStartTime(new Date(data.system_start_time).toISOString().slice(0, 16));
        if (data.system_end_time) setSystemEndTime(new Date(data.system_end_time).toISOString().slice(0, 16));
        if (data.system_enabled !== undefined && data.system_enabled !== null) setSystemEnabled(data.system_enabled);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      setMessage('');
      if (!supabase) throw new Error("Supabase is not configured");
      const isoDate = new Date(announcementDate).toISOString();
      const payload: any = {
        announcement_date: isoDate,
        custom_questions: customQuestions,
        subject_score_start_time: subjectScoreStartTime ? new Date(subjectScoreStartTime).toISOString() : null,
        subject_score_end_time: subjectScoreEndTime ? new Date(subjectScoreEndTime).toISOString() : null,
        subject_score_enabled: subjectScoreEnabled,
        system_start_time: systemStartTime ? new Date(systemStartTime).toISOString() : null,
        system_end_time: systemEndTime ? new Date(systemEndTime).toISOString() : null,
        system_enabled: systemEnabled
      };
      
      // Try update first
      const { data: existing } = await supabase.from('survey_config').select('id').limit(1).maybeSingle();
      
      let error;
      if (existing) {
        const res = await supabase.from('survey_config').update(payload).eq('id', existing.id);
        if (res.error && (res.error.message.includes('subject_score_enabled') || res.error.message.includes('system_enabled') || res.error.message.includes('column'))) {
           console.warn('survey_config columns missing, retrying without new ones');
           delete payload.subject_score_enabled;
           delete payload.system_enabled;
           delete payload.system_start_time;
           delete payload.system_end_time;
           const retryRes = await supabase.from('survey_config').update(payload).eq('id', existing.id);
           error = retryRes.error;
        } else {
           error = res.error;
        }
      } else {
        const res = await supabase.from('survey_config').insert([payload]);
        if (res.error && (res.error.message.includes('subject_score_enabled') || res.error.message.includes('system_enabled') || res.error.message.includes('column'))) {
            console.warn('survey_config columns missing, retrying without new ones');
            delete payload.subject_score_enabled;
            delete payload.system_enabled;
            delete payload.system_start_time;
            delete payload.system_end_time;
            const retryRes = await supabase.from('survey_config').insert([payload]);
            error = retryRes.error;
        } else {
            error = res.error;
        }
      }

      if (error) throw new Error(error.message);
      setMessage('設定已成功儲存！');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error(err);
      setError('儲存失敗：' + (err.message || '未知錯誤'));
      if (err.message?.includes('relation "survey_config" does not exist')) {
        setError('請先在 Supabase 建立 survey_config 資料表。');
      }
    } finally {
      setLoading(false);
    }
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

  const fetchAllData = async (tableName: string) => {
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase.from(tableName).select('*').range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) throw new Error(error.message);
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        page++;
        if (data.length < pageSize) hasMore = false;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error("Supabase is not configured");
      
      const [fullData, skipData] = await Promise.all([
        fetchAllData('survey_responses_full'),
        fetchAllData('survey_responses_skip_ranking')
      ]);
      
      const combined = [...(fullData || []), ...(skipData || [])].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setData(combined);
      setFullDataList((fullData || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setSkipDataList((skipData || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (err: any) {
      console.error(err);
      setError('獲取資料失敗：' + (err.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (data.length === 0) return;

    const headers = [
      '填寫時間', '會考年度', '招生區', '身分', 
      '國文', '數學', '英文', '社會', '自然', '作文',
      '最小比率(%)', '最大比率(%)', '最小區間', '最大區間', 'Email', '邀請碼'
    ];

    const generateRow = (row: any) => [
      new Date(row.timestamp).toLocaleString('zh-TW'),
      row.examYear,
      row.region,
      row.identity,
      row.chineseScore,
      row.mathScore,
      row.englishScore,
      row.socialScore,
      row.scienceScore,
      row.essayScore,
      row.minRatio || '',
      row.maxRatio || '',
      row.minRankInterval || '',
      row.maxRankInterval || '',
      row.email,
      row.inviteCode || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');

    const csvContent = [
      headers.join(','),
      ...data.map(generateRow)
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `會考落點分析_問卷資料_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setData([]);
    setFullDataList([]);
    setSkipDataList([]);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[100dvh] bg-slate-100 font-sans flex flex-col relative w-full pt-16 sm:pt-24 pb-12">
        <Header onShareClick={() => {}} />
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
                  type="password"
                  placeholder="請輸入管理密碼 (預設: admin123)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border-2 border-slate-300 p-3 font-bold focus:border-slate-900 focus:outline-none text-sm sm:text-base"
                />
              </div>
              {error && <p className="text-red-500 font-bold text-sm tracking-wide">{error}</p>}
              <button type="submit" className="w-full bg-emerald-400 border-2 border-slate-900 py-3 font-black text-slate-900 shadow-[4px_4px_0_#0F172A] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                登入系統
              </button>
            </form>
          </div>
          <div className="mt-8 text-slate-500 text-sm font-bold tracking-wider relative z-10">
            &copy; 2026 全國會考分析系統 版權所有
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats
  const totalSubmissions = data.length;
  
  // Data aggregation for charts
  const regionCounts = data.reduce((acc, curr) => {
    acc[curr.region] = (acc[curr.region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const regionChartData = Object.keys(regionCounts).map(key => ({ name: key, count: regionCounts[key] })).sort((a,b)=> b.count - a.count);

  const identityCounts = data.reduce((acc, curr) => {
    const id = curr.identity || '未提供';
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const identityChartData = Object.keys(identityCounts).map(key => ({ name: key, count: identityCounts[key] }));

  const scoreMap: Record<string, number> = {'A++': 7, 'A+': 6, 'A': 5, 'B++': 4, 'B+': 3, 'B': 2, 'C': 1, '': 0};
  const totalScoreCounts = data.reduce((acc, curr) => {
    const points = (scoreMap[curr.chineseScore || ''] || 0) + 
                   (scoreMap[curr.mathScore || ''] || 0) + 
                   (scoreMap[curr.englishScore || ''] || 0) + 
                   (scoreMap[curr.socialScore || ''] || 0) + 
                   (scoreMap[curr.scienceScore || ''] || 0);
    let rangeLabel = '未完整填寫';
    if (points > 0) {
      const lower = Math.floor(points / 5) * 5;
      const upper = lower + 4;
      rangeLabel = `${lower}-${upper} 積分`;
    }
    acc[rangeLabel] = (acc[rangeLabel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const totalScoreChartData = Object.keys(totalScoreCounts)
    .map(key => ({ name: key, count: totalScoreCounts[key] }))
    .sort((a, b) => {
      if (a.name === '未完整填寫') return 1;
      if (b.name === '未完整填寫') return -1;
      const aVal = parseInt(a.name.split('-')[0]) || 0;
      const bVal = parseInt(b.name.split('-')[0]) || 0;
      return bVal - aVal;
    });

  const dailyCounts = data.reduce((acc, curr) => {
    const dateStr = new Date(curr.timestamp).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
    acc[dateStr] = (acc[dateStr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const dailyTrendData = Object.keys(dailyCounts)
    .map(key => ({ date: key, count: dailyCounts[key] }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Header onShareClick={() => {}} />
      <div className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3 text-slate-900">
            <LayoutDashboard className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            管理員分析看板
          </h1>
          <div className="flex flex-wrap gap-2 sm:gap-4 w-full sm:w-auto">
            <button 
              onClick={() => window.open(window.location.pathname + '#/', '_blank')}
              className="flex-1 sm:flex-none px-4 py-2 border-2 border-slate-900 bg-sky-200 font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none transition-all text-slate-900"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="hidden sm:inline">檢視前台</span>
              <span className="sm:hidden">前台</span>
            </button>
            <button 
              onClick={exportToCSV} 
              disabled={data.length === 0}
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
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '重新載入'}
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
            <span className="sm:ml-auto text-sm mt-2 sm:mt-0 text-right">
              提示：確認 Supabase 設定與資料表權限<br/>
              若是設定儲存失敗，請確認 survey_config 資料表是否開啟且包含以下欄位:<br/>
              subject_score_start_time (timestamptz), subject_score_end_time (timestamptz), subject_score_enabled (boolean)<br/>
              system_start_time (timestamptz), system_end_time (timestamptz), system_enabled (boolean)
            </span>
          </div>
        )}

        {message && (
          <div className="bg-emerald-50 text-emerald-800 p-4 border-2 border-emerald-500 font-bold mb-6">
            {message}
          </div>
        )}

        <div className="flex border-b-2 border-slate-300 mb-8 overflow-x-auto whitespace-nowrap">
          {[
            { id: 'overview', label: '分析圖表' },
            { id: 'full', label: '完整填寫資料' },
            { id: 'skip', label: '無序位填寫資料' },
            { id: 'settings', label: '系統設定與自訂問卷' },
            { id: 'logs', label: '系統安全與日誌' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-bold text-sm sm:text-base border-b-4 transition-colors ${activeTab === tab.id ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] p-6">
                <p className="text-slate-500 font-bold text-xs sm:text-sm tracking-widest uppercase mb-2 flex items-center">
                  <Users className="w-4 h-4 mr-2" /> 總提交筆數
                </p>
                <p className="text-4xl sm:text-5xl font-black text-slate-900">{totalSubmissions}</p>
              </div>
              <div className="bg-white border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] p-6">
                <p className="text-slate-500 font-bold text-xs sm:text-sm tracking-widest uppercase mb-2 flex items-center">
                  <ClipboardList className="w-4 h-4 mr-2" /> 完整序位筆數
                </p>
                <p className="text-4xl sm:text-5xl font-black text-slate-900">{fullDataList.length}</p>
              </div>
              <div className="bg-white border-2 border-slate-900 shadow-[4px_4px_0_#0F172A] p-6">
                <p className="text-slate-500 font-bold text-xs sm:text-sm tracking-widest uppercase mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" /> 今日新增筆數
                </p>
                <p className="text-4xl sm:text-5xl font-black text-slate-900">
                  {data.filter(d => new Date(d.timestamp).toDateString() === new Date().toDateString()).length}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div className="bg-white border-2 border-slate-900 p-4 sm:p-6 shadow-[4px_4px_0_#0F172A]">
                <h3 className="text-lg sm:text-xl font-bold mb-6 flex items-center pb-2 border-b-2 border-slate-100">
                  <MapPin className="w-5 h-5 mr-2 text-rose-500" />
                  各區填寫人數分佈
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
                <input
                  type="text"
                  placeholder="搜尋資料..."
                  value={tableSearch}
                  onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(1); }}
                  className="border-2 border-slate-300 px-3 py-1 text-sm focus:border-slate-900 focus:outline-none"
                />
                <select
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
              const baseData = activeTab === 'full' ? fullDataList : skipDataList;
              const filteredData = baseData.filter(row => {
                if (!tableSearch) return true;
                const searchStr = `${row.region} ${row.identity} ${row.examYear} ${row.chineseScore} ${row.mathScore} ${row.englishScore} ${row.socialScore} ${row.scienceScore} ${row.email || ''}`.toLowerCase();
                return searchStr.includes(tableSearch.toLowerCase());
              });

              const sortedData = [...filteredData].sort((a, b) => {
                if (!sortConfig) return 0;
                
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                
                if (sortConfig.key === 'timestamp') {
                  valA = new Date(a.timestamp).getTime();
                  valB = new Date(b.timestamp).getTime();
                } else if (sortConfig.key === 'totalScore') {
                  const scoreMap: Record<string, number> = {'A++': 7, 'A+': 6, 'A': 5, 'B++': 4, 'B+': 3, 'B': 2, 'C': 1, '': 0};
                  const getPoints = (s: any) => (scoreMap[s?.chineseScore || ''] || 0) + (scoreMap[s?.mathScore || ''] || 0) + (scoreMap[s?.englishScore || ''] || 0) + (scoreMap[s?.socialScore || ''] || 0) + (scoreMap[s?.scienceScore || ''] || 0);
                  valA = getPoints(a);
                  valB = getPoints(b);
                } else if (sortConfig.key === 'examYear') {
                  valA = parseInt(a.examYear || '0', 10);
                  valB = parseInt(b.examYear || '0', 10);
                }
                
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
              });

              const totalPages = Math.ceil(sortedData.length / rowsPerPage) || 1;
              const startIndex = (currentPage - 1) * rowsPerPage;
              const paginatedData = sortedData.slice(startIndex, startIndex + rowsPerPage);

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
                          </tr>
                        ))}
                        {paginatedData.length === 0 && (
                          <tr>
                            <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-bold">
                              目前尚無資料
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="p-4 sm:p-5 border-t-2 border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
                    <span className="text-sm font-bold text-slate-600">
                      顯示 {filteredData.length === 0 ? 0 : startIndex + 1} 到 {Math.min(startIndex + rowsPerPage, filteredData.length)} 筆，共 {filteredData.length} 筆
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 font-bold text-sm bg-white border-2 border-slate-300 rounded hover:border-slate-900 disabled:opacity-50 disabled:hover:border-slate-300 transition-colors"
                      >
                        上一頁
                      </button>
                      <span className="px-3 py-1 font-bold text-sm text-slate-700 flex items-center">
                        第 {currentPage} / {totalPages} 頁
                      </span>
                      <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
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
          <div className="space-y-8 mb-12">
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
                          type="datetime-local" 
                          value={systemStartTime} 
                          onChange={(e) => setSystemStartTime(e.target.value)}
                          className="border-2 border-slate-200 p-3 w-full focus:border-slate-900 focus:outline-none bg-white font-mono text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-slate-500 mb-1">開放結束時間</label>
                        <input 
                          type="datetime-local" 
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
                <input 
                  type="datetime-local" 
                  value={announcementDate} 
                  onChange={(e) => setAnnouncementDate(e.target.value)}
                  className="border-2 border-slate-300 p-3 w-full sm:w-auto focus:border-slate-900 focus:outline-none"
                />
                <p className="text-sm text-slate-500 mt-2">在公告時間之前，系統會強制關閉「填寫序位資訊」功能，讓使用者直接獲取邀請碼。</p>
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
                          type="datetime-local" 
                          value={subjectScoreStartTime} 
                          onChange={(e) => setSubjectScoreStartTime(e.target.value)}
                          className="border-2 border-slate-300 p-3 w-full focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm text-slate-500 mb-1">開放結束時間</label>
                        <input 
                          type="datetime-local" 
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
              <div className="flex items-center justify-between mb-6 pb-2 border-b-2 border-slate-100">
                <h3 className="text-xl font-bold flex items-center">自訂問卷題目</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowPreviewModal(true)}
                    className="px-4 py-2 border-2 border-slate-900 bg-white text-slate-900 font-bold text-sm flex items-center justify-center gap-2 shadow-[2px_2px_0_#0F172A] hover:translate-y-0.5 hover:shadow-none transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">表單預覽</span>
                  </button>
                  <button 
                    onClick={addCustomQuestion}
                    className="px-4 py-2 bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-colors shadow-[2px_2px_0_#34D399]"
                  >
                    + 新增題目
                  </button>
                </div>
              </div>
              
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
                            type="datetime-local" 
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
                            type="datetime-local" 
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
            
            <div className="pt-4 border-t-4 border-slate-900">
              <button 
                onClick={saveSettings}
                className="w-full py-4 bg-emerald-400 text-slate-900 font-black text-xl border-2 border-slate-900 shadow-[6px_6px_0_#0F172A] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : null}
                儲存所有設定
              </button>
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
              <span>近期登入紀錄 (以資料庫時區為準)</span>
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
                        <span className={`px-2 py-1 rounded text-xs ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700">{log.ip_address || 'unknown'}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 overflow-hidden text-ellipsis max-w-[200px]" title={log.user_agent}>
                        {log.user_agent || 'unknown'}
                      </td>
                    </tr>
                  ))}
                  {adminLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-bold">
                        目前尚無登入紀錄
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-slate-500 font-bold">
               備註：密碼與日誌功能需要正確部署 <code>supabase_schema.sql</code> 內的 RPC 方法才能生效。若未設定，系統僅能以前端寫死密碼登入。
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
                  
                  <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-slate-100">
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
                        {announcementDate ? new Date(announcementDate).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未設定'}
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 border-2 border-slate-200 p-4">
                      <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">系統總開放期間</p>
                      <p className="font-bold text-slate-900 text-sm leading-tight">
                        <span className="text-slate-500 inline-block w-6">起</span> {systemStartTime ? new Date(systemStartTime).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '不限'}<br/>
                        <span className="text-slate-500 inline-block w-6 text-xs mt-1">迄</span> {systemEndTime ? new Date(systemEndTime).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '不限'}
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
                            <span className="font-bold text-slate-900 text-sm">{subjectScoreStartTime ? new Date(subjectScoreStartTime).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '不限'}</span>
                          </div>
                          <div className="flex-1">
                            <span className="text-slate-400 text-xs font-bold mr-2">END</span>
                            <span className="font-bold text-slate-900 text-sm">{subjectScoreEndTime ? new Date(subjectScoreEndTime).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '不限'}</span>
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
                                  {q.startTime && <span>{new Date(q.startTime).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 起</span>}
                                  {q.startTime && q.endTime && <span className="mx-1">~</span>}
                                  {q.endTime && <span>{new Date(q.endTime).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} 止</span>}
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

      {/* Footer / Copyright */}
      <footer className="mt-12 py-8 border-t-2 border-slate-200 text-center">
        <p className="text-slate-500 font-bold text-sm tracking-wider">
          &copy; 2026 全國會考分析系統 版權所有 All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
