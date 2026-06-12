import {
  buildGenerateRequest,
  defaultStudySettings,
  loadStudySettings,
  saveStudySettings,
  setStudySettingsStorageForTesting,
} from '../src/services/studySettings';

beforeEach(() => {
  const store = new Map<string, string>();
  setStudySettingsStorageForTesting({
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
  setStudySettingsStorageForTesting(null);
});

test('returns defaults when nothing is saved', () => {
  expect(loadStudySettings()).toEqual(defaultStudySettings);
});

test('persists school and difficulty selection', () => {
  saveStudySettings({
    difficulty: 'basic',
    school: 'high-school',
    subject: 'math',
    topic: 'Quadratic Functions',
  });
  const loaded = loadStudySettings();
  expect(loaded.school).toBe('high-school');
  expect(loaded.difficulty).toBe('basic');
  expect(loaded.topic).toBe('Quadratic Functions');
});

test('builds an API request from school and difficulty', () => {
  const request = buildGenerateRequest({
    difficulty: 'advanced',
    school: 'entrance-exam',
    subject: 'math',
    topic: 'Probability',
  });
  expect(request.subject).toBe('math');
  expect(request.topic).toBe('Probability');
  expect(request.difficulty).toBe('advanced');
  expect(request.level).toBe('University Entrance Exam (advanced difficulty)');
});

test('falls back to defaults for corrupted saved values', () => {
  saveStudySettings({
    // @ts-expect-error 故意に壊れた値を保存する
    difficulty: 'impossible',
    // @ts-expect-error 故意に壊れた値を保存する
    school: 'space-academy',
    subject: '',
    topic: '',
  });
  expect(loadStudySettings()).toEqual(defaultStudySettings);
});
