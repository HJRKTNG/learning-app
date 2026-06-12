import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AppButton,
  Badge,
  Card,
  GroupedRows,
  SectionLabel,
} from '../components/ui';
import { palette, radius, spacing, type } from '../theme/theme';
import {
  GenerateProblemConfig,
  GenerateProblemRequest,
} from '../api/genStudyApi';
import {
  clearUsedProblems,
  poolSnapshot,
  prefetchProblems,
  PrefetchProgress,
} from '../services/problemPool';
import { generateLinkCode } from '../services/userProfile';

type GuardianDashboardScreenProps = {
  apiConfig?: GenerateProblemConfig;
  generateRequest: GenerateProblemRequest;
  onResetRole: () => void;
};

export function GuardianDashboardScreen({
  apiConfig,
  generateRequest,
  onResetRole,
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
      const result = await prefetchProblems(apiConfig, generateRequest, target, {
        onProgress: update => {
          setProgress(update);
          refreshPool();
        },
      });
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
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={type.largeTitle}>見守り</Text>

      <SectionLabel>学習者の今日</SectionLabel>
      <Card>
        <View style={styles.cardHeader}>
          <Text style={type.headline}>今日のミッション</Text>
          <Badge label="進行中" tone="warn" />
        </View>
        <View style={styles.statsRow}>
          <Stat label="マスター" value="3/10" />
          <Stat label="解除ライン" value="8問" />
          <Stat label="連続達成" value="12日" />
        </View>
      </Card>

      <SectionLabel>問題ストック</SectionLabel>
      <Card>
        <View style={styles.cardHeader}>
          <Text style={type.headline}>事前生成プール</Text>
          <Badge
            label={`残り ${pool.ready} 問`}
            tone={pool.ready > 0 ? 'success' : 'warn'}
          />
        </View>
        <Text style={type.footnote}>
          生成APIは1問あたり数分かかるため、ミッション前にまとめて生成してストックしておきます。
        </Text>
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
            生成中 {progress.completed} / {progress.target} 問（数分かかる場合があります）
          </Text>
        ) : null}
        {prefetchError ? (
          <Text style={styles.errorText}>{prefetchError}</Text>
        ) : null}
        <AppButton
          disabled={isPrefetching}
          label={isPrefetching ? '生成しています…' : `${target}問をまとめて生成`}
          onPress={runPrefetch}
        />
        {pool.used > 0 ? (
          <AppButton
            label={`使用済み ${pool.used} 問を整理`}
            onPress={() => {
              clearUsedProblems();
              refreshPool();
            }}
            variant="ghost"
          />
        ) : null}
      </Card>

      <SectionLabel>ロック設定</SectionLabel>
      <GroupedRows
        rows={[
          { label: 'ロックスケジュール', value: '平日 16:00' },
          { label: '対象アプリ', value: 'SNS / 動画 / ゲーム' },
          { label: '解除条件', value: '10問中8問' },
        ]}
      />

      <SectionLabel>出題設定</SectionLabel>
      <GroupedRows
        rows={[
          { label: '教科', value: generateRequest.subject },
          { label: 'レベル', value: generateRequest.level },
          { label: 'トピック', value: generateRequest.topic },
        ]}
      />

      <SectionLabel>学習者との連携</SectionLabel>
      <Card tone="accent">
        <Text style={type.headline}>連携コード</Text>
        {linkCode ? (
          <Text style={styles.linkCode}>{linkCode}</Text>
        ) : (
          <Text style={type.footnote}>
            コードを発行して学習者に伝えると、このダッシュボードと連携できます。
          </Text>
        )}
        <AppButton
          label={linkCode ? 'コードを再発行' : 'コードを発行'}
          onPress={() => setLinkCode(generateLinkCode())}
          variant="secondary"
        />
      </Card>

      <GroupedRows rows={[{ label: '役割の選択をやり直す', onPress: onResetRole }]} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  errorText: {
    color: palette.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  linkCode: {
    color: palette.accentDeep,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
  },
  progressFill: {
    backgroundColor: palette.accent,
    borderRadius: 3,
    height: 6,
  },
  progressTrack: {
    backgroundColor: palette.line,
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    ...type.caption,
  },
  statValue: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: palette.canvas,
    height: 36,
    justifyContent: 'center',
    width: 40,
  },
  stepGlyph: {
    color: palette.accent,
    fontSize: 18,
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
});
