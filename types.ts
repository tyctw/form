
export interface ScoreData {
  chinese: string;
  math: string;
  english: string;
  social: string;
  science: string;
  composition: string;
  rankMinPercent: string;
  rankMaxPercent: string;
  rankMin: string;
  rankMax: string;
}

export interface UserFormData {
  email: string;
  identity: string;
  region: string;
  source: string;
  scores?: ScoreData;
}

export interface InvitationResult {
  code: string;
  generatedAt: string;
  expiresAt: string;
  expiresTimestamp: number;
}

export interface AdminRecord {
  id: string;
  email: string;
  identity: string;
  region: string;
  source: string;
  code: string;
  timestamp: string;
  status: 'active' | 'expired';
  scores?: ScoreData;
}

export interface SystemConfig {
  scoreEntryStart: string; // ISO Date string
  scoreEntryEnd: string;   // ISO Date string
}
