import { splitMathContent } from '../src/lib/mathMarkup';
import { gradeCapturedAnswer } from '../src/services/gradingService';
import { GeneratedProblem } from '../src/api/genStudyApi';

const problem: GeneratedProblem = {
  answer: '$\\frac{2}{3}$',
  explanation: '固定点との差を取る。',
  problem: '確率 $p_n$ の極限を求めよ。',
  raw: {},
  source: 'api',
  title: '確率漸化式',
};

test('splits display TeX blocks from generated problem text', () => {
  const blocks = splitMathContent('問題文\n$$p_{n+1}=ap_n+b$$\n説明');

  expect(blocks).toEqual([
    { kind: 'text', value: '問題文' },
    { kind: 'math', value: 'p_{n+1}=ap_n+b' },
    { kind: 'text', value: '説明' },
  ]);
});

test('grades captured manual answer through service boundary', async () => {
  const result = await gradeCapturedAnswer(problem, {
    manualAnswer: '$\\frac{2}{3}$',
    ocrText: '$\\frac{2}{3}$',
  });

  expect(result.isCorrect).toBe(true);
  expect(result.provider).toBe('local-ai-simulator');
  expect(result.nextAction).toBe('next');
});
