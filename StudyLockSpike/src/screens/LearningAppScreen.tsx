import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraCapture } from '../components/CameraCapture';
import { MathContent } from '../components/MathContent';
import {
  GeneratedProblem,
  GenerateProblemConfig,
  GenerateProblemRequest,
  generateStudyProblem,
} from '../api/genStudyApi';
import {
  CapturedAnswer,
  GradingResult,
  gradeCapturedAnswer,
} from '../services/gradingService';
import { screenTitles } from './learningScreenOptions';

export type LearningScreenId =
  | 'home'
  | 'lock'
  | 'mission'
  | 'problem'
  | 'camera'
  | 'grading'
  | 'correct'
  | 'wrong'
  | 'missionResult'
  | 'retry'
  | 'unlock'
  | 'settings';

export type LearningPreviewState = {
  screen: LearningScreenId;
  mastered: number;
  total: number;
  required: number;
  locked: boolean;
  showApiPanel: boolean;
};

type LearningAppScreenProps = {
  apiConfig?: GenerateProblemConfig;
  generateRequest?: GenerateProblemRequest;
  preview?: LearningPreviewState;
  onNavigate?: (screen: LearningScreenId) => void;
  onGeneratedProblem?: (problem: GeneratedProblem) => void;
};

const defaultPreview: LearningPreviewState = {
  locked: false,
  mastered: 3,
  required: 8,
  screen: 'home',
  showApiPanel: true,
  total: 10,
};

const defaultRequest: GenerateProblemRequest = {
  level: 'University of Tokyo',
  subject: 'math',
  topic: 'Probability Recurrence Relations',
};

const fallbackProblem: GeneratedProblem = {
  answer: '$\\frac{2}{3}$',
  explanation:
    '漸化式を状態ごとに分け、求めたい確率を $p_n$ とおく。遷移確率から一次漸化式を作り、固定点との差を取ると等比型に帰着できる。',
  latex:
    '\\text{Let } p_n \\text{ be the target probability. Derive } p_{n+1}=a p_n+b.',
  problem:
    '袋の中に赤玉と白玉がある。操作を繰り返したとき、$n$ 回後に赤玉を引く確率を $p_n$ とする。遷移条件から漸化式を立て、$\\lim_{n\\to\\infty}p_n$ を求めよ。',
  raw: {},
  source: 'fallback',
  title: '確率漸化式・導入問題',
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function LearningAppScreen({
  apiConfig,
  generateRequest = defaultRequest,
  onGeneratedProblem,
  onNavigate,
  preview = defaultPreview,
}: LearningAppScreenProps) {
  const [generatedProblem, setGeneratedProblem] =
    useState<GeneratedProblem>(fallbackProblem);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [manualAnswer, setManualAnswer] = useState('');
  const [capturedAnswer, setCapturedAnswer] = useState<CapturedAnswer | null>(
    null,
  );
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(
    null,
  );

  const progress = useMemo(
    () => ({
      current: clamp(preview.mastered, 0, preview.total),
      remaining: Math.max(preview.required - preview.mastered, 0),
    }),
    [preview.mastered, preview.required, preview.total],
  );

  const navigate = (screen: LearningScreenId) => {
    onNavigate?.(screen);
  };

  const runGenerate = async () => {
    if (!apiConfig) {
      setApiError('API設定が未接続です。Webダッシュボードから設定してください。');
      return;
    }

    setIsGenerating(true);
    setApiError(null);
    try {
      const nextProblem = await generateStudyProblem(apiConfig, generateRequest);
      setGeneratedProblem(nextProblem);
      setCapturedAnswer(null);
      setGradingResult(null);
      setManualAnswer('');
      onGeneratedProblem?.(nextProblem);
      navigate('problem');
    } catch (caught) {
      setApiError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsGenerating(false);
    }
  };

  const runGrade = async (answer: CapturedAnswer) => {
    setCapturedAnswer(answer);
    setIsGrading(true);
    setGradingResult(null);
    navigate('grading');
    try {
      const result = await gradeCapturedAnswer(generatedProblem, answer);
      setGradingResult(result);
      navigate(result.isCorrect ? 'correct' : 'wrong');
    } finally {
      setIsGrading(false);
    }
  };

  const content = () => {
    switch (preview.screen) {
      case 'lock':
        return <LockScreen onStart={() => navigate('mission')} />;
      case 'mission':
        return (
          <MissionScreen
            mastered={preview.mastered}
            onStart={() => navigate('problem')}
            progress={progress}
            required={preview.required}
            total={preview.total}
          />
        );
      case 'problem':
        return (
          <ProblemScreen
            generatedProblem={generatedProblem}
            isGenerating={isGenerating}
            onCapture={() => navigate('camera')}
            onGenerate={runGenerate}
          />
        );
      case 'camera':
        return (
          <CameraScreen
            manualAnswer={manualAnswer}
            onChangeManualAnswer={setManualAnswer}
            onGrade={runGrade}
          />
        );
      case 'grading':
        return (
          <GradingScreen
            capturedAnswer={capturedAnswer}
            gradingResult={gradingResult}
            isGrading={isGrading}
          />
        );
      case 'correct':
        return (
          <CorrectScreen
            generatedProblem={generatedProblem}
            gradingResult={gradingResult}
            mastered={preview.mastered}
            onNext={() => navigate('missionResult')}
            total={preview.total}
          />
        );
      case 'wrong':
        return (
          <WrongScreen
            generatedProblem={generatedProblem}
            gradingResult={gradingResult}
            onNext={() => navigate('retry')}
          />
        );
      case 'missionResult':
        return (
          <MissionResultScreen
            mastered={preview.mastered}
            onRetry={() => navigate('retry')}
            onUnlock={() => navigate('unlock')}
            required={preview.required}
            total={preview.total}
          />
        );
      case 'retry':
        return (
          <RetryScreen
            remaining={progress.remaining}
            onStart={() => navigate('problem')}
          />
        );
      case 'unlock':
        return <UnlockScreen onHome={() => navigate('home')} />;
      case 'settings':
        return <SettingsScreen />;
      case 'home':
      default:
        return (
          <HomeScreen
            apiError={apiError}
            isGenerating={isGenerating}
            onGenerate={runGenerate}
            onLock={() => navigate('lock')}
            showApiPanel={preview.showApiPanel}
          />
        );
    }
  };

  return (
    <View style={styles.app}>
      <StatusBarLabel locked={preview.locked || preview.screen === 'lock'} />
      {preview.screen !== 'home' &&
      preview.screen !== 'lock' &&
      preview.screen !== 'unlock' ? (
        <Nav title={screenTitles[preview.screen]} onBack={() => navigate('home')} />
      ) : null}
      {content()}
      {preview.screen !== 'lock' && preview.screen !== 'camera' ? (
        <TabBar active={preview.screen === 'settings' ? 'settings' : 'home'} onSettings={() => navigate('settings')} />
      ) : null}
      {preview.screen === 'home' && preview.showApiPanel ? (
        <View style={styles.inlineApi}>
          <Text style={styles.inlineApiTitle}>問題生成API</Text>
          {isGenerating ? (
            <Text style={styles.smallText}>生成中です。APIの応答に時間がかかる場合があります。</Text>
          ) : (
            <Text style={styles.smallText}>
              ダッシュボードの設定で生成した問題が、問題画面に反映されます。
            </Text>
          )}
          {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function StatusBarLabel({ locked }: { locked: boolean }) {
  return (
    <View style={[styles.statusBar, locked && styles.statusBarLocked]}>
      <Text style={[styles.statusText, locked && styles.statusTextLocked]}>
        {locked ? '16:00' : '13:58'}
      </Text>
      <Text style={[styles.statusText, locked && styles.statusTextLocked]}>
        5G 86%
      </Text>
    </View>
  );
}

function Nav({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.nav}>
      <Pressable onPress={onBack} style={styles.navSide}>
        <Text style={styles.linkText}>戻る</Text>
      </Pressable>
      <Text style={styles.navTitle}>{title}</Text>
      <View style={styles.navSide} />
    </View>
  );
}

function HomeScreen({
  apiError,
  isGenerating,
  onGenerate,
  onLock,
  showApiPanel,
}: {
  apiError: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onLock: () => void;
  showApiPanel: boolean;
}) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.largeTitle}>ホーム</Text>
      <View style={styles.heroCard}>
        <Text style={styles.kicker}>次のロックまで</Text>
        <Text style={styles.bigTime}>02:01:40</Text>
        <Text style={styles.bodyText}>16:00 から今日の数学ミッションが始まります。</Text>
      </View>
      <Text style={styles.groupLabel}>今日の予定</Text>
      <GroupedRows
        rows={[
          ['範囲', '確率漸化式'],
          ['問題数', '10問'],
          ['解除ライン', '8問マスター'],
        ]}
      />
      <PrimaryButton label="ロック開始をプレビュー" onPress={onLock} variant="outline" />
      {showApiPanel ? (
        <View style={styles.strip}>
          <Text style={styles.stripTitle}>GEN STUDY API</Text>
          <Text style={styles.bodyText}>東京大学レベルの確率漸化式を生成して、問題画面へ差し込みます。</Text>
          {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}
          <PrimaryButton
            label={isGenerating ? '生成中...' : 'APIで問題を生成'}
            onPress={onGenerate}
            variant="primary"
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function LockScreen({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockGlyph}>
        <Text style={styles.lockGlyphText}>LOCK</Text>
      </View>
      <Text style={styles.lockTitle}>学習タイムです</Text>
      <Text style={styles.lockCopy}>
        対象アプリを一時的にロックしました。今日の数学を解くと解除されます。
      </Text>
      <View style={styles.lockMission}>
        <Text style={styles.lockMissionTitle}>今日の数学ミッション</Text>
        <Text style={styles.lockMissionText}>全10問 / 8問マスターで解除</Text>
      </View>
      <View style={styles.flexSpacer} />
      <PrimaryButton label="ミッションを始める" onPress={onStart} variant="light" />
      <Text style={styles.lockMuted}>あとで（5分後に再通知）</Text>
    </View>
  );
}

function MissionScreen({
  mastered,
  onStart,
  progress,
  required,
  total,
}: {
  mastered: number;
  onStart: () => void;
  progress: { current: number; remaining: number };
  required: number;
  total: number;
}) {
  return (
    <View style={styles.body}>
      <View style={styles.statusStrip}>
        <Text style={styles.stripTitle}>ロック中</Text>
        <Text style={styles.bodyText}>対象アプリは停止しています</Text>
      </View>
      <ProgressRing label={`${progress.current}/${total}`} subLabel={`必要 ${required}`} />
      <Dots total={total} active={mastered} current={mastered + 1} />
      <Text style={styles.centerText}>
        解除まであと <Text style={styles.accentText}>{progress.remaining}問</Text> をマスター
      </Text>
      <View style={styles.flexSpacer} />
      <PrimaryButton label={`問題${Math.min(mastered + 1, total)} を解く`} onPress={onStart} />
    </View>
  );
}

function ProblemScreen({
  generatedProblem,
  isGenerating,
  onCapture,
  onGenerate,
}: {
  generatedProblem: GeneratedProblem;
  isGenerating: boolean;
  onCapture: () => void;
  onGenerate: () => void;
}) {
  return (
    <View style={styles.body}>
      <Dots total={10} active={3} current={4} />
      <View style={styles.problemCard}>
        <View style={styles.problemHeader}>
          <Text style={styles.kicker}>{generatedProblem.title}</Text>
          <Text style={styles.sourceBadge}>
            {generatedProblem.source === 'api' ? 'API生成' : 'デモ問題'}
          </Text>
        </View>
        <MathContent tone="problem" value={generatedProblem.problem} />
        {generatedProblem.latex ? (
          <View style={styles.latexBox}>
            <Text style={styles.kicker}>LaTeX / MMD</Text>
            <MathContent tone="compact" value={`$$${generatedProblem.latex}$$`} />
          </View>
        ) : null}
        <Text style={styles.smallText}>途中式もノートに書いて撮影してください。</Text>
      </View>
      <View style={styles.flexSpacer} />
      <PrimaryButton label="解答を撮影する" onPress={onCapture} />
      <PrimaryButton
        label={isGenerating ? '生成中...' : 'APIで別問題を生成'}
        onPress={onGenerate}
        variant="outline"
      />
    </View>
  );
}

function CameraScreen({
  manualAnswer,
  onChangeManualAnswer,
  onGrade,
}: {
  manualAnswer: string;
  onChangeManualAnswer: (value: string) => void;
  onGrade: (answer: CapturedAnswer) => void;
}) {
  return (
    <View style={styles.cameraScreen}>
      <View style={styles.cameraTop}>
        <Text style={styles.cameraHint}>紙の答案を撮影、または画像を選択してください。</Text>
        <TextInput
          multiline
          onChangeText={onChangeManualAnswer}
          placeholder="OCRが不完全な場合に備えて、答えや途中式を入力"
          placeholderTextColor="#9aa1ad"
          style={styles.answerInput}
          value={manualAnswer}
        />
      </View>
      <CameraCapture manualAnswer={manualAnswer} onCapture={onGrade} />
    </View>
  );
}

function GradingScreen({
  capturedAnswer,
  gradingResult,
  isGrading,
}: {
  capturedAnswer: CapturedAnswer | null;
  gradingResult: GradingResult | null;
  isGrading: boolean;
}) {
  return (
    <View style={styles.body}>
      {capturedAnswer?.imageDataUrl ? (
        <View style={styles.scanBox}>
          <Text style={styles.scanImageLabel}>{capturedAnswer.imageName}</Text>
          <View style={styles.scanLine} />
        </View>
      ) : (
        <View style={styles.scanBox}>
          <Text style={styles.scanImageLabel}>手動入力で採点</Text>
          <View style={styles.scanLine} />
        </View>
      )}
      {isGrading ? <ActivityIndicator color="#4f46e5" /> : null}
      <Text style={styles.centerTitle}>
        {isGrading ? 'AI採点しています...' : '採点結果を準備しました'}
      </Text>
      <Text style={styles.centerText}>
        OCR候補、手動入力、模範解答を同じ採点サービス境界へ渡しています。
      </Text>
      <GroupedRows
        rows={[
          ['画像', capturedAnswer?.imageName ?? 'なし'],
          ['OCR候補', capturedAnswer?.ocrText || '手動入力待ち'],
          ['採点', gradingResult ? '完了' : '処理中'],
        ]}
      />
      <View style={styles.flexSpacer} />
    </View>
  );
}

function CorrectScreen({
  generatedProblem,
  gradingResult,
  mastered,
  onNext,
  total,
}: {
  generatedProblem: GeneratedProblem;
  gradingResult: GradingResult | null;
  mastered: number;
  onNext: () => void;
  total: number;
}) {
  return (
    <View style={styles.body}>
      <Text style={styles.successTitle}>正解</Text>
      <View style={styles.problemCardSmall}>
        <Text style={styles.kicker}>認識した答え</Text>
        <MathContent
          tone="body"
          value={gradingResult?.recognizedText ?? generatedProblem.answer}
        />
      </View>
      <View style={[styles.strip, styles.okStrip]}>
        <Text style={styles.stripTitle}>AIフィードバック</Text>
        <MathContent
          tone="body"
          value={gradingResult?.feedback ?? generatedProblem.explanation}
        />
      </View>
      <View style={styles.problemCardSmall}>
        <Text style={styles.kicker}>模範解説</Text>
        <MathContent tone="body" value={generatedProblem.explanation} />
      </View>
      <Dots total={total} active={mastered + 1} />
      <Text style={styles.centerText}>正解 {mastered + 1} / あと {Math.max(8 - mastered - 1, 0)} 問</Text>
      <View style={styles.flexSpacer} />
      <PrimaryButton label="次へ" onPress={onNext} />
    </View>
  );
}

function WrongScreen({
  generatedProblem,
  gradingResult,
  onNext,
}: {
  generatedProblem: GeneratedProblem;
  gradingResult: GradingResult | null;
  onNext: () => void;
}) {
  return (
    <View style={styles.body}>
      <Text style={styles.failTitle}>不正解</Text>
      <View style={[styles.strip, styles.badStrip]}>
        <Text style={styles.stripTitle}>認識した答え</Text>
        <MathContent
          tone="body"
          value={gradingResult?.recognizedText ?? 'OCR結果なし'}
        />
      </View>
      <View style={[styles.strip, styles.okStrip]}>
        <Text style={styles.stripTitle}>AIフィードバック</Text>
        <MathContent
          tone="body"
          value={gradingResult?.feedback ?? generatedProblem.explanation}
        />
      </View>
      <View style={styles.problemCardSmall}>
        <Text style={styles.kicker}>模範解説</Text>
        <MathContent tone="body" value={generatedProblem.explanation} />
      </View>
      <Text style={styles.smallText}>この問題はマスターするまで再び出題されます。</Text>
      <View style={styles.flexSpacer} />
      <PrimaryButton label="再挑戦へ" onPress={onNext} />
    </View>
  );
}

function MissionResultScreen({
  mastered,
  onRetry,
  onUnlock,
  required,
  total,
}: {
  mastered: number;
  onRetry: () => void;
  onUnlock: () => void;
  required: number;
  total: number;
}) {
  const passed = mastered >= required;
  return (
    <View style={styles.body}>
      <ProgressRing label={`${mastered}/${total}`} subLabel={`目標 ${required}`} warning={!passed} />
      <View style={[styles.strip, passed ? styles.okStrip : styles.warnStrip]}>
        <Text style={styles.stripTitle}>{passed ? '解除できます' : `あと${required - mastered}問で解除`}</Text>
        <Text style={styles.bodyText}>
          {passed
            ? '今日のミッション条件を満たしました。対象アプリを解除します。'
            : 'まだ解けていない問題をもう一度。同じ問題をマスターして累計8問で解除です。'}
        </Text>
      </View>
      <Dots total={total} active={mastered} />
      <View style={styles.flexSpacer} />
      <PrimaryButton label={passed ? 'ロックを解除する' : '再挑戦に進む'} onPress={passed ? onUnlock : onRetry} variant="dark" />
    </View>
  );
}

function RetryScreen({
  onStart,
  remaining,
}: {
  onStart: () => void;
  remaining: number;
}) {
  return (
    <View style={styles.body}>
      <View style={[styles.strip, styles.warnStrip]}>
        <Text style={styles.stripTitle}>あと{remaining}問で解除</Text>
        <Text style={styles.bodyText}>まだ解けていない同じ問題にもう一度挑戦します。</Text>
      </View>
      <Text style={styles.groupLabel}>再挑戦リスト</Text>
      <GroupedRows
        rows={[
          ['問2・確率漸化式', '再挑戦'],
          ['問4・条件付き確率', '再挑戦'],
          ['問7・期待値', '再挑戦'],
        ]}
      />
      <View style={styles.flexSpacer} />
      <PrimaryButton label="再挑戦を始める" onPress={onStart} />
    </View>
  );
}

function UnlockScreen({ onHome }: { onHome: () => void }) {
  return (
    <View style={styles.bodyCenter}>
      <Text style={styles.successTitle}>ロック解除！</Text>
      <Text style={styles.centerText}>今日のミッション達成。対象アプリが使えるようになりました。</Text>
      <GroupedRows
        rows={[
          ['今日の正解', '8 / 10'],
          ['連続達成', '12日'],
          ['次のロック', '明日 16:00'],
        ]}
      />
      <View style={styles.flexSpacer} />
      <PrimaryButton label="ホームに戻る" onPress={onHome} />
    </View>
  );
}

function SettingsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.groupLabel}>ロック</Text>
      <GroupedRows
        rows={[
          ['ロックスケジュール', '平日 16:00'],
          ['対象アプリ', 'SNS / 動画 / ゲーム'],
          ['解除条件', '10問中8問'],
        ]}
      />
      <Text style={styles.groupLabel}>学習</Text>
      <GroupedRows
        rows={[
          ['教科', '数学'],
          ['レベル', 'University of Tokyo'],
          ['出題トピック', 'Probability Recurrence Relations'],
        ]}
      />
    </ScrollView>
  );
}

function ProgressRing({
  label,
  subLabel,
  warning,
}: {
  label: string;
  subLabel: string;
  warning?: boolean;
}) {
  return (
    <View style={[styles.ring, warning && styles.ringWarn]}>
      <View style={styles.ringInner}>
        <Text style={styles.ringLabel}>{label}</Text>
        <Text style={styles.ringSub}>{subLabel}</Text>
      </View>
    </View>
  );
}

function Dots({
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

function GroupedRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <View style={styles.group}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function TabBar({
  active,
  onSettings,
}: {
  active: 'home' | 'settings';
  onSettings: () => void;
}) {
  return (
    <View style={styles.tabBar}>
      <Text style={[styles.tabItem, active === 'home' && styles.tabActive]}>ホーム</Text>
      <Text style={styles.tabItem}>学習</Text>
      <Text style={styles.tabItem}>復習</Text>
      <Pressable onPress={onSettings}>
        <Text style={[styles.tabItem, active === 'settings' && styles.tabActive]}>設定</Text>
      </Pressable>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'dark' | 'light';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'outline' && styles.buttonOutline,
        variant === 'dark' && styles.buttonDark,
        variant === 'light' && styles.buttonLight,
        pressed && styles.buttonPressed,
      ]}>
      <Text
        style={[
          styles.buttonText,
          variant === 'outline' && styles.buttonOutlineText,
          variant === 'light' && styles.buttonLightText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function DevTextInput({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.devField}>
      <Text style={styles.devLabel}>{label}</Text>
      <TextInput
        onChangeText={onChangeText}
        style={styles.devInput}
        value={value}
      />
    </View>
  );
}

const mono = Platform.select({ default: 'monospace', ios: 'Menlo' });

const styles = StyleSheet.create({
  accentText: {
    color: '#3730a3',
    fontWeight: '800',
  },
  app: {
    backgroundColor: '#f1f2f5',
    flex: 1,
    overflow: 'hidden',
  },
  badStrip: {
    backgroundColor: '#fae6e6',
  },
  answerInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d8dbe4',
    borderRadius: 10,
    borderWidth: 1,
    color: '#1b1e26',
    fontSize: 14,
    minHeight: 76,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  bigTime: {
    color: '#1b1e26',
    fontFamily: mono,
    fontSize: 42,
    fontWeight: '700',
    marginTop: 6,
  },
  body: {
    backgroundColor: '#ffffff',
    flexGrow: 1,
    gap: 14,
    padding: 18,
  },
  bodyCenter: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 22,
  },
  bodyText: {
    color: '#596171',
    fontSize: 14,
    lineHeight: 21,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonDark: {
    backgroundColor: '#1b1e26',
  },
  buttonLight: {
    backgroundColor: '#ffffff',
  },
  buttonLightText: {
    color: '#3a32c4',
  },
  buttonOutline: {
    backgroundColor: '#ffffff',
    borderColor: '#4f46e5',
    borderWidth: 1,
  },
  buttonOutlineText: {
    color: '#4f46e5',
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  cameraHint: {
    color: '#c9ced8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  cameraScreen: {
    backgroundColor: '#1b1d24',
    flex: 1,
  },
  cameraTop: {
    gap: 10,
    padding: 14,
  },
  centerText: {
    color: '#596171',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  centerTitle: {
    color: '#1b1e26',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  devField: {
    gap: 6,
  },
  devInput: {
    backgroundColor: '#ffffff',
    borderColor: '#d8dbe4',
    borderRadius: 8,
    borderWidth: 1,
    color: '#1f2937',
    fontSize: 13,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  devLabel: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dot: {
    backgroundColor: '#dcdfe6',
    borderRadius: 4,
    flex: 1,
    height: 7,
  },
  dotActive: {
    backgroundColor: '#1f9d57',
  },
  dotCurrent: {
    backgroundColor: '#4f46e5',
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  errorText: {
    color: '#a83232',
    fontSize: 12,
    lineHeight: 18,
  },
  failTitle: {
    color: '#a83232',
    fontSize: 28,
    fontWeight: '900',
  },
  flexSpacer: {
    flex: 1,
  },
  group: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e4ea',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupLabel: {
    color: '#9aa1ad',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e4ea',
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    padding: 16,
  },
  latexBox: {
    gap: 8,
  },
  inlineApi: {
    backgroundColor: '#eceafe',
    borderTopColor: '#d8d3ff',
    borderTopWidth: 1,
    gap: 4,
    padding: 12,
  },
  inlineApiTitle: {
    color: '#3730a3',
    fontSize: 12,
    fontWeight: '900',
  },
  kicker: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  largeTitle: {
    color: '#1b1e26',
    fontSize: 28,
    fontWeight: '900',
  },
  linkText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '700',
  },
  lockCopy: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  lockGlyph: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 18,
    borderWidth: 2,
    height: 74,
    justifyContent: 'center',
    width: 74,
  },
  lockGlyphText: {
    color: '#ffffff',
    fontFamily: mono,
    fontSize: 13,
    fontWeight: '800',
  },
  lockMission: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    gap: 4,
    padding: 14,
    width: '100%',
  },
  lockMissionText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
  },
  lockMissionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  lockMuted: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    textAlign: 'center',
  },
  lockScreen: {
    alignItems: 'center',
    backgroundColor: '#272178',
    flex: 1,
    gap: 16,
    padding: 22,
    paddingTop: 56,
  },
  lockTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  nav: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e4ea',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  navSide: {
    width: 56,
  },
  navTitle: {
    color: '#1b1e26',
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  okStrip: {
    backgroundColor: '#e3f5ea',
  },
  problemCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e4ea',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 14,
    padding: 16,
  },
  problemCardSmall: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e4ea',
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  problemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  ring: {
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 62,
    height: 124,
    justifyContent: 'center',
    width: 124,
  },
  ringInner: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  ringLabel: {
    color: '#1b1e26',
    fontFamily: mono,
    fontSize: 24,
    fontWeight: '900',
  },
  ringSub: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
  },
  ringWarn: {
    backgroundColor: '#d8812a',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#e2e4ea',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  rowLabel: {
    color: '#1b1e26',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  rowValue: {
    color: '#6b7280',
    fontFamily: mono,
    fontSize: 12,
  },
  scanBox: {
    backgroundColor: '#f6f7f9',
    borderColor: '#e2e4ea',
    borderRadius: 12,
    borderWidth: 1,
    height: 148,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanImageLabel: {
    color: '#596171',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  scanLine: {
    backgroundColor: '#4f46e5',
    height: 2,
  },
  smallText: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 18,
  },
  statusBar: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    height: 38,
    justifyContent: 'space-between',
    paddingBottom: 6,
    paddingHorizontal: 20,
  },
  statusBarLocked: {
    backgroundColor: '#272178',
  },
  statusStrip: {
    backgroundColor: '#eceafe',
    borderRadius: 12,
    gap: 4,
    padding: 14,
  },
  sourceBadge: {
    backgroundColor: '#eceafe',
    borderRadius: 999,
    color: '#3730a3',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: '#1b1e26',
    fontFamily: mono,
    fontSize: 12,
    fontWeight: '800',
  },
  statusTextLocked: {
    color: '#ffffff',
  },
  strip: {
    backgroundColor: '#eceafe',
    borderRadius: 12,
    gap: 7,
    padding: 14,
  },
  stripTitle: {
    color: '#3730a3',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  successTitle: {
    color: '#137a40',
    fontSize: 28,
    fontWeight: '900',
  },
  tabActive: {
    color: '#4f46e5',
  },
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#e2e4ea',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 14,
    paddingTop: 9,
  },
  tabItem: {
    color: '#9aa1ad',
    fontSize: 11,
    fontWeight: '800',
    minWidth: 54,
    textAlign: 'center',
  },
  warnStrip: {
    backgroundColor: '#fbeeda',
  },
});
