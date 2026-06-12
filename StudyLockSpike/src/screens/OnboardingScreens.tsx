import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton, NavBar } from '../components/ui';
import { palette, radius, spacing, type } from '../theme/theme';
import {
  createGuardianProfile,
  createLearnerProfile,
  UserProfile,
} from '../services/userProfile';

function RoleCard({
  body,
  onPress,
  selected,
  tag,
  title,
}: {
  body: string;
  onPress: () => void;
  selected?: boolean;
  tag: string;
  title: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        selected && styles.roleCardSelected,
        pressed && styles.roleCardPressed,
      ]}>
      <Text style={[styles.roleTag, selected && styles.roleTagSelected]}>
        {tag}
      </Text>
      <Text style={styles.roleTitle}>{title}</Text>
      <Text style={styles.roleBody}>{body}</Text>
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
        <RoleCard
          body="お子さまの学習状況を見守り、ロックスケジュールや問題の設定を管理します。"
          onPress={() => onSelectGuardian(createGuardianProfile())}
          tag="GUARDIAN"
          title="保護者として使う"
        />
        <RoleCard
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
        <RoleCard
          body="保護者から受け取った連携コードを入力すると、見守りと設定の管理がつながります。"
          onPress={() => setMode('guardian-linked')}
          selected={mode === 'guardian-linked'}
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
        <RoleCard
          body="自分でロックスケジュールと解除条件を決めて、セルフコントロールに使います。"
          onPress={() => setMode('self-managed')}
          selected={mode === 'self-managed'}
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
    paddingTop: 40,
  },
  brandCopy: {
    ...type.body,
    textAlign: 'center',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 22,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  brandMarkInner: {
    backgroundColor: palette.surface,
    borderRadius: 7,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    height: 26,
    width: 30,
  },
  brandName: {
    ...type.title,
    marginTop: spacing.xs,
  },
  codeInput: {
    backgroundColor: palette.surface,
    borderColor: palette.accent,
    borderRadius: radius.inner,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 3,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  footnote: {
    ...type.footnote,
    paddingBottom: spacing.xl,
    textAlign: 'center',
  },
  roleBlock: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  roleBody: {
    ...type.footnote,
    color: palette.inkSoft,
  },
  roleCard: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: radius.card,
    borderWidth: 1.5,
    gap: 6,
    padding: spacing.lg,
  },
  roleCardPressed: {
    backgroundColor: palette.accentSoft,
  },
  roleCardSelected: {
    borderColor: palette.accent,
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
    fontSize: 18,
  },
  screen: {
    backgroundColor: palette.canvas,
    flex: 1,
  },
  setupBlock: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
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
