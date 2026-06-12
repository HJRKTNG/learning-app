import React, { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fonts, palette, radius, spacing, type } from '../theme/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'night';

export function AppButton({
  compact,
  disabled,
  label,
  onPress,
  variant = 'primary',
}: {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'night' && styles.buttonNight,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}>
      <Text
        style={[
          styles.buttonLabel,
          variant === 'secondary' && styles.buttonLabelSecondary,
          variant === 'ghost' && styles.buttonLabelGhost,
          variant === 'night' && styles.buttonLabelNight,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// カードの代わりに使う、文字色だけのステータス表示
export function Tag({
  label,
  tone = 'accent',
}: {
  label: string;
  tone?: 'accent' | 'success' | 'warn' | 'neutral';
}) {
  return (
    <Text
      style={[
        styles.tag,
        tone === 'success' && styles.tagSuccess,
        tone === 'warn' && styles.tagWarn,
        tone === 'neutral' && styles.tagNeutral,
      ]}>
      {label}
    </Text>
  );
}

// カードの代わりに使う、左罫線つきの強調ブロック
export function Callout({
  children,
  title,
  tone = 'neutral',
}: {
  children: ReactNode;
  title?: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger';
}) {
  return (
    <View
      style={[
        styles.callout,
        tone === 'accent' && styles.calloutAccent,
        tone === 'success' && styles.calloutSuccess,
        tone === 'warn' && styles.calloutWarn,
        tone === 'danger' && styles.calloutDanger,
      ]}>
      {title ? (
        <Text
          style={[
            styles.calloutTitle,
            tone === 'accent' && styles.calloutTitleAccent,
            tone === 'success' && styles.calloutTitleSuccess,
            tone === 'warn' && styles.calloutTitleWarn,
            tone === 'danger' && styles.calloutTitleDanger,
          ]}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export type GroupedRow = {
  label: string;
  value?: string;
  onPress?: () => void;
};

// エッジトゥエッジのヘアライン区切りリスト（背景・角丸なし）
export function GroupedRows({ rows }: { rows: GroupedRow[] }) {
  return (
    <View>
      {rows.map((row, index) => {
        const inner = (
          <>
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
            {row.onPress ? <Text style={styles.rowChevron}>›</Text> : null}
          </>
        );
        const rowStyle = [styles.row, index === 0 && styles.rowFirst];
        if (row.onPress) {
          return (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              style={({ pressed }) => [rowStyle, pressed && styles.rowPressed]}>
              {inner}
            </Pressable>
          );
        }
        return (
          <View key={row.label} style={rowStyle}>
            {inner}
          </View>
        );
      })}
    </View>
  );
}

// 学校・難易度などを1行で選ぶフラットなセレクター
export function OptionSelect<Id extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (id: Id) => void;
  options: Array<{ id: Id; label: string }>;
  value: Id;
}) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.optionChoices}>
        {options.map(option => {
          const selected = option.id === value;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              style={[styles.option, selected && styles.optionSelected]}>
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                ]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ProgressRing({
  label,
  subLabel,
  tone = 'accent',
}: {
  label: string;
  subLabel: string;
  tone?: 'accent' | 'warn' | 'success';
}) {
  return (
    <View
      style={[
        styles.ring,
        tone === 'warn' && styles.ringWarn,
        tone === 'success' && styles.ringSuccess,
      ]}>
      <View style={styles.ringInner}>
        <Text style={styles.ringLabel}>{label}</Text>
        <Text style={styles.ringSub}>{subLabel}</Text>
      </View>
    </View>
  );
}

export function Dots({
  active,
  current,
  total,
}: {
  active: number;
  current?: number;
  total: number;
}) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index < active && styles.dotActive,
            current === index + 1 && styles.dotCurrent,
          ]}
        />
      ))}
    </View>
  );
}

export function NavBar({
  onBack,
  title,
}: {
  onBack?: () => void;
  title: string;
}) {
  return (
    <View style={styles.nav}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.navSide}>
          <Text style={styles.navBack}>‹ 戻る</Text>
        </Pressable>
      ) : (
        <View style={styles.navSide} />
      )}
      <Text style={styles.navTitle}>{title}</Text>
      <View style={styles.navSide} />
    </View>
  );
}

export function StatusBarMock({ night }: { night?: boolean }) {
  return (
    <View style={[styles.statusBar, night && styles.statusBarNight]}>
      <Text style={[styles.statusText, night && styles.statusTextNight]}>
        {night ? '16:00' : '13:58'}
      </Text>
      <Text style={[styles.statusText, night && styles.statusTextNight]}>
        5G 86%
      </Text>
    </View>
  );
}

export type TabId = 'home' | 'study' | 'review' | 'settings';

export function TabBar({
  active,
  onSelect,
}: {
  active: TabId;
  onSelect: (tab: TabId) => void;
}) {
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'home', label: 'ホーム' },
    { id: 'study', label: '学習' },
    { id: 'review', label: '復習' },
    { id: 'settings', label: '設定' },
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map(tab => (
        <Pressable
          key={tab.id}
          onPress={() => onSelect(tab.id)}
          style={styles.tab}>
          <View
            style={[styles.tabDot, active === tab.id && styles.tabDotActive]}
          />
          <Text
            style={[styles.tabLabel, active === tab.id && styles.tabLabelActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Field({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.inkFaint}
        style={styles.fieldInput}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  buttonCompact: {
    minHeight: 42,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    minHeight: 38,
  },
  buttonLabel: {
    color: palette.surface,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  buttonLabelGhost: {
    color: palette.accent,
  },
  buttonLabelNight: {
    color: palette.night,
  },
  buttonLabelSecondary: {
    color: palette.accentDeep,
  },
  buttonNight: {
    backgroundColor: palette.surface,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonSecondary: {
    backgroundColor: palette.accentSoft,
  },
  callout: {
    borderLeftColor: palette.line,
    borderLeftWidth: 2,
    gap: 4,
    paddingLeft: spacing.md,
    paddingVertical: 2,
  },
  calloutAccent: {
    borderLeftColor: palette.accent,
  },
  calloutDanger: {
    borderLeftColor: palette.danger,
  },
  calloutSuccess: {
    borderLeftColor: palette.success,
  },
  calloutTitle: {
    ...type.caption,
  },
  calloutTitleAccent: {
    color: palette.accentDeep,
  },
  calloutTitleDanger: {
    color: palette.danger,
  },
  calloutTitleSuccess: {
    color: palette.success,
  },
  calloutTitleWarn: {
    color: palette.warn,
  },
  calloutWarn: {
    borderLeftColor: palette.warn,
  },
  divider: {
    backgroundColor: palette.line,
    height: StyleSheet.hairlineWidth,
  },
  dot: {
    backgroundColor: palette.line,
    borderRadius: 3,
    flex: 1,
    height: 5,
  },
  dotActive: {
    backgroundColor: palette.success,
  },
  dotCurrent: {
    backgroundColor: palette.accent,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  field: {
    gap: 5,
  },
  fieldInput: {
    backgroundColor: palette.canvas,
    borderRadius: radius.inner,
    color: palette.ink,
    fontSize: 14,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  fieldLabel: {
    ...type.caption,
  },
  nav: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  navBack: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  navSide: {
    width: 64,
  },
  navTitle: {
    color: palette.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  option: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    paddingBottom: 4,
    paddingTop: 6,
  },
  optionChoices: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  optionLabel: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 40,
  },
  optionSelected: {
    borderBottomColor: palette.accent,
  },
  optionText: {
    color: palette.inkFaint,
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: palette.accentDeep,
    fontWeight: '700',
  },
  ring: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: palette.accent,
    borderRadius: 60,
    height: 120,
    justifyContent: 'center',
    width: 120,
  },
  ringInner: {
    alignItems: 'center',
    backgroundColor: palette.bg,
    borderRadius: 47,
    gap: 1,
    height: 94,
    justifyContent: 'center',
    width: 94,
  },
  ringLabel: {
    color: palette.ink,
    fontFamily: fonts.mono,
    fontSize: 24,
    fontWeight: '800',
  },
  ringSub: {
    color: palette.inkFaint,
    fontSize: 11,
    fontWeight: '700',
  },
  ringSuccess: {
    backgroundColor: palette.success,
  },
  ringWarn: {
    backgroundColor: palette.warn,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 44,
  },
  rowChevron: {
    color: palette.inkFaint,
    fontSize: 19,
    fontWeight: '400',
  },
  rowFirst: {
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    color: palette.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  rowPressed: {
    backgroundColor: palette.canvas,
  },
  rowValue: {
    color: palette.inkSoft,
    fontSize: 13,
  },
  sectionLabel: {
    ...type.caption,
  },
  statusBar: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    height: 36,
    justifyContent: 'space-between',
    paddingBottom: 5,
    paddingHorizontal: spacing.lg,
  },
  statusBarNight: {
    backgroundColor: palette.night,
  },
  statusText: {
    color: palette.ink,
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextNight: {
    color: palette.surface,
  },
  tab: {
    alignItems: 'center',
    gap: 3,
    minWidth: 56,
  },
  tag: {
    color: palette.accentDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  tagNeutral: {
    color: palette.inkFaint,
  },
  tagSuccess: {
    color: palette.success,
  },
  tagWarn: {
    color: palette.warn,
  },
  tabBar: {
    backgroundColor: palette.bg,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 14,
    paddingTop: 8,
  },
  tabDot: {
    backgroundColor: 'transparent',
    borderRadius: 3,
    height: 4,
    width: 18,
  },
  tabDotActive: {
    backgroundColor: palette.accent,
  },
  tabLabel: {
    color: palette.inkFaint,
    fontSize: 11,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: palette.accent,
  },
});
