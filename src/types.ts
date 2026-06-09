export interface CustomQuestion {
  id: string;
  type: 'text' | 'radio' | 'checkbox';
  question: string;
  options?: string[];
  required: boolean;
  startTime?: string;
  endTime?: string;
}

export interface AppConfig {
  announcementDate: string;
  customQuestions: CustomQuestion[];
  subjectScoreStartTime?: string;
  subjectScoreEndTime?: string;
  subjectScoreEnabled?: boolean;
}

export interface QuestionnaireData {
  region: string;
  examYear: string;
  chineseScore: string;
  mathScore: string;
  englishScore: string;
  socialScore: string;
  scienceScore: string;
  essayScore: string;
  minRatio: string;
  maxRatio: string;
  minRankInterval: string;
  maxRankInterval: string;
  email: string;
  skipRanking: boolean;
  identity: string;
  customAnswers: Record<string, any>;
}

export type SubjectScore = 'A++' | 'A+' | 'A' | 'B++' | 'B+' | 'B' | 'C' | '';
export type EssayScoreType = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '';
