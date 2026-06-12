import {
  clearProfile,
  createGuardianProfile,
  createLearnerProfile,
  generateLinkCode,
  loadProfile,
  setProfileStorageForTesting,
} from '../src/services/userProfile';

beforeEach(() => {
  const store = new Map<string, string>();
  setProfileStorageForTesting({
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
  setProfileStorageForTesting(null);
});

test('guardian profile is persisted and reloaded', () => {
  createGuardianProfile();
  const loaded = loadProfile();
  expect(loaded?.roles).toEqual(['guardian']);
  expect(loaded?.learnerManagement).toBeUndefined();
});

test('learner profile keeps management mode and link code', () => {
  createLearnerProfile('guardian-linked', '7KQ2MZ');
  const loaded = loadProfile();
  expect(loaded?.roles).toEqual(['learner']);
  expect(loaded?.learnerManagement).toBe('guardian-linked');
  expect(loaded?.guardianLinkCode).toBe('7KQ2MZ');

  clearProfile();
  expect(loadProfile()).toBeNull();
});

test('self-managed learner does not store a link code', () => {
  createLearnerProfile('self-managed', 'IGNORED');
  expect(loadProfile()?.guardianLinkCode).toBeUndefined();
});

test('link code is 6 chars from the unambiguous alphabet', () => {
  const code = generateLinkCode();
  expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});
