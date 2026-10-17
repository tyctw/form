import type { QuestionnaireData } from '../types';

export function createSurveyPayload(
  data: QuestionnaireData,
  skipRanking: boolean,
  scoresActive: boolean,
  activeQuestionIds: string[],
) {
  return {
    region: data.region,
    examYear: data.examYear,
    identity: data.identity,
    email: data.email,
    skipRanking,
    chineseScore: scoresActive ? data.chineseScore : '',
    mathScore: scoresActive ? data.mathScore : '',
    englishScore: scoresActive ? data.englishScore : '',
    socialScore: scoresActive ? data.socialScore : '',
    scienceScore: scoresActive ? data.scienceScore : '',
    essayScore: scoresActive ? data.essayScore : '',
    ...(!skipRanking ? {
      minRatio: data.minRatio,
      maxRatio: data.maxRatio,
      minRankInterval: data.minRankInterval,
      maxRankInterval: data.maxRankInterval,
    } : {}),
    custom_answers: Object.fromEntries(activeQuestionIds
      .filter(id => Object.hasOwn(data.customAnswers, id))
      .map(id => [id, data.customAnswers[id]])),
  };
}
