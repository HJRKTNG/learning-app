import React, { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { cardShadow, fonts, palette, radius, spacing, type } from '../theme/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'night';

export function AppButton({
  disabled,
  label,
  onPress,
  variant = 'primary',
}: {
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

export function Card({
  children,
  tone = 'surface',
}: {
  children: ReactNode;
  tone?: 'surface' | 'accent' | 'success' | 'warn' | 'danger' | 'night';
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'accent' && styles.cardAccent,
        tone === 'success' && styles.cardSuccess,
        tone === 'warn' && styles.cardWarn,
        tone === 'danger' && styles.cardDanger,
        tone === 'night' && styles.cardNight,
      ]}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Badge({
  label,
  tone = 'accent',
}: {
  label: string;
  tone?: 'accent' | 'success' | 'warn' | 'neutral';
}) {
  return (
    <Text
      style={[
        styles.badge,
        tone === 'success' && styles.badgeSuccess,
        tone === 'warn' && styles.badgeWarn,
        tone === 'neutral' && styles.badgeNeutral,
      ]}>
      {label}
    </Text>
  );
}

export type GroupedRow = {
  label: string;
  value?: string;
  onPress?: () => void;
};

export function GroupedRows({ rows }: { rows: GroupedRow[] }) {
  return (
    <View style={styles.group}>
      {rows.map((row, index) => {
        const inner = (
          <>
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
            {row.onPress ? <Text style={styles.rowChevron}>›</Text> : null}
          </>
        );
        const isLast = index === rows.length - 1;
        if (row.onPress) {
          return (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              style={({ pressed }) => [
                styles.row,
                isLast && styles.rowLast,
                pressed && styles.rowPressed,
              ]}>
              {inner}
            </Pressable>
          );
        }
        return (
          <View key={row.label} style={[styles.row, isLast && styles.rowLast]}>
            {inner}
          </View>
        );
      })}
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
  badge: {
    backgroundColor: palette.accentSoft,
    borderRadius: radius.badge,
    color: palette.accentDeep,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeNeutral: {
    backgroundColor: palette.canvas,
    color: palette.inkSoft,
  },
  badgeSuccess: {
    backgroundColor: palette.successSoft,
    color: palette.success,
  },
  badgeWarn: {
    backgroundColor: palette.warnSoft,
    color: palette.warn,
  },
  button: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonLabel: {
    color: palette.surface,
    fontSize: 16,
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
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    gap: spacing.sm,
    padding: spacing.lg,
    ...cardShadow,
  },
  cardAccent: {
    backgroundColor: palette.accentSoft,
  },
  cardDanger: {
    backgroundColor: palette.dangerSoft,
  },
  cardNight: {
    backgroundColor: palette.nightSoft,
  },
  cardSuccess: {
    backgroundColor: palette.successSoft,
  },
  cardWarn: {
    backgroundColor: palette.warnSoft,
  },
  dot: {
    backgroundColor: palette.line,
    borderRadius: 4,
    flex: 1,
    height: 6,
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
    gap: 6,
  },
  fieldInput: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.inner,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  fieldLabel: {
    ...type.caption,
  },
  group: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...cardShadow,
  },
  nav: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 48,
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
  ring: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: palette.accent,
    borderRadius: 66,
    height: 132,
    justifyContent: 'center',
    width: 132,
  },
  ringInner: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: 52,
    gap: 2,
    height: 104,
    justifyContent: 'center',
    width: 104,
  },
  ringLabel: {
    color: palette.ink,
    fontFamily: fonts.mono,
    fontSize: 26,
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
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  rowChevron: {
    color: palette.inkFaint,
    fontSize: 20,
    fontWeight: '400',
  },
  rowLabel: {
    color: palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: palette.canvas,
  },
  rowValue: {
    color: palette.inkSoft,
    fontSize: 14,
  },
  sectionLabel: {
    ...type.caption,
    paddingHorizontal: spacing.xs,
  },
  statusBar: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    height: 38,
    justifyContent: 'space-between',
    paddingBottom: 6,
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
  tabBar: {
    backgroundColor: palette.surface,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 16,
    paddingTop: 10,
  },
  tabDot: {
    backgroundColor: 'transparent',
    borderRadius: 3,
    height: 5,
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
