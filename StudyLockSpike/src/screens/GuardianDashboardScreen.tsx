import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  Field,
  GroupedRows,
  OptionSelect,
  SectionLabel,
  Tag,
} from '../components/ui';
import { palette, radius, spacing, type } from '../theme/theme';
import { GenerateProblemConfig } from '../api/genStudyApi';
import {
  clearUsedProblems,
  poolSnapshot,
  prefetchProblems,
  PrefetchProgress,
} from '../services/problemPool';
import {
  buildGenerateRequest,
  difficultyOptions,
  schoolOptions,
  StudySettings,
} from '../services/studySettings';
import { generateLinkCode } from '../services/userProfile';

type GuardianDashboardScreenProps = {
  apiConfig?: GenerateProblemConfig;
  onChangeSettings: (settings: StudySettings) => void;
  onResetRole: () => void;
  settings: StudySettings;
};

export function GuardianDashboardScreen({
  apiConfig,
  onChangeSettings,
  onResetRole,
  settings,
}: GuardianDashboardScreenProps) {
  const [pool, setPool] = useState(poolSnapshot);
  const [target, setTarget] = useState(3);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [progress, setProgress] = useState<PrefetchProgress | null>(null);
  const [prefetchError, setPrefetchError] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  const refreshPool = useCallback(() => setPool(poolSnapshot()), []);

  const runPrefetch = async () => {
    if (!apiConfig?.token) {
      setPrefetchError(
        'API設定が未接続です。開発ダッシュボードまたは.env.localでTokenを設定してください。',
      );
      return;
    }
    setIsPrefetching(true);
    setPrefetchError(null);
    setProgress({ completed: 0, target });
    try {
      const result = await prefetchProblems(
        apiConfig,
        buildGenerateRequest(settings),
        target,
        {
          onProgress: update => {
            setProgress(update);
            refreshPool();
          },
        },
      );
      if (result.errors.length > 0) {
        setPrefetchError(
          `${result.errors.length}問の生成に失敗しました: ${result.errors[0]}`,
        );
      }
    } finally {
      setIsPrefetching(false);
      setProgress(null);
      refreshPool();
    }
  };

  return (
    <View style={styles.body}>
      <View style={styles.titleRow}>
        <Text style={type.largeTitle}>見守り</Text>
        <Tag label="進行中 3/10・連続12日" tone="warn" />
      </View>

      <View style={styles.stockHeader}>
        <SectionLabel>問題ストック</SectionLabel>
        <Tag
          label={pool.ready > 0 ? `残り ${pool.ready} 問` : 'ストックなし'}
          tone={pool.ready > 0 ? 'success' : 'warn'}
        />
      </View>
      <View style={styles.stepperRow}>
        <Text style={styles.stepperLabel}>追加生成する問題数</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => setTarget(value => Math.max(1, value - 1))}
            style={styles.stepButton}>
            <Text style={styles.stepGlyph}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>{target}</Text>
          <Pressable
            onPress={() => setTarget(value => Math.min(10, value + 1))}
            style={styles.stepButton}>
            <Text style={styles.stepGlyph}>＋</Text>
          </Pressable>
        </View>
      </View>
      {isPrefetching && progress ? (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(
                  6,
                  (progress.completed / progress.target) * 100,
                )}%`,
              },
            ]}
          />
        </View>
      ) : null}
      {isPrefetching && progress ? (
        <Text style={type.footnote}>
          生成中 {progress.completed} / {progress.target} 問（1問数分かかります）
        </Text>
      ) : null}
      {prefetchError ? (
        <Text style={styles.errorText}>{prefetchError}</Text>
      ) : null}
      <AppButton
        compact
        disabled={isPrefetching}
        label={isPrefetching ? '生成しています…' : `${target}問をまとめて生成`}
        onPress={runPrefetch}
      />
      {pool.used > 0 && !isPrefetching ? (
        <Pressable onPress={() => {
          clearUsedProblems();
          refreshPool();
        }}>
          <Text style={styles.inlineAction}>使用済み {pool.used} 問を整理</Text>
        </Pressable>
      ) : null}

      <SectionLabel>出題設定</SectionLabel>
      <OptionSelect
        label="学校"
        onChange={school => onChangeSettings({ ...settings, school })}
        options={schoolOptions}
        value={settings.school}
      />
      <OptionSelect
        label="難易度"
        onChange={difficulty => onChangeSettings({ ...settings, difficulty })}
        options={difficultyOptions}
        value={settings.difficulty}
      />
      <Field
        label="トピック"
        onChangeText={topic => onChangeSettings({ ...settings, topic })}
        placeholder="例: Probability Recurrence Relations"
        value={settings.topic}
      />

      <View style={styles.flexSpacer} />

      <SectionLabel>ロックと連携</SectionLabel>
      <GroupedRows
        rows={[
          { label: 'ロックスケジュール', value: '平日 16:00' },
          { label: '解除条件', value: '10問中8問' },
          {
            label: '連携コード',
            onPress: () => setLinkCode(generateLinkCode()),
            value: linkCode ?? 'タップして発行',
          },
          { label: '役割の選択をやり直す', onPress: onResetRole },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  errorText: {
    color: palette.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  flexSpacer: {
    flex: 1,
  },
  inlineAction: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressFill: {
    backgroundColor: palette.accent,
    borderRadius: 3,
    height: 5,
  },
  progressTrack: {
    backgroundColor: palette.line,
    borderRadius: 3,
    height: 5,
    overflow: 'hidden',
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: palette.canvas,
    height: 34,
    justifyContent: 'center',
    width: 40,
  },
  stepGlyph: {
    color: palette.accent,
    fontSize: 17,
    fontWeight: '700',
  },
  stepValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
    minWidth: 40,
    textAlign: 'center',
  },
  stepper: {
    alignItems: 'center',
    borderColor: palette.line,
    borderRadius: radius.inner,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  stepperLabel: {
    color: palette.inkSoft,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  stockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  titleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
