import { Platform } from 'react-native';

// 「静かな信頼」: 深い藍をアンカーに、ロイヤルブルーを唯一のアクセントとする。
// カードや影は使わず、白地＋ヘアライン＋タイポグラフィで構成する。
export const palette = {
  accent: '#2456E6',
  accentDeep: '#0F2E7E',
  accentSoft: '#E9EEFB',
  bg: '#FFFFFF',
  canvas: '#F4F5F8',
  danger: '#C93B3B',
  dangerSoft: '#F9E9E9',
  ink: '#0C1B33',
  inkFaint: '#94A0B4',
  inkSoft: '#51607A',
  line: '#E4E8F0',
  night: '#0A1A38',
  nightLine: 'rgba(255,255,255,0.16)',
  nightSoft: 'rgba(255,255,255,0.10)',
  nightText: 'rgba(255,255,255,0.78)',
  nightTextFaint: 'rgba(255,255,255,0.55)',
  success: '#1E9E5A',
  successSoft: '#E5F4EC',
  surface: '#FFFFFF',
  warn: '#B97916',
  warnSoft: '#FAF0DC',
} as const;

export const radius = {
  badge: 999,
  card: 20,
  control: 14,
  inner: 12,
} as const;

export const spacing = {
  lg: 20,
  md: 14,
  sm: 8,
  xl: 28,
  xs: 4,
} as const;

export const fonts = {
  mono: Platform.select({ default: 'monospace', ios: 'Menlo' }),
} as const;

// iOS Human Interface Guidelinesのスケールに寄せた文字スタイル
export const type = {
  body: {
    color: palette.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    color: palette.inkFaint,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  footnote: {
    color: palette.inkFaint,
    fontSize: 13,
    lineHeight: 19,
  },
  headline: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  largeTitle: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.7,
  },
  title: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
} as const;

export const cardShadow = Platform.select({
  default: {},
  web: {
    boxShadow: '0 1px 2px rgba(12,27,51,0.04), 0 8px 24px rgba(12,27,51,0.06)',
  },
}) as object;
