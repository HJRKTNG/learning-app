import {
  GeneratedProblem,
  GenerateProblemConfig,
  GenerateProblemRequest,
  generateStudyProblem,
} from '../api/genStudyApi';

export type StockedProblem = {
  id: string;
  problem: GeneratedProblem;
  request: GenerateProblemRequest;
  createdAt: string;
  used: boolean;
};

export type ProblemPoolSnapshot = {
  ready: number;
  used: number;
  total: number;
  entries: StockedProblem[];
};

export type PrefetchProgress = {
  completed: number;
  target: number;
  lastError?: string;
};

export type PrefetchResult = {
  added: number;
  errors: string[];
};

type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const POOL_STORAGE_KEY = 'studylock.problemPool.v1';

const memoryStore = new Map<string, string>();

const memoryStorage: KeyValueStorage = {
  getItem: key => memoryStore.get(key) ?? null,
  removeItem: key => {
    memoryStore.delete(key);
  },
  setItem: (key, value) => {
    memoryStore.set(key, value);
  },
};

let storageOverride: KeyValueStorage | null = null;

export const setPoolStorageForTesting = (storage: KeyValueStorage | null) => {
  storageOverride = storage;
};

const resolveStorage = (): KeyValueStorage => {
  if (storageOverride) {
    return storageOverride;
  }
  const candidate = (globalThis as { localStorage?: KeyValueStorage })
    .localStorage;
  if (candidate) {
    try {
      candidate.setItem('studylock.storageCheck', '1');
      candidate.removeItem('studylock.storageCheck');
      return candidate;
    } catch {
      return memoryStorage;
    }
  }
  return memoryStorage;
};

const isStockedProblem = (value: unknown): value is StockedProblem => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.used === 'boolean' &&
    !!record.problem &&
    typeof record.problem === 'object' &&
    !!record.request &&
    typeof record.request === 'object'
  );
};

export const loadPool = (): StockedProblem[] => {
  const raw = resolveStorage().getItem(POOL_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isStockedProblem);
  } catch {
    return [];
  }
};

const savePool = (entries: StockedProblem[]) => {
  resolveStorage().setItem(POOL_STORAGE_KEY, JSON.stringify(entries));
};

export const poolSnapshot = (): ProblemPoolSnapshot => {
  const entries = loadPool();
  const ready = entries.filter(entry => !entry.used).length;
  return {
    entries,
    ready,
    total: entries.length,
    used: entries.length - ready,
  };
};

let idCounter = 0;

const nextId = () => {
  idCounter += 1;
  return `stock-${Date.now()}-${idCounter}`;
};

export const addProblemToPool = (
  problem: GeneratedProblem,
  request: GenerateProblemRequest,
): StockedProblem => {
  const entry: StockedProblem = {
    createdAt: new Date().toISOString(),
    id: nextId(),
    problem,
    request,
    used: false,
  };
  savePool([...loadPool(), entry]);
  return entry;
};

export const takeNextProblem = (): StockedProblem | null => {
  const entries = loadPool();
  const next = entries.find(entry => !entry.used);
  if (!next) {
    return null;
  }
  savePool(
    entries.map(entry =>
      entry.id === next.id ? { ...entry, used: true } : entry,
    ),
  );
  return next;
};

export const clearPool = () => {
  resolveStorage().removeItem(POOL_STORAGE_KEY);
};

export const clearUsedProblems = () => {
  savePool(loadPool().filter(entry => !entry.used));
};

type GenerateFn = (
  config: GenerateProblemConfig,
  request: GenerateProblemRequest,
) => Promise<GeneratedProblem>;

export type PrefetchOptions = {
  onProgress?: (progress: PrefetchProgress) => void;
  generate?: GenerateFn;
};

// 生成APIは1問あたり数分かかることがあるため、直列で1問ずつ生成し、
// 1問完了するごとに永続化して途中失敗でも完了分を残す。
export const prefetchProblems = async (
  config: GenerateProblemConfig,
  request: GenerateProblemRequest,
  count: number,
  options: PrefetchOptions = {},
): Promise<PrefetchResult> => {
  const generate = options.generate ?? generateStudyProblem;
  const target = Math.max(0, Math.floor(count));
  const errors: string[] = [];
  let added = 0;

  for (let index = 0; index < target; index += 1) {
    try {
      const problem = await generate(config, request);
      addProblemToPool(problem, request);
      added += 1;
      options.onProgress?.({ completed: added, target });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      errors.push(message);
      options.onProgress?.({ completed: added, lastError: message, target });
    }
  }

  return { added, errors };
};
