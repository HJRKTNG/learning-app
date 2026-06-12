export type UserRole = 'guardian' | 'learner';

export type LearnerManagement = 'guardian-linked' | 'self-managed';

// 「保護者かつ学習者」（友達同士で相互に保護者になる等）を将来許容するため、
// ロールは単一値ではなく配列で保持する。現在のUIは単一ロール選択のみ。
export type UserProfile = {
  roles: UserRole[];
  learnerManagement?: LearnerManagement;
  guardianLinkCode?: string;
  createdAt: string;
};

type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const PROFILE_STORAGE_KEY = 'studylock.userProfile.v1';

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

export const setProfileStorageForTesting = (
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

const isUserRole = (value: unknown): value is UserRole =>
  value === 'guardian' || value === 'learner';

export const loadProfile = (): UserProfile | null => {
  const raw = resolveStorage().getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (!Array.isArray(parsed.roles)) {
      return null;
    }
    const roles = parsed.roles.filter(isUserRole);
    if (roles.length === 0) {
      return null;
    }
    return {
      createdAt:
        typeof parsed.createdAt === 'string'
          ? parsed.createdAt
          : new Date().toISOString(),
      guardianLinkCode:
        typeof parsed.guardianLinkCode === 'string'
          ? parsed.guardianLinkCode
          : undefined,
      learnerManagement:
        parsed.learnerManagement === 'guardian-linked' ||
        parsed.learnerManagement === 'self-managed'
          ? parsed.learnerManagement
          : undefined,
      roles,
    };
  } catch {
    return null;
  }
};

export const saveProfile = (profile: UserProfile): UserProfile => {
  resolveStorage().setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  return profile;
};

export const clearProfile = () => {
  resolveStorage().removeItem(PROFILE_STORAGE_KEY);
};

export const createGuardianProfile = (): UserProfile =>
  saveProfile({
    createdAt: new Date().toISOString(),
    roles: ['guardian'],
  });

export const createLearnerProfile = (
  management: LearnerManagement,
  guardianLinkCode?: string,
): UserProfile =>
  saveProfile({
    createdAt: new Date().toISOString(),
    guardianLinkCode:
      management === 'guardian-linked' ? guardianLinkCode : undefined,
    learnerManagement: management,
    roles: ['learner'],
  });

// 保護者が学習者を招待するためのコード。現状はローカル発行のモックで、
// アカウント基盤を接続したらサーバー発行に置き換える。
export const generateLinkCode = (): string => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
};
