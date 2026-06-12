import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton, NavBar } from '../components/ui';
import { palette, radius, spacing, type } from '../theme/theme';
import {
  createGuardianProfile,
  createLearnerProfile,
  UserProfile,
} from '../services/userProfile';

function RoleRow({
  body,
  onPress,
  selected,
  showRadio,
  tag,
  title,
}: {
  body: string;
  onPress: () => void;
  selected?: boolean;
  showRadio?: boolean;
  tag: string;
  title: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.roleRow, pressed && styles.roleRowPressed]}>
      <View style={styles.roleRowText}>
        <Text style={[styles.roleTag, selected && styles.roleTagSelected]}>
          {tag}
        </Text>
        <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>
          {title}
        </Text>
        <Text style={styles.roleBody}>{body}</Text>
      </View>
      {showRadio ? (
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

export function RoleSelectScreen({
  onSelectGuardian,
  onSelectLearner,
}: {
  onSelectGuardian: (profile: UserProfile) => void;
  onSelectLearner: () => void;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}>
          <View style={styles.brandMarkInner} />
        </View>
        <Text style={styles.brandName}>StudyLock</Text>
        <Text style={styles.brandCopy}>
          解いて、解除する。{'\n'}学びがスマホの鍵になる。
        </Text>
      </View>
      <View style={styles.roleBlock}>
        <Text style={type.caption}>どちらで使いますか</Text>
        <RoleRow
          body="お子さまの学習状況を見守り、ロックスケジュールや問題の設定を管理します。"
          onPress={() => onSelectGuardian(createGuardianProfile())}
          tag="GUARDIAN"
          title="保護者として使う"
        />
        <RoleRow
          body="ミッションを解いてアプリのロックを解除します。保護者との連携も選べます。"
          onPress={onSelectLearner}
          tag="LEARNER"
          title="学習者として使う"
        />
      </View>
      <Text style={styles.footnote}>役割はあとから設定で変更できます。</Text>
    </View>
  );
}

export function LearnerSetupScreen({
  onBack,
  onComplete,
}: {
  onBack: () => void;
  onComplete: (profile: UserProfile) => void;
}) {
  const [mode, setMode] = useState<'guardian-linked' | 'self-managed' | null>(
    null,
  );
  const [linkCode, setLinkCode] = useState('');

  const canContinue =
    mode === 'self-managed' ||
    (mode === 'guardian-linked' && linkCode.trim().length >= 4);

  const complete = () => {
    if (!mode) {
      return;
    }
    onComplete(
      createLearnerProfile(mode, linkCode.trim().toUpperCase() || undefined),
    );
  };

  return (
    <View style={styles.screen}>
      <NavBar onBack={onBack} title="学習者の設定" />
      <View style={styles.setupBlock}>
        <Text style={styles.setupTitle}>管理方法を選ぶ</Text>
        <RoleRow
          body="保護者から受け取った連携コードを入力すると、見守りと設定の管理がつながります。"
          onPress={() => setMode('guardian-linked')}
          selected={mode === 'guardian-linked'}
          showRadio
          tag="LINK"
          title="保護者アカウントと連携"
        />
        {mode === 'guardian-linked' ? (
          <TextInput
            autoCapitalize="characters"
            onChangeText={setLinkCode}
            placeholder="連携コード（例: 7KQ2MZ）"
            placeholderTextColor={palette.inkFaint}
            style={styles.codeInput}
            value={linkCode}
          />
        ) : null}
        <RoleRow
          body="自分でロックスケジュールと解除条件を決めて、セルフコントロールに使います。"
          onPress={() => setMode('self-managed')}
          selected={mode === 'self-managed'}
          showRadio
          tag="SELF"
          title="自分で管理する"
        />
      </View>
      <View style={styles.setupFooter}>
        <AppButton
          disabled={!canContinue}
          label="この内容ではじめる"
          onPress={complete}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brandBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 36,
  },
  brandCopy: {
    ...type.body,
    textAlign: 'center',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 22,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  brandMarkInner: {
    backgroundColor: palette.surface,
    borderRadius: 7,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    height: 24,
    width: 28,
  },
  brandName: {
    ...type.title,
    marginTop: spacing.xs,
  },
  chevron: {
    color: palette.inkFaint,
    fontSize: 22,
    fontWeight: '400',
  },
  codeInput: {
    backgroundColor: palette.canvas,
    borderRadius: radius.inner,
    color: palette.ink,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 3,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  footnote: {
    ...type.footnote,
    paddingBottom: spacing.xl,
    textAlign: 'center',
  },
  radio: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioDot: {
    backgroundColor: palette.accent,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  radioSelected: {
    borderColor: palette.accent,
  },
  roleBlock: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  roleBody: {
    ...type.footnote,
    color: palette.inkSoft,
  },
  roleRow: {
    alignItems: 'center',
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: -StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
  },
  roleRowPressed: {
    backgroundColor: palette.canvas,
  },
  roleRowText: {
    flex: 1,
    gap: 3,
  },
  roleTag: {
    ...type.caption,
    color: palette.accent,
  },
  roleTagSelected: {
    color: palette.accentDeep,
  },
  roleTitle: {
    ...type.headline,
    fontSize: 17,
  },
  roleTitleSelected: {
    color: palette.accentDeep,
  },
  screen: {
    backgroundColor: palette.bg,
    flex: 1,
  },
  setupBlock: {
    flex: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  setupFooter: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  setupTitle: {
    ...type.largeTitle,
    marginBottom: spacing.sm,
  },
});
