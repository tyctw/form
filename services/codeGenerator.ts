import { UserFormData, AdminRecord, SystemConfig } from '../types';

// ⚠️ 請將下方的網址替換為您 Google Apps Script 部署後的 Web App URL
// Deploy setting: Execute as "Me", Who has access "Anyone"
const GAS_API_URL: string = "https://script.google.com/macros/s/AKfycbznN6ypeux2l8P_Ggs4GZeIL1rIML5HovN6rcQ_9A7DwAusJrjexnH611K-fG0KFG6l/exec";

/**
 * Helper to log actions with timestamp
 */
const logAction = (action: string, details?: any) => {
  const timestamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  const prefix = `[TW-App ${timestamp}]`;
  if (details) {
    console.log(`${prefix} ${action}`, details);
  } else {
    console.log(`${prefix} ${action}`);
  }
};

const logError = (action: string, error: any) => {
  const timestamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  console.error(`[TW-App ${timestamp}] ❌ ${action} Failed:`, error);
};

/**
 * Fetches the invitation code from the Google Apps Script backend.
 * STRICT MODE: If backend fails, throws error immediately to show backup link.
 */
export const fetchInviteCode = async (data: UserFormData): Promise<string> => {
  logAction('Starting invitation code generation...', { email: data.email, region: data.region });

  // 1. Check if API URL is configured
  if (!GAS_API_URL || GAS_API_URL.includes("YOUR_GOOGLE_SCRIPT_WEB_APP_URL")) {
    const errorMsg = "System Error: Backend API URL is not configured.";
    logError('fetchInviteCode', errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const params = new URLSearchParams();
    params.append('email', data.email);
    params.append('identity', data.identity);
    params.append('region', data.region);
    params.append('source', data.source);
    params.append('userAgent', navigator.userAgent);

    if (data.scores) {
      params.append('chinese', data.scores.chinese);
      params.append('math', data.scores.math);
      params.append('english', data.scores.english);
      params.append('social', data.scores.social);
      params.append('science', data.scores.science);
      params.append('composition', data.scores.composition);
      params.append('rankMinPercent', data.scores.rankMinPercent);
      params.append('rankMaxPercent', data.scores.rankMaxPercent);
      params.append('rankMin', data.scores.rankMin);
      params.append('rankMax', data.scores.rankMax);
    }

    logAction('Sending request to GAS...');
    
    // Add a timeout to prevent infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

    const response = await fetch(`${GAS_API_URL}?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    logAction('Received response from GAS', result);
    
    // Check for success and valid code
    if (result && result.invitationCode) {
      logAction('Code generated successfully', result.invitationCode);
      return result.invitationCode;
    } else if (result && result.error) {
      throw new Error(result.error);
    } else {
      throw new Error("Invalid response format: Missing invitationCode");
    }

  } catch (error) {
    logError('fetchInviteCode', error);
    // Crucial: Throw error to trigger SystemErrorModal in App.tsx
    throw error;
  }
};

/**
 * Fetches admin data from GAS.
 */
export const fetchAdminData = async (password: string): Promise<AdminRecord[]> => {
  logAction('Fetching admin data...');

  if (GAS_API_URL.includes("YOUR_GOOGLE_SCRIPT_WEB_APP_URL")) {
    logAction('Using mock admin data');
    return new Promise(resolve => {
        setTimeout(() => {
             resolve(generateMockAdminData());
        }, 1000);
    });
  }

  try {
    const params = new URLSearchParams();
    params.append('action', 'getAdminData');
    params.append('password', password);

    const response = await fetch(`${GAS_API_URL}?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const result = await response.json();

    if (result.error) {
        logError('fetchAdminData (API Error)', result.error);
        throw new Error(result.error);
    }

    if (result.success && Array.isArray(result.data)) {
        logAction(`Successfully fetched ${result.data.length} records`);
        return result.data;
    } else {
        throw new Error("Invalid data format received");
    }
  } catch (error) {
    logError('fetchAdminData', error);
    throw error;
  }
};

/**
 * Update record status in GAS.
 */
export const updateRecordStatus = async (id: string, status: 'active' | 'expired', password: string): Promise<boolean> => {
    logAction(`Updating record status...`, { id, status });

    if (GAS_API_URL.includes("YOUR_GOOGLE_SCRIPT_WEB_APP_URL")) {
        return new Promise(resolve => setTimeout(() => resolve(true), 500));
    }

    try {
        const params = new URLSearchParams();
        params.append('action', 'updateStatus');
        params.append('id', id);
        params.append('status', status);
        params.append('password', password);

        const response = await fetch(`${GAS_API_URL}?${params.toString()}`, {
            method: 'GET',
            mode: 'cors',
        });

        if (!response.ok) throw new Error("Network response was not ok");

        const result = await response.json();
        const success = result.success === true;
        
        if (success) logAction(`Record ${id} status updated to ${status}`);
        else logError(`updateRecordStatus ${id}`, result);

        return success;
    } catch (error) {
        logError('updateRecordStatus', error);
        return false;
    }
};

/**
 * Fetch System Config (Start/End times for score entry)
 */
export const fetchSystemConfig = async (): Promise<SystemConfig> => {
    logAction('Fetching system config...');

    if (GAS_API_URL.includes("YOUR_GOOGLE_SCRIPT_WEB_APP_URL")) {
        // Mock: Retrieve from localStorage or return default
        const saved = localStorage.getItem('mockSystemConfig');
        if (saved) {
             logAction('Loaded mock config from localStorage');
             return JSON.parse(saved);
        }
        
        // Default: Open in future (2026) to demonstrate "closed" state initially, or set to now for testing.
        return {
            scoreEntryStart: "2024-05-20T00:00:00", 
            scoreEntryEnd: "2026-06-30T23:59:59"
        };
    }

    try {
        const params = new URLSearchParams();
        params.append('action', 'getConfig');
        const response = await fetch(`${GAS_API_URL}?${params.toString()}`, { method: 'GET', mode: 'cors' });
        if (!response.ok) throw new Error("Failed to fetch config");
        const result = await response.json();
        
        logAction('System config loaded', result.data);
        return result.data || { scoreEntryStart: "", scoreEntryEnd: "" };
    } catch (error) {
        logError('fetchSystemConfig', error);
        return { scoreEntryStart: "", scoreEntryEnd: "" };
    }
};

/**
 * Update System Config
 */
export const updateSystemConfig = async (config: SystemConfig, password: string): Promise<boolean> => {
    logAction('Updating system config...', config);

    if (GAS_API_URL.includes("YOUR_GOOGLE_SCRIPT_WEB_APP_URL")) {
        localStorage.setItem('mockSystemConfig', JSON.stringify(config));
        logAction('Mock config updated');
        return new Promise(resolve => setTimeout(() => resolve(true), 500));
    }

    try {
        const params = new URLSearchParams();
        params.append('action', 'updateConfig');
        params.append('password', password);
        params.append('scoreEntryStart', config.scoreEntryStart);
        params.append('scoreEntryEnd', config.scoreEntryEnd);
        
        const response = await fetch(`${GAS_API_URL}?${params.toString()}`, { method: 'GET', mode: 'cors' });
        if (!response.ok) throw new Error("Failed to update config");
        const result = await response.json();
        
        const success = result.success === true;
        if (success) logAction('System config updated successfully');
        else logError('updateSystemConfig', result);
        
        return success;
    } catch (error) {
        logError('updateSystemConfig', error);
        return false;
    }
};

export const getFormattedDate = (): string => {
  return new Date().toLocaleString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getExpirationTime = (): string => {
  const now = new Date();
  const endOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 59, 59);
  return endOfHour.toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' });
};

export const getExpirationTimestamp = (): number => {
  const now = new Date();
  const endOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 59, 59);
  return endOfHour.getTime();
};

// Mock data generator for fallback (Only for Admin Panel Mocking)
const generateMockAdminData = (): AdminRecord[] => {
    const pick = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    const regions = ["基北區", "桃連區", "中投區", "竹苗區", "高雄區"];
    const identities = ["國九應屆考生", "學生家長", "學校教師"];
    const grades = ["A++", "A+", "A", "B++", "B+", "B", "C"];

    return Array.from({ length: 50 }).map((_, i) => {
      const hasScores = Math.random() > 0.3; // 70% have scores
      return {
        id: `REC-${2025000 + i}`,
        email: `user${2025000+i}@example.com`,
        identity: pick(identities),
        region: pick(regions),
        source: "Google 搜尋",
        code: `TW20250605-${1000+i}`,
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString('zh-TW'),
        status: (Math.random() > 0.2 ? 'active' : 'expired') as 'active' | 'expired',
        scores: hasScores ? {
            chinese: pick(grades),
            math: pick(grades),
            english: pick(grades),
            social: pick(grades),
            science: pick(grades),
            composition: pick(["6級分", "5級分", "4級分"]),
            rankMinPercent: (Math.random() * 5).toFixed(2),
            rankMaxPercent: (Math.random() * 5 + 5).toFixed(2),
            rankMin: Math.floor(Math.random() * 500).toString(),
            rankMax: Math.floor(Math.random() * 500 + 500).toString()
        } : undefined
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};