import type { LearningScreenId } from './LearningAppScreen';

export const screenTitles: Record<LearningScreenId, string> = {
  camera: '解答を撮影',
  correct: '採点結果',
  grading: '採点中',
  home: 'ホーム',
  lock: 'ロック通知',
  mission: '今日のミッション',
  missionResult: 'ミッション結果',
  problem: '問題',
  retry: '再挑戦',
  settings: '設定',
  unlock: '解除完了',
  wrong: '採点結果',
};

const screenOrder: LearningScreenId[] = [
  'home',
  'lock',
  'mission',
  'problem',
  'camera',
  'grading',
  'correct',
  'wrong',
  'missionResult',
  'retry',
  'unlock',
  'settings',
];

export const learningScreenOptions = screenOrder.map(id => ({
  id,
  label: screenTitles[id],
}));
