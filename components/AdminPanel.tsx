import React, { useState, useMemo, useEffect } from 'react';
import { ArrowRight, CheckCheck, RefreshCw, GraduationCap, X, PieChart, Activity, Calendar, Users, Copy, Clock } from './Icons';
import { fetchAdminData, updateRecordStatus, fetchSystemConfig, updateSystemConfig } from '../services/codeGenerator';
import { AdminRecord, SystemConfig } from '../types';

type TabType = 'dashboard' | 'users' | 'settings';

// --- Lightweight Chart Components (SVG) ---

const SimpleDonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  let cumulativePercent = 0;

  if (total === 0) return <div className="text-center text-slate-400 py-8">無數據</div>;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32 shrink-0">
        <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
          {data.map((slice, i) => {
            const percent = slice.value / total;
            const circumference = 2 * Math.PI * 40; // r=40
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const rotate = cumulativePercent * 360;
            cumulativePercent += percent;
            
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={slice.color}
                strokeWidth="20"
                strokeDasharray={strokeDasharray}
                transform={`rotate(${rotate} 50 50)`}
                className="transition-all duration-500 hover:opacity-80"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
            <span className="text-xl font-bold text-slate-700">{total}</span>
            <span className="text-[10px] text-slate-400">總計</span>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1">
        {data.map((slice, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }}></span>
            <span className="text-slate-600 truncate">{slice.label}</span>
            <span className="font-bold text-slate-800 ml-auto">{Math.round((slice.value/total)*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminPanel: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Management State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterIdentity, setFilterIdentity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof AdminRecord; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // UI State
  const [selectedRecord, setSelectedRecord] = useState<AdminRecord | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Settings State
  const [config, setConfig] = useState<SystemConfig>({ scoreEntryStart: '', scoreEntryEnd: '' });
  const [savingConfig, setSavingConfig] = useState(false);

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await fetchAdminData(password);
      const systemConfig = await fetchSystemConfig();
      setRecords(data);
      setConfig(systemConfig);
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error(err);
      if (err.message === "Invalid password") {
        setError("密碼錯誤，請重新輸入");
      } else {
        setError("連線失敗或系統異常，請稍後再試");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
        const data = await fetchAdminData(password);
        const systemConfig = await fetchSystemConfig();
        setRecords(data);
        setConfig(systemConfig);
    } catch (err) {
        console.error("Refresh failed", err);
    } finally {
        setLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingConfig(true);
      try {
          const success = await updateSystemConfig(config, password);
          if (success) {
              alert("設定已更新");
          } else {
              alert("更新失敗");
          }
      } catch (err) {
          console.error("Save config failed", err);
          alert("發生錯誤");
      } finally {
          setSavingConfig(false);
      }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setProcessingId(id);
    const newStatus = currentStatus === 'active' ? 'expired' : 'active';
    try {
        const success = await updateRecordStatus(id, newStatus, password);
        if (success) {
            setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
            if (selectedRecord && selectedRecord.id === id) {
                setSelectedRecord(prev => prev ? { ...prev, status: newStatus } : null);
            }
        } else {
            alert("更新失敗，請檢查網路或權限");
        }
    } catch (err) {
        console.error("Status update failed", err);
        alert("更新發生錯誤");
    } finally {
        setProcessingId(null);
    }
  };

  const handleSort = (key: keyof AdminRecord) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      // Optional: Toast notification could go here
  };

  // --- Derived Data for Filters and Charts ---

  const availableRegions = useMemo(() => Array.from(new Set(records.map(r => r.region))), [records]);
  const availableIdentities = useMemo(() => Array.from(new Set(records.map(r => r.identity))), [records]);

  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.email.toLowerCase().includes(lowerTerm) || 
        r.code.toLowerCase().includes(lowerTerm) ||
        r.id.toLowerCase().includes(lowerTerm)
      );
    }
    if (filterRegion !== 'all') {
      result = result.filter(r => r.region === filterRegion);
    }
    if (filterIdentity !== 'all') {
      result = result.filter(r => r.identity === filterIdentity);
    }
    if (filterStatus !== 'all') {
        result = result.filter(r => r.status === filterStatus);
    }
    if (sortConfig) {
      result.sort((a, b) => {
        // @ts-ignore
        const aValue = a[sortConfig.key];
        // @ts-ignore
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [records, searchTerm, filterRegion, filterIdentity, filterStatus, sortConfig]);

  const totalPages = Math.ceil(filteredAndSortedRecords.length / itemsPerPage);
  const paginatedRecords = filteredAndSortedRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // --- Dashboard Stats Calculations ---
  
  const stats = useMemo(() => {
      // Basic Counts
      const totalUsers = records.length;
      const activeCodes = records.filter(r => r.status === 'active').length;
      
      const today = new Date().toDateString();
      const todayCount = records.filter(r => {
           // Handle various timestamp formats, robust parsing
           const d = new Date(r.timestamp);
           return !isNaN(d.getTime()) && d.toDateString() === today;
      }).length;

      // Charts Data
      // 1. Region Distribution
      const regionCounts: Record<string, number> = {};
      records.forEach(r => regionCounts[r.region] = (regionCounts[r.region] || 0) + 1);
      const regionData = Object.entries(regionCounts)
          .map(([label, value], i) => ({ 
              label, 
              value, 
              color: ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][i % 6] 
          }))
          .sort((a, b) => b.value - a.value);

      // 2. Identity Distribution
      const identityCounts: Record<string, number> = {};
      records.forEach(r => identityCounts[r.identity] = (identityCounts[r.identity] || 0) + 1);
      const identityData = Object.entries(identityCounts)
          .map(([label, value], i) => ({
               label, 
               value,
               color: ['#6366f1', '#ec4899', '#14b8a6', '#f97316'][i % 4]
          }))
          .sort((a, b) => b.value - a.value);

      // 3. Grades (Score Validated)
      const subjects = ['chinese', 'math', 'english', 'social', 'science'] as const;
      const grades = ["A++", "A+", "A", "B++", "B+", "B", "C"];
      let totalWithScores = 0;
      const gradeDist: Record<string, Record<string, number>> = {};
      
      subjects.forEach(sub => {
        gradeDist[sub] = {};
        grades.forEach(g => gradeDist[sub][g] = 0);
      });

      // 4. Rank Buckets
      const rankPercentBuckets = [
          { label: '0 - 1%', max: 1, count: 0, color: '#f43f5e' },
          { label: '1.01 - 2%', max: 2, count: 0, color: '#f97316' },
          { label: '2.01 - 5%', max: 5, count: 0, color: '#eab308' },
          { label: '5.01 - 10%', max: 10, count: 0, color: '#84cc16' },
          { label: '> 10%', max: Infinity, count: 0, color: '#10b981' }
      ];
      
      const rankCountBuckets = [
          { label: '0 - 500', max: 500, count: 0, color: '#6366f1' },
          { label: '501 - 1000', max: 1000, count: 0, color: '#8b5cf6' },
          { label: '1001 - 2000', max: 2000, count: 0, color: '#d946ef' },
          { label: '2001 - 4000', max: 4000, count: 0, color: '#ec4899' },
          { label: '> 4000', max: Infinity, count: 0, color: '#64748b' }
      ];

      records.forEach(r => {
          if (r.scores) {
             // 判斷是否為有效成績 (排除預設值 '1'，因預設 '1' 不在 grades 選項中，但為了保險起見，我們檢查 chinese 是否為 '1')
             // 前端 ApplicationForm.tsx 中的 defaultScoreData 將 chinese 設為 '1'
             if (r.scores.chinese === '1') return;

             let hasValidScore = false;
             subjects.forEach(sub => {
                 // @ts-ignore
                 const grade = r.scores[sub];
                 if (grade && gradeDist[sub][grade] !== undefined) {
                     gradeDist[sub][grade]++;
                     hasValidScore = true;
                 }
             });
             if (hasValidScore) totalWithScores++;

             // Calculate Rank Stats
             const p = parseFloat(r.scores.rankMinPercent);
             if (!isNaN(p)) {
                 const b = rankPercentBuckets.find(bucket => p <= bucket.max);
                 if (b) b.count++;
             }

             const c = parseInt(r.scores.rankMin);
             if (!isNaN(c)) {
                 const b = rankCountBuckets.find(bucket => c <= bucket.max);
                 if (b) b.count++;
             }
          }
      });

      return { totalUsers, activeCodes, todayCount, regionData, identityData, totalWithScores, gradeDist, rankPercentBuckets, rankCountBuckets };
  }, [records]);


  const handleExportCSV = () => {
    const headers = ['ID', 'Email', '身分', '考區', '來源', '邀請碼', '申請時間', '狀態', '國文', '英文', '數學', '自然', '社會', '作文'];
    const csvContent = [
      headers.join(','),
      ...records.map(r => [
        r.id, 
        r.email, 
        r.identity, 
        `"${r.region}"`,
        r.source, 
        r.code, 
        r.timestamp, 
        r.status,
        r.scores?.chinese || '-',
        r.scores?.english || '-',
        r.scores?.math || '-',
        r.scores?.science || '-',
        r.scores?.social || '-',
        r.scores?.composition || '-'
      ].join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `export_users_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- System Status Calculation ---
  const isSystemOpen = useMemo(() => {
    if (!config.scoreEntryStart) return false;
    const now = new Date();
    const start = new Date(config.scoreEntryStart);
    const end = config.scoreEntryEnd ? new Date(config.scoreEntryEnd) : null;
    
    if (isNaN(start.getTime())) return false;
    if (now < start) return false;
    if (end && !isNaN(end.getTime()) && now > end) return false;
    
    return true;
  }, [config]);

  const formatDisplayDate = (dateStr: string) => {
      if (!dateStr) return '尚未設定';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '格式錯誤';
      return d.toLocaleString('zh-TW', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
      });
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-white/50 p-8 md:p-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-slate-200">
             <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">管理員登入</h2>
          <p className="text-slate-500 text-sm mt-1">請輸入管理密碼以存取後台</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">管理密碼</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-14 w-full rounded-2xl border-0 bg-white px-5 py-3 text-base text-slate-800 shadow-sm ring-1 ring-slate-100 focus:ring-2 focus:ring-slate-400 focus:outline-none transition-all"
              placeholder="••••••••"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs font-bold ml-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-700 shadow-lg shadow-slate-300 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>登入系統</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  // --- Main Admin UI ---
  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
             <span className="bg-slate-100 p-2 rounded-lg">📊</span>
             後台管理系統
           </h2>
           <p className="text-slate-500 text-sm mt-1 ml-1 flex items-center gap-2">
             資料同步時間: <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{new Date().toLocaleTimeString('zh-TW')}</span>
           </p>
        </div>
        <div className="flex gap-3">
            <button 
             onClick={handleRefresh}
             className="p-3 bg-white text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-cyan-200 hover:text-cyan-600 transition-all shadow-sm"
             title="重新整理"
           >
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
           <button 
             onClick={handleExportCSV}
             className="px-5 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl font-bold hover:bg-emerald-100 transition-colors flex items-center gap-2"
           >
             <CheckCheck className="w-4 h-4" />
             匯出報表
           </button>
           <button 
             onClick={() => {
                 setIsAuthenticated(false);
                 setPassword('');
                 setRecords([]);
             }}
             className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
           >
             登出
           </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-2 bg-slate-100/50 p-1.5 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <PieChart className="w-4 h-4" />
            數據儀表板
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users className="w-4 h-4" />
            使用者管理
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-white shadow-sm text-cyan-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Calendar className="w-4 h-4" />
            系統設定
          </button>
      </div>

      {/* === DASHBOARD TAB === */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
            
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">總申請人數</p>
                        <p className="text-4xl font-black text-slate-800">{stats.totalUsers}</p>
                    </div>
                    <div className="absolute right-4 top-4 bg-blue-50 p-3 rounded-2xl text-blue-500">
                        <Users className="w-6 h-6" />
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-50 rounded-full blur-2xl group-hover:bg-blue-100 transition-colors"></div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">有效邀請碼</p>
                        <p className="text-4xl font-black text-emerald-600">{stats.activeCodes}</p>
                    </div>
                    <div className="absolute right-4 top-4 bg-emerald-50 p-3 rounded-2xl text-emerald-500">
                        <CheckCheck className="w-6 h-6" />
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-50 rounded-full blur-2xl group-hover:bg-emerald-100 transition-colors"></div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-slate-500 text-sm font-bold mb-1">今日新增</p>
                        <p className="text-4xl font-black text-cyan-600">{stats.todayCount}</p>
                    </div>
                    <div className="absolute right-4 top-4 bg-cyan-50 p-3 rounded-2xl text-cyan-500">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-cyan-50 rounded-full blur-2xl group-hover:bg-cyan-100 transition-colors"></div>
                </div>
            </div>

            {/* Middle Row: Distributions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Region Distribution */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-500" />
                        考區分佈
                    </h3>
                    <SimpleDonutChart data={stats.regionData.slice(0, 5)} />
                </div>

                 {/* Identity Distribution */}
                 <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                         <Users className="w-5 h-5 text-pink-500" />
                         申請身分比例
                     </h3>
                     <div className="space-y-4">
                         {stats.identityData.map((item, i) => (
                             <div key={i} className="group">
                                 <div className="flex justify-between text-sm mb-1">
                                     <span className="font-medium text-slate-600">{item.label}</span>
                                     <span className="font-bold text-slate-800">{item.value} 人</span>
                                 </div>
                                 <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${(item.value / stats.totalUsers) * 100}%`, backgroundColor: item.color }}
                                     ></div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
            </div>
            
            {/* Rank Statistics Row (New) */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rank Percent Distribution */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                         <Activity className="w-5 h-5 text-orange-500" />
                         序位比率區間 (PR)
                     </h3>
                     <div className="space-y-4">
                         {stats.rankPercentBuckets.map((item, i) => (
                             <div key={i} className="group">
                                 <div className="flex justify-between text-sm mb-1">
                                     <span className="font-medium text-slate-600">{item.label}</span>
                                     <span className="font-bold text-slate-800">{item.count} 人</span>
                                 </div>
                                 <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${stats.totalWithScores > 0 ? (item.count / stats.totalWithScores) * 100 : 0}%`, backgroundColor: item.color }}
                                     ></div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>

                 {/* Rank Count Distribution */}
                 <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                         <Activity className="w-5 h-5 text-indigo-500" />
                         序位人數區間 (Rank)
                     </h3>
                     <div className="space-y-4">
                         {stats.rankCountBuckets.map((item, i) => (
                             <div key={i} className="group">
                                 <div className="flex justify-between text-sm mb-1">
                                     <span className="font-medium text-slate-600">{item.label}</span>
                                     <span className="font-bold text-slate-800">{item.count} 人</span>
                                 </div>
                                 <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${stats.totalWithScores > 0 ? (item.count / stats.totalWithScores) * 100 : 0}%`, backgroundColor: item.color }}
                                     ></div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>

             {/* Bottom Row: Score Stats */}
             <div className="grid grid-cols-1 gap-6">
                 {/* Grade Distribution Overview */}
                 <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                     <div className="flex justify-between items-center mb-6">
                         <h3 className="font-bold text-slate-800 flex items-center gap-2">
                             <GraduationCap className="w-5 h-5 text-yellow-500" />
                             成績填寫概況
                         </h3>
                         <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-bold">
                            有效樣本: {stats.totalWithScores}
                         </span>
                     </div>
                     <div className="grid grid-cols-5 gap-2 items-end h-40">
                         {Object.entries(stats.gradeDist).map(([subject, grades], i) => {
                             // Calculate A++/A+ percentage for simple bar visualization
                             const totalSubject = Object.values(grades).reduce((a, b) => a + b, 0);
                             const topTier = (grades['A++'] || 0) + (grades['A+'] || 0);
                             const percent = totalSubject > 0 ? (topTier / totalSubject) * 100 : 0;
                             
                             return (
                                 <div key={subject} className="flex flex-col items-center gap-2 h-full justify-end group cursor-pointer">
                                     <div className="relative w-full mx-2 bg-slate-100 rounded-t-xl overflow-hidden h-full">
                                         <div 
                                            className="absolute bottom-0 w-full bg-cyan-400 transition-all duration-700 group-hover:bg-cyan-500"
                                            style={{ height: `${percent}%` }}
                                         ></div>
                                         <div className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <span className="text-[10px] font-bold text-white drop-shadow-md">{Math.round(percent)}%</span>
                                         </div>
                                     </div>
                                     <span className="text-xs font-bold text-slate-500 capitalize">{subject === 'chinese' ? '國' : subject === 'math' ? '數' : subject === 'english' ? '英' : subject === 'social' ? '社' : '自'}</span>
                                 </div>
                             )
                         })}
                     </div>
                     <p className="text-center text-[10px] text-slate-400 mt-2">顯示各科 A+ 以上比例</p>
                 </div>
             </div>
        </div>
      )}

      {/* === USERS TAB === */}
      {activeTab === 'users' && (
        <>
            {/* Control Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="搜尋 Email、邀請碼或 ID..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-4 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-300 transition-all"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <select
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 text-slate-600 font-medium"
                    >
                        <option value="all">所有狀態</option>
                        <option value="active">有效</option>
                        <option value="expired">過期</option>
                    </select>
                    <select
                        value={filterRegion}
                        onChange={(e) => { setFilterRegion(e.target.value); setCurrentPage(1); }}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 text-slate-600 font-medium"
                    >
                        <option value="all">所有考區</option>
                        {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select
                        value={filterIdentity}
                        onChange={(e) => { setFilterIdentity(e.target.value); setCurrentPage(1); }}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-100 text-slate-600 font-medium"
                    >
                        <option value="all">所有身分</option>
                        {availableIdentities.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2">
                <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-800 font-bold uppercase text-xs tracking-wider">
                    <tr>
                        <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('id')}
                        >
                        ID {sortConfig?.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('email')}
                        >
                        使用者 {sortConfig?.key === 'email' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-4">考區 / 身分</th>
                        <th className="px-6 py-4">邀請碼</th>
                        <th 
                        className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort('status')}
                        >
                        狀態 {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-6 py-4 text-center">操作</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {paginatedRecords.length > 0 ? (
                        paginatedRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-cyan-50/30 transition-colors group">
                            <td className="px-6 py-4 font-mono text-slate-400 text-xs">{record.id}</td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="font-medium text-slate-900">{record.email}</div>
                                    <button onClick={() => copyToClipboard(record.email)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-cyan-500 transition-opacity" title="複製 Email">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">{record.timestamp}</div>
                            </td>
                            <td className="px-6 py-4">
                            <div className="text-slate-800 font-medium">{record.region}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{record.identity}</div>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-cyan-600">{record.code}</td>
                            <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                record.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                                {record.status === 'active' ? '有效' : '過期'}
                            </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                            <button 
                                onClick={() => setSelectedRecord(record)}
                                className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-bold text-slate-500 hover:text-cyan-600 hover:border-cyan-200 transition-all shadow-sm active:scale-95"
                            >
                                詳細資料
                            </button>
                            </td>
                        </tr>
                        ))
                    ) : (
                        <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                            查無符合資料
                        </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-bold text-slate-500 disabled:opacity-30 hover:text-cyan-600 transition-colors"
                    >
                    上一頁
                    </button>
                    <span className="text-xs font-medium text-slate-400">
                    第 {currentPage} 頁 / 共 {totalPages} 頁
                    </span>
                    <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-bold text-slate-500 disabled:opacity-30 hover:text-cyan-600 transition-colors"
                    >
                    下一頁
                    </button>
                </div>
                )}
            </div>
        </>
      )}

      {/* === SETTINGS TAB === */}
      {activeTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-right-2">
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-3xl mx-auto">
                  <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                      <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">系統參數設定</h3>
                        <p className="text-slate-400 text-sm">控制前端成績輸入欄位的開放時間</p>
                      </div>
                  </div>

                  {/* Current Status Display */}
                  <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                      <h4 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                             <Clock className="w-5 h-5 text-slate-400" />
                             目前設定狀態
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isSystemOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                              {isSystemOpen ? '🟢 開放填寫中' : '⚪ 未開放 / 已結束'}
                          </span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <span className="text-xs text-slate-400 block mb-1 font-bold uppercase tracking-wider">起始時間 (Start)</span>
                              <span className="font-mono font-bold text-slate-700 text-lg">
                                  {formatDisplayDate(config.scoreEntryStart)}
                              </span>
                          </div>
                          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <span className="text-xs text-slate-400 block mb-1 font-bold uppercase tracking-wider">結束時間 (End)</span>
                              <span className="font-mono font-bold text-slate-700 text-lg">
                                  {formatDisplayDate(config.scoreEntryEnd)}
                              </span>
                          </div>
                      </div>
                  </div>
                  
                  <form onSubmit={handleSaveConfig} className="space-y-8">
                      <div className="space-y-4">
                          <h4 className="font-bold text-slate-700 border-l-4 border-cyan-500 pl-3">更新成績填寫開放區間</h4>
                          <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                              設定開放時間後，前端頁面將依據此時間區間，自動判斷是否顯示「填寫成績」的步驟。
                              <br/>若當前時間在區間外，使用者將直接跳過成績填寫步驟並取得代碼 (成績預設為 1)。
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                  <label className="block text-sm font-bold text-slate-700">設定開始時間</label>
                                  <input 
                                      type="datetime-local" 
                                      value={config.scoreEntryStart}
                                      onChange={(e) => setConfig({...config, scoreEntryStart: e.target.value})}
                                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-cyan-200 focus:outline-none transition-all"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <label className="block text-sm font-bold text-slate-700">設定結束時間</label>
                                  <input 
                                      type="datetime-local" 
                                      value={config.scoreEntryEnd}
                                      onChange={(e) => setConfig({...config, scoreEntryEnd: e.target.value})}
                                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-cyan-200 focus:outline-none transition-all"
                                  />
                              </div>
                          </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100 flex justify-end">
                          <button 
                              type="submit"
                              disabled={savingConfig}
                              className="px-8 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors shadow-lg shadow-slate-300 disabled:opacity-50 flex items-center gap-2"
                          >
                              {savingConfig ? (
                                  <>
                                      <RefreshCw className="w-5 h-5 animate-spin" />
                                      <span>儲存中...</span>
                                  </>
                              ) : (
                                  <>
                                      <CheckCheck className="w-5 h-5" />
                                      <span>儲存設定</span>
                                  </>
                              )}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedRecord(null)}></div>
           <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              
              {/* Modal Header */}
              <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                 <div>
                   <h3 className="text-xl font-black text-slate-800">申請資料詳情</h3>
                   <p className="text-sm text-slate-400 font-mono mt-1">ID: {selectedRecord.id}</p>
                 </div>
                 <button 
                   onClick={() => setSelectedRecord(null)}
                   className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shadow-sm border border-slate-100"
                 >
                   <X className="w-5 h-5" />
                 </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="p-8 overflow-y-auto">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Basic Info */}
                    <div className="space-y-6">
                       <h4 className="font-bold text-slate-800 border-l-4 border-cyan-400 pl-3">基本資訊</h4>
                       <div className="space-y-4 text-sm">
                          <div>
                            <span className="block text-slate-400 text-xs mb-1">電子郵件</span>
                            <div className="font-medium text-slate-800 flex items-center gap-2">
                                {selectedRecord.email}
                                <button onClick={() => copyToClipboard(selectedRecord.email)} className="text-slate-300 hover:text-cyan-500"><Copy className="w-3.5 h-3.5"/></button>
                            </div>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-xs mb-1">申請身分</span>
                            <div className="font-medium text-slate-800">{selectedRecord.identity}</div>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-xs mb-1">會考考區</span>
                            <div className="font-medium text-slate-800">{selectedRecord.region}</div>
                          </div>
                          <div>
                            <span className="block text-slate-400 text-xs mb-1">邀請碼狀態</span>
                            <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    selectedRecord.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                    {selectedRecord.status === 'active' ? '有效' : '過期'}
                                </span>
                                <button 
                                    onClick={() => handleToggleStatus(selectedRecord.id, selectedRecord.status)}
                                    disabled={processingId === selectedRecord.id}
                                    className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                                >
                                    {processingId === selectedRecord.id ? '更新中...' : '變更狀態'}
                                </button>
                            </div>
                          </div>
                       </div>
                    </div>

                    {/* Scores Info */}
                    <div className="space-y-6">
                       <h4 className="font-bold text-slate-800 border-l-4 border-indigo-400 pl-3">成績與序位</h4>
                       {selectedRecord.scores ? (
                          <div className="grid grid-cols-2 gap-3">
                             {/* Grade Cards */}
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <span className="text-xs text-slate-400 block mb-1">國文</span>
                                <span className="font-bold text-slate-800 text-lg">{selectedRecord.scores.chinese}</span>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <span className="text-xs text-slate-400 block mb-1">英文</span>
                                <span className="font-bold text-slate-800 text-lg">{selectedRecord.scores.english}</span>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <span className="text-xs text-slate-400 block mb-1">數學</span>
                                <span className="font-bold text-slate-800 text-lg">{selectedRecord.scores.math}</span>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <span className="text-xs text-slate-400 block mb-1">自然</span>
                                <span className="font-bold text-slate-800 text-lg">{selectedRecord.scores.science}</span>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <span className="text-xs text-slate-400 block mb-1">社會</span>
                                <span className="font-bold text-slate-800 text-lg">{selectedRecord.scores.social}</span>
                             </div>
                             <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                <span className="text-xs text-slate-400 block mb-1">作文</span>
                                <span className="font-bold text-slate-800 text-lg">{selectedRecord.scores.composition}</span>
                             </div>

                             {/* Rank Info */}
                             <div className="col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mt-2">
                                <div className="grid grid-cols-2 gap-4">
                                   <div>
                                     <span className="text-xs text-indigo-400 block mb-1">序位比率區間</span>
                                     <span className="font-bold text-indigo-900">
                                       {selectedRecord.scores.rankMinPercent}% - {selectedRecord.scores.rankMaxPercent}%
                                     </span>
                                   </div>
                                   <div>
                                     <span className="text-xs text-indigo-400 block mb-1">序位人數區間</span>
                                     <span className="font-bold text-indigo-900">
                                       {selectedRecord.scores.rankMin} - {selectedRecord.scores.rankMax}
                                     </span>
                                   </div>
                                </div>
                             </div>
                          </div>
                       ) : (
                          <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm p-8">
                             此紀錄無詳細成績資料
                          </div>
                       )}
                    </div>

                 </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center">
                 <span className="text-xs font-mono font-bold text-cyan-600 bg-cyan-50 px-2 py-1 rounded">CODE: {selectedRecord.code}</span>
                 <button 
                   onClick={() => setSelectedRecord(null)}
                   className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
                 >
                   關閉
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};