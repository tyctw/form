export type SurveyKind = 'all' | 'full' | 'skip';
export type AdminFilters = {
  examYear: string;
  region: string;
  identity: string;
  startDate: string;
  endDate: string;
  ranking: SurveyKind;
  search: string;
};
export const EMPTY_ADMIN_FILTERS: AdminFilters = {
  examYear: '', region: '', identity: '', startDate: '', endDate: '', ranking: 'all', search: '',
};
export type AdminStats = {
  total: number; full: number; skip: number; today: number; valid: number;
  recentDays: { date: string; count: number }[];
  formStatus: { state: string; start?: string; end?: string; checkedAt?: string };
  regions: { name: string; count: number }[];
  identities: { name: string; count: number }[];
  scores: { name: string; count: number }[];
  days: { date: string; count: number }[];
  years: string[]; regionOptions: string[]; identityOptions: string[];
};
export const EMPTY_ADMIN_STATS: AdminStats = {
  total: 0, full: 0, skip: 0, today: 0, valid: 0, recentDays: [], formStatus: { state: "missing" },
  regions: [], identities: [], scores: [], days: [], years: [], regionOptions: [], identityOptions: [],
};

// All boundaries are resolved in PostgreSQL using Asia/Taipei, including the entire end date.
export function validateAdminFilters(filters: AdminFilters): string | null {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    return '開始日期不可晚於結束日期';
  }
  return null;
}
