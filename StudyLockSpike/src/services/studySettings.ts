import { GenerateProblemRequest } from '../api/genStudyApi';

export type SchoolId =
  | 'junior-high'
  | 'high-school'
  | 'entrance-exam'
  | 'top-university';

export type DifficultyId = 'basic' | 'standard' | 'advanced';

export type StudySettings = {
  school: SchoolId;
  difficulty: DifficultyId;
  subject: string;
  topic: string;
};

export const schoolOptions: Array<{
  id: SchoolId;
  label: string;
  apiLevel: string;
}> = [
  { apiLevel: 'Junior High School', id: 'junior-high', label: '中学' },
  { apiLevel: 'High School', id: 'high-school', label: '高校' },
  {
    apiLevel: 'University Entrance Exam',
    id: 'entrance-exam',
    label: '大学受験',
  },
  { apiLevel: 'University of Tokyo', id: 'top-university', label: '難関大' },
];

export const difficultyOptions: Array<{
  id: DifficultyId;
  label: string;
  apiValue: string;
}> = [
  { apiValue: 'basic', id: 'basic', label: '基礎' },
  { apiValue: 'standard', id: 'standard', label: '標準' },
  { apiValue: 'advanced', id: 'advanced', label: '応用' },
];

export const defaultStudySettings: StudySettings = {
  difficulty: 'standard',
  school: 'top-university',
  subject: 'math',
  topic: 'Probability Recurrence Relations',
};

type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const SETTINGS_STORAGE_KEY = 'studylock.studySettings.v1';

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

export const setStudySettingsStorageForTesting = (
  storage: KeyValueStorage | null,
) => {
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

const isSchoolId = (value: unknown): value is SchoolId =>
  schoolOptions.some(option => option.id === value);

const isDifficultyId = (value: unknown): value is DifficultyId =>
  difficultyOptions.some(option => option.id === value);

export const loadStudySettings = (): StudySettings => {
  const raw = resolveStorage().getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return defaultStudySettings;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StudySettings>;
    return {
      difficulty: isDifficultyId(parsed.difficulty)
        ? parsed.difficulty
        : defaultStudySettings.difficulty,
      school: isSchoolId(parsed.school)
        ? parsed.school
        : defaultStudySettings.school,
      subject:
        typeof parsed.subject === 'string' && parsed.subject.trim()
          ? parsed.subject
          : defaultStudySettings.subject,
      topic:
        typeof parsed.topic === 'string' && parsed.topic.trim()
          ? parsed.topic
          : defaultStudySettings.topic,
    };
  } catch {
    return defaultStudySettings;
  }
};

export const saveStudySettings = (settings: StudySettings): StudySettings => {
  resolveStorage().setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  return settings;
};

export const schoolLabel = (id: SchoolId): string =>
  schoolOptions.find(option => option.id === id)?.label ?? id;

export const difficultyLabel = (id: DifficultyId): string =>
  difficultyOptions.find(option => option.id === id)?.label ?? id;

// 生成APIのlevelは自由記述でプロンプトに渡る想定のため、
// 学校レベルと難易度を1つの文字列に合成しつつ、difficultyも個別に送る。
export const buildGenerateRequest = (
  settings: StudySettings,
): GenerateProblemRequest => {
  const school = schoolOptions.find(option => option.id === settings.school);
  const difficulty = difficultyOptions.find(
    option => option.id === settings.difficulty,
  );
  return {
    difficulty: difficulty?.apiValue,
    level: `${school?.apiLevel ?? settings.school} (${
      difficulty?.apiValue ?? settings.difficulty
    } difficulty)`,
    subject: settings.subject,
    topic: settings.topic,
  };
};
