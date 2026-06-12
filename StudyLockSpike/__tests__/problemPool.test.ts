import { GeneratedProblem } from '../src/api/genStudyApi';
import {
  clearPool,
  loadPool,
  poolSnapshot,
  prefetchProblems,
  setPoolStorageForTesting,
  takeNextProblem,
} from '../src/services/problemPool';

const makeProblem = (title: string): GeneratedProblem => ({
  answer: '$2$',
  explanation: '解説',
  problem: `${title} の問題文`,
  raw: {},
  source: 'api',
  title,
});

const config = { endpoint: 'https://example.com/generate', token: 'token' };
const request = { level: 'High School', subject: 'math', topic: 'quadratic' };

beforeEach(() => {
  const store = new Map<string, string>();
  setPoolStorageForTesting({
    getItem: key => store.get(key) ?? null,
    removeItem: key => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    },
  });
});

afterEach(() => {
  setPoolStorageForTesting(null);
});

test('prefetch stores generated problems and reports progress', async () => {
  const progress: number[] = [];
  const result = await prefetchProblems(config, request, 3, {
    generate: async () => makeProblem('確率漸化式'),
    onProgress: update => progress.push(update.completed),
  });

  expect(result.added).toBe(3);
  expect(result.errors).toEqual([]);
  expect(progress).toEqual([1, 2, 3]);
  expect(poolSnapshot().ready).toBe(3);
});

test('prefetch keeps completed problems when a later generation fails', async () => {
  let calls = 0;
  const result = await prefetchProblems(config, request, 3, {
    generate: async () => {
      calls += 1;
      if (calls === 2) {
        throw new Error('生成に失敗しました');
      }
      return makeProblem(`問題${calls}`);
    },
  });

  expect(result.added).toBe(2);
  expect(result.errors).toHaveLength(1);
  expect(poolSnapshot().ready).toBe(2);
});

test('takeNextProblem consumes stock in order and marks it used', async () => {
  await prefetchProblems(config, request, 2, {
    generate: async () => makeProblem(`問題${loadPool().length + 1}`),
  });

  const first = takeNextProblem();
  expect(first?.problem.title).toBe('問題1');
  expect(poolSnapshot().ready).toBe(1);
  expect(poolSnapshot().used).toBe(1);

  const second = takeNextProblem();
  expect(second?.problem.title).toBe('問題2');
  expect(takeNextProblem()).toBeNull();

  clearPool();
  expect(poolSnapshot().total).toBe(0);
});
