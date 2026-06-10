import { GeneratedProblem } from '../api/genStudyApi';

export type CapturedAnswer = {
  imageDataUrl?: string;
  imageName?: string;
  manualAnswer: string;
  ocrText?: string;
};

export type GradingResult = {
  isCorrect: boolean;
  score: number;
  confidence: number;
  recognizedText: string;
  feedback: string;
  nextAction: 'next' | 'retry';
  provider: 'local-ai-simulator' | 'external-ai';
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/[（）]/g, match => (match === '（' ? '(' : ')'))
    .replace(/[−ー–—]/g, '-')
    .replace(/[，、]/g, ',');

const wait = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

export const gradeCapturedAnswer = async (
  problem: GeneratedProblem,
  answer: CapturedAnswer,
): Promise<GradingResult> => {
  await wait(650);

  const recognizedText = (answer.ocrText || answer.manualAnswer).trim();
  const normalizedRecognized = normalize(recognizedText);
  const normalizedAnswer = normalize(problem.answer);
  const isCorrect =
    normalizedRecognized.length > 0 &&
    (normalizedAnswer.includes(normalizedRecognized) ||
      normalizedRecognized.includes(normalizedAnswer));

  return {
    confidence: answer.imageDataUrl ? 0.72 : 0.58,
    feedback: isCorrect
      ? `AI採点シミュレーターは、提出答案が模範解答「${problem.answer}」と整合すると判定しました。次は途中式の妥当性をOCR/AI採点APIで確認する設計です。`
      : `AI採点シミュレーターは、提出答案と模範解答「${problem.answer}」の差分を検出しました。OCR結果と途中式を使い、誤りの位置を説明するAI採点へ接続します。`,
    isCorrect,
    nextAction: isCorrect ? 'next' : 'retry',
    provider: 'local-ai-simulator',
    recognizedText: recognizedText || 'OCR結果なし。手動入力で補完してください。',
    score: isCorrect ? 1 : 0,
  };
};
