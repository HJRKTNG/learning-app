import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraCapture } from '../components/CameraCapture';
import { MathContent } from '../components/MathContent';
import {
  AppButton,
  Callout,
  Dots,
  Field,
  GroupedRows,
  NavBar,
  OptionSelect,
  ProgressRing,
  SectionLabel,
  StatusBarMock,
  TabBar,
  Tag,
} from '../components/ui';
import { fonts, palette, radius, spacing, type } from '../theme/theme';
import {
  GeneratedProblem,
  GenerateProblemConfig,
  generateStudyProblem,
} from '../api/genStudyApi';
import {
  CapturedAnswer,
  GradingResult,
  gradeCapturedAnswer,
} from '../services/gradingService';
import { poolSnapshot, takeNextProblem } from '../services/problemPool';
import {
  buildGenerateRequest,
  difficultyOptions,
  loadStudySettings,
  saveStudySettings,
  schoolOptions,
  StudySettings,
} from '../services/studySettings';
import {
  clearProfile,
  loadProfile,
  UserProfile,
} from '../services/userProfile';
import { GuardianDashboardScreen } from './GuardianDashboardScreen';
import { LearnerSetupScreen, RoleSelectScreen } from './OnboardingScreens';
import { screenTitles } from './learningScreenOptions';

export type LearningScreenId =
  | 'roleSelect'
  | 'learnerSetup'
  | 'guardian'
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
};

type LearningAppScreenProps = {
  apiConfig?: GenerateProblemConfig;
  preview?: LearningPreviewState;
  onNavigate?: (screen: LearningScreenId) => void;
  onGeneratedProblem?: (problem: GeneratedProblem) => void;
};

const defaultPreview: LearningPreviewState = {
  locked: false,
  mastered: 3,
  required: 8,
  screen: 'home',
  total: 10,
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

type ProblemOrigin = 'stock' | 'api' | 'demo';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const initialScreenForProfile = (
  profile: UserProfile | null,
): LearningScreenId => {
  if (!profile) {
    return 'roleSelect';
  }
  if (profile.roles.includes('guardian') && !profile.roles.includes('learner')) {
    return 'guardian';
  }
  return 'home';
};

export function LearningAppScreen({
  apiConfig,
  onGeneratedProblem,
  onNavigate,
  preview = defaultPreview,
}: LearningAppScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(loadProfile);
  // onNavigate付き（Webダッシュボード）は画面を外部制御、ネイティブ単体では内部state。
  const [internalScreen, setInternalScreen] = useState<LearningScreenId>(() =>
    initialScreenForProfile(loadProfile()),
  );
  const screen = onNavigate ? preview.screen : internalScreen;

  const [settings, setSettings] = useState<StudySettings>(loadStudySettings);
  const [generatedProblem, setGeneratedProblem] =
    useState<GeneratedProblem>(fallbackProblem);
  const [problemOrigin, setProblemOrigin] = useState<ProblemOrigin>('demo');
  const [stockReady, setStockReady] = useState(() => poolSnapshot().ready);
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

  const navigate = (next: LearningScreenId) => {
    if (onNavigate) {
      onNavigate(next);
    } else {
      setInternalScreen(next);
    }
  };

  const updateSettings = (next: StudySettings) => {
    setSettings(saveStudySettings(next));
  };

  const resetAnswerState = () => {
    setCapturedAnswer(null);
    setGradingResult(null);
    setManualAnswer('');
  };

  // ストック優先で次の問題を取り出す。空ならいまの問題（デモ含む）を続用する。
  const startProblem = () => {
    const stocked = takeNextProblem();
    if (stocked) {
      setGeneratedProblem(stocked.problem);
      setProblemOrigin('stock');
      resetAnswerState();
      onGeneratedProblem?.(stocked.problem);
    }
    setStockReady(poolSnapshot().ready);
    navigate('problem');
  };

  const runGenerate = async () => {
    if (!apiConfig) {
      setApiError('API設定が未接続です。Webダッシュボードから設定してください。');
      return;
    }

    setIsGenerating(true);
    setApiError(null);
    try {
      const nextProblem = await generateStudyProblem(
        apiConfig,
        buildGenerateRequest(settings),
      );
      setGeneratedProblem(nextProblem);
      setProblemOrigin('api');
      resetAnswerState();
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

  const resetRole = () => {
    clearProfile();
    setProfile(null);
    navigate('roleSelect');
  };

  const content = () => {
    switch (screen) {
      case 'roleSelect':
        return (
          <RoleSelectScreen
            onSelectGuardian={nextProfile => {
              setProfile(nextProfile);
              navigate('guardian');
            }}
            onSelectLearner={() => navigate('learnerSetup')}
          />
        );
      case 'learnerSetup':
        return (
          <LearnerSetupScreen
            onBack={() => navigate('roleSelect')}
            onComplete={nextProfile => {
              setProfile(nextProfile);
              navigate('home');
            }}
          />
        );
      case 'guardian':
        return (
          <GuardianDashboardScreen
            apiConfig={apiConfig}
            onChangeSettings={updateSettings}
            onResetRole={resetRole}
            settings={settings}
          />
        );
      case 'lock':
        return <LockScreen onStart={() => navigate('mission')} />;
      case 'mission':
        return (
          <MissionScreen
            mastered={preview.mastered}
            onStart={startProblem}
            progress={progress}
            required={preview.required}
            stockReady={stockReady}
            total={preview.total}
          />
        );
      case 'problem':
        return (
          <ProblemScreen
            apiError={apiError}
            generatedProblem={generatedProblem}
            isGenerating={isGenerating}
            onCapture={() => navigate('camera')}
            onGenerate={runGenerate}
            onNextStock={startProblem}
            origin={problemOrigin}
            stockReady={stockReady}
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
          <RetryScreen remaining={progress.remaining} onStart={startProblem} />
        );
      case 'unlock':
        return <UnlockScreen onHome={() => navigate('home')} />;
      case 'settings':
        return (
          <SettingsScreen
            onChangeSettings={updateSettings}
            onResetRole={resetRole}
            profile={profile}
            settings={settings}
            stockReady={stockReady}
          />
        );
      case 'home':
      default:
        return (
          <HomeScreen
            onLock={() => navigate('lock')}
            onStart={startProblem}
            settings={settings}
            stockReady={stockReady}
          />
        );
    }
  };

  const isOnboarding = screen === 'roleSelect' || screen === 'learnerSetup';
  const isNight = screen === 'lock';
  const showNav =
    !isOnboarding &&
    !isNight &&
    screen !== 'home' &&
    screen !== 'unlock' &&
    screen !== 'guardian';
  const showTabBar =
    !isOnboarding &&
    !isNight &&
    screen !== 'camera' &&
    screen !== 'guardian';

  return (
    <View style={styles.app}>
      <StatusBarMock night={preview.locked || isNight} />
      {showNav ? (
        <NavBar onBack={() => navigate('home')} title={screenTitles[screen]} />
      ) : null}
      {content()}
      {showTabBar ? (
        <TabBar
          active={screen === 'settings' ? 'settings' : 'home'}
          onSelect={tab => {
            if (tab === 'settings') {
              navigate('settings');
            } else if (tab === 'study') {
              navigate('mission');
            } else if (tab === 'review') {
              navigate('retry');
            } else {
              navigate('home');
            }
          }}
        />
      ) : null}
    </View>
  );
}

function HomeScreen({
  onLock,
  onStart,
  settings,
  stockReady,
}: {
  onLock: () => void;
  onStart: () => void;
  settings: StudySettings;
  stockReady: number;
}) {
  const school = schoolOptions.find(option => option.id === settings.school);
  const difficulty = difficultyOptions.find(
    option => option.id === settings.difficulty,
  );
  return (
    <View style={styles.body}>
      <Text style={type.largeTitle}>ホーム</Text>
      <View style={styles.heroBlock}>
        <Text style={type.caption}>次のロックまで</Text>
        <Text style={styles.bigTime}>02:01:40</Text>
        <Text style={type.footnote}>16:00 から今日の数学ミッション</Text>
      </View>
      <GroupedRows
        rows={[
          { label: '範囲', value: settings.topic },
          {
            label: 'レベル',
            value: `${school?.label ?? ''}・${difficulty?.label ?? ''}`,
          },
          { label: '解除ライン', value: '10問中8問マスター' },
          {
            label: '問題ストック',
            value: stockReady > 0 ? `残り ${stockReady} 問` : 'なし',
          },
        ]}
      />
      {stockReady === 0 ? (
        <Text style={styles.warnText}>
          ストックが空です。保護者ダッシュボードで事前生成してください。
        </Text>
      ) : null}
      <View style={styles.flexSpacer} />
      <AppButton label="今すぐ1問解く" onPress={onStart} />
      <AppButton label="ロック開始をプレビュー" onPress={onLock} variant="ghost" />
    </View>
  );
}

function LockScreen({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockGlyph}>
        <View style={styles.lockShackle} />
        <View style={styles.lockBody} />
      </View>
      <Text style={styles.lockTitle}>学習タイムです</Text>
      <Text style={styles.lockCopy}>
        対象アプリを一時的にロックしました。{'\n'}今日の数学を解くと解除されます。
      </Text>
      <View style={styles.lockMission}>
        <Text style={styles.lockMissionTitle}>今日の数学ミッション</Text>
        <Text style={styles.lockMissionText}>全10問 / 8問マスターで解除</Text>
      </View>
      <View style={styles.flexSpacer} />
      <View style={styles.lockFooter}>
        <AppButton label="ミッションを始める" onPress={onStart} variant="night" />
        <Text style={styles.lockMuted}>あとで（5分後に再通知）</Text>
      </View>
    </View>
  );
}

function MissionScreen({
  mastered,
  onStart,
  progress,
  required,
  stockReady,
  total,
}: {
  mastered: number;
  onStart: () => void;
  progress: { current: number; remaining: number };
  required: number;
  stockReady: number;
  total: number;
}) {
  return (
    <View style={styles.body}>
      <Callout title="ロック中" tone="warn">
        <Text style={type.footnote}>対象アプリは停止しています</Text>
      </Callout>
      <View style={styles.missionCenter}>
        <ProgressRing
          label={`${progress.current}/${total}`}
          subLabel={`必要 ${required}`}
        />
        <Dots total={total} active={mastered} current={mastered + 1} />
        <Text style={styles.centerText}>
          解除まであと <Text style={styles.accentText}>{progress.remaining}問</Text>{' '}
          をマスター
        </Text>
        <Text style={styles.centerFootnote}>
          {stockReady > 0
            ? `ストックから出題（残り ${stockReady} 問）`
            : 'ストックがないため、現在の問題を続けます'}
        </Text>
      </View>
      <View style={styles.flexSpacer} />
      <AppButton
        label={`問題${Math.min(mastered + 1, total)} を解く`}
        onPress={onStart}
      />
    </View>
  );
}

function ProblemScreen({
  apiError,
  generatedProblem,
  isGenerating,
  onCapture,
  onGenerate,
  onNextStock,
  origin,
  stockReady,
}: {
  apiError: string | null;
  generatedProblem: GeneratedProblem;
  isGenerating: boolean;
  onCapture: () => void;
  onGenerate: () => void;
  onNextStock: () => void;
  origin: ProblemOrigin;
  stockReady: number;
}) {
  const originTag =
    origin === 'stock'
      ? { label: 'ストック問題', tone: 'success' as const }
      : origin === 'api'
        ? { label: 'API生成', tone: 'accent' as const }
        : { label: 'デモ問題', tone: 'neutral' as const };

  return (
    <View style={styles.body}>
      <Dots total={10} active={3} current={4} />
      <View style={styles.problemHeader}>
        <Text style={type.caption}>{generatedProblem.title}</Text>
        <Tag label={originTag.label} tone={originTag.tone} />
      </View>
      <ScrollView style={styles.problemScroll}>
        <MathContent tone="problem" value={generatedProblem.problem} />
        {generatedProblem.latex ? (
          <View style={styles.latexBox}>
            <Text style={type.caption}>LaTeX / MMD</Text>
            <MathContent tone="compact" value={`$$${generatedProblem.latex}$$`} />
          </View>
        ) : null}
      </ScrollView>
      <Text style={type.footnote}>途中式もノートに書いて撮影してください。</Text>
      {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}
      <AppButton label="解答を撮影する" onPress={onCapture} />
      {stockReady > 0 ? (
        <AppButton
          compact
          label={`ストックから次の問題（残り ${stockReady}）`}
          onPress={onNextStock}
          variant="secondary"
        />
      ) : (
        <AppButton
          compact
          disabled={isGenerating}
          label={isGenerating ? '生成中…' : 'APIで別問題を生成（数分かかります）'}
          onPress={onGenerate}
          variant="secondary"
        />
      )}
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
        <Text style={styles.cameraHint}>
          紙の答案を撮影、または画像を選択してください。
        </Text>
        <TextInput
          multiline
          onChangeText={onChangeManualAnswer}
          placeholder="OCRが不完全な場合に備えて、答えや途中式を入力"
          placeholderTextColor={palette.inkFaint}
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
      <View style={styles.scanBox}>
        <Text style={styles.scanImageLabel}>
          {capturedAnswer?.imageDataUrl
            ? capturedAnswer.imageName
            : '手動入力で採点'}
        </Text>
        <View style={styles.scanLine} />
      </View>
      {isGrading ? <ActivityIndicator color={palette.accent} /> : null}
      <Text style={styles.centerTitle}>
        {isGrading ? 'AI採点しています…' : '採点結果を準備しました'}
      </Text>
      <GroupedRows
        rows={[
          { label: '画像', value: capturedAnswer?.imageName ?? 'なし' },
          { label: 'OCR候補', value: capturedAnswer?.ocrText || '手動入力待ち' },
          { label: '採点', value: gradingResult ? '完了' : '処理中' },
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
      <View style={styles.resultHeader}>
        <Text style={styles.successTitle}>正解</Text>
        <Tag
          label={`正解 ${mastered + 1} / あと ${Math.max(8 - mastered - 1, 0)} 問`}
          tone="success"
        />
      </View>
      <ScrollView contentContainerStyle={styles.resultScroll} style={styles.flexSpacer}>
        <Callout title="認識した答え" tone="neutral">
          <MathContent
            tone="body"
            value={gradingResult?.recognizedText ?? generatedProblem.answer}
          />
        </Callout>
        <Callout title="AIフィードバック" tone="success">
          <MathContent
            tone="body"
            value={gradingResult?.feedback ?? generatedProblem.explanation}
          />
        </Callout>
        <Callout title="模範解説" tone="accent">
          <MathContent tone="body" value={generatedProblem.explanation} />
        </Callout>
      </ScrollView>
      <Dots total={total} active={mastered + 1} />
      <AppButton label="次へ" onPress={onNext} />
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
      <View style={styles.resultHeader}>
        <Text style={styles.failTitle}>不正解</Text>
        <Tag label="マスターするまで再出題" tone="warn" />
      </View>
      <ScrollView contentContainerStyle={styles.resultScroll} style={styles.flexSpacer}>
        <Callout title="認識した答え" tone="danger">
          <MathContent
            tone="body"
            value={gradingResult?.recognizedText ?? 'OCR結果なし'}
          />
        </Callout>
        <Callout title="AIフィードバック" tone="success">
          <MathContent
            tone="body"
            value={gradingResult?.feedback ?? generatedProblem.explanation}
          />
        </Callout>
        <Callout title="模範解説" tone="accent">
          <MathContent tone="body" value={generatedProblem.explanation} />
        </Callout>
      </ScrollView>
      <AppButton label="再挑戦へ" onPress={onNext} />
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
      <View style={styles.missionCenter}>
        <ProgressRing
          label={`${mastered}/${total}`}
          subLabel={`目標 ${required}`}
          tone={passed ? 'success' : 'warn'}
        />
        <Dots total={total} active={mastered} />
      </View>
      <Callout
        title={passed ? '解除できます' : `あと${required - mastered}問で解除`}
        tone={passed ? 'success' : 'warn'}>
        <Text style={type.footnote}>
          {passed
            ? '今日のミッション条件を満たしました。対象アプリを解除します。'
            : 'まだ解けていない問題をもう一度。同じ問題をマスターして累計8問で解除です。'}
        </Text>
      </Callout>
      <View style={styles.flexSpacer} />
      <AppButton
        label={passed ? 'ロックを解除する' : '再挑戦に進む'}
        onPress={passed ? onUnlock : onRetry}
      />
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
      <Callout title={`あと${remaining}問で解除`} tone="warn">
        <Text style={type.footnote}>
          まだ解けていない同じ問題にもう一度挑戦します。
        </Text>
      </Callout>
      <SectionLabel>再挑戦リスト</SectionLabel>
      <GroupedRows
        rows={[
          { label: '問2・確率漸化式', value: '再挑戦' },
          { label: '問4・条件付き確率', value: '再挑戦' },
          { label: '問7・期待値', value: '再挑戦' },
        ]}
      />
      <View style={styles.flexSpacer} />
      <AppButton label="再挑戦を始める" onPress={onStart} />
    </View>
  );
}

function UnlockScreen({ onHome }: { onHome: () => void }) {
  return (
    <View style={styles.bodyCenter}>
      <Text style={styles.successTitle}>ロック解除！</Text>
      <Text style={styles.centerText}>
        今日のミッション達成。対象アプリが使えるようになりました。
      </Text>
      <View style={styles.fullWidth}>
        <GroupedRows
          rows={[
            { label: '今日の正解', value: '8 / 10' },
            { label: '連続達成', value: '12日' },
            { label: '次のロック', value: '明日 16:00' },
          ]}
        />
      </View>
      <View style={styles.flexSpacer} />
      <View style={styles.fullWidth}>
        <AppButton label="ホームに戻る" onPress={onHome} />
      </View>
    </View>
  );
}

function SettingsScreen({
  onChangeSettings,
  onResetRole,
  profile,
  settings,
  stockReady,
}: {
  onChangeSettings: (settings: StudySettings) => void;
  onResetRole: () => void;
  profile: UserProfile | null;
  settings: StudySettings;
  stockReady: number;
}) {
  const roleLabel = !profile
    ? '未設定'
    : profile.roles.includes('guardian') && profile.roles.includes('learner')
      ? '保護者・学習者'
      : profile.roles.includes('guardian')
        ? '保護者'
        : profile.learnerManagement === 'guardian-linked'
          ? '学習者（保護者と連携）'
          : '学習者（自分で管理）';

  return (
    <View style={styles.body}>
      <SectionLabel>アカウント</SectionLabel>
      <GroupedRows
        rows={[
          { label: '役割', value: roleLabel },
          { label: '役割の選択をやり直す', onPress: onResetRole },
        ]}
      />
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
      <SectionLabel>ロック</SectionLabel>
      <GroupedRows
        rows={[
          { label: 'ロックスケジュール', value: '平日 16:00' },
          { label: '対象アプリ', value: 'SNS / 動画 / ゲーム' },
          { label: '問題ストック', value: `残り ${stockReady} 問` },
        ]}
      />
    </View>
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

const styles = StyleSheet.create({
  accentText: {
    color: palette.accentDeep,
    fontWeight: '800',
  },
  answerInput: {
    backgroundColor: palette.surface,
    borderRadius: radius.inner,
    color: palette.ink,
    fontSize: 14,
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  app: {
    backgroundColor: palette.bg,
    flex: 1,
    overflow: 'hidden',
  },
  bigTime: {
    color: palette.ink,
    fontFamily: fonts.mono,
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1,
  },
  body: {
    flex: 1,
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bodyCenter: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  cameraHint: {
    color: palette.nightText,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  cameraScreen: {
    backgroundColor: palette.night,
    flex: 1,
  },
  cameraTop: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  centerFootnote: {
    ...type.footnote,
    textAlign: 'center',
  },
  centerText: {
    ...type.body,
    textAlign: 'center',
  },
  centerTitle: {
    ...type.headline,
    fontSize: 17,
    textAlign: 'center',
  },
  devField: {
    gap: 6,
  },
  devInput: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 13,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  devLabel: {
    ...type.caption,
  },
  errorText: {
    color: palette.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  failTitle: {
    color: palette.danger,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  flexSpacer: {
    flex: 1,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  heroBlock: {
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
    paddingBottom: spacing.md,
  },
  latexBox: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  lockBody: {
    backgroundColor: palette.surface,
    borderRadius: 8,
    height: 34,
    width: 46,
  },
  lockCopy: {
    color: palette.nightText,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  lockFooter: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  lockGlyph: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  lockMission: {
    alignSelf: 'stretch',
    borderBottomColor: palette.nightLine,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.nightLine,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 3,
    paddingVertical: spacing.md,
  },
  lockMissionText: {
    color: palette.nightText,
    fontSize: 13,
    textAlign: 'center',
  },
  lockMissionTitle: {
    color: palette.surface,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  lockMuted: {
    color: palette.nightTextFaint,
    fontSize: 12,
    textAlign: 'center',
  },
  lockScreen: {
    alignItems: 'center',
    backgroundColor: palette.night,
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingTop: 40,
  },
  lockShackle: {
    borderColor: palette.surface,
    borderRadius: 14,
    borderWidth: 5,
    height: 30,
    marginBottom: -12,
    width: 30,
  },
  lockTitle: {
    color: palette.surface,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  missionCenter: {
    gap: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  problemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  problemScroll: {
    flex: 1,
  },
  resultHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  resultScroll: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  scanBox: {
    backgroundColor: palette.canvas,
    borderRadius: radius.inner,
    height: 132,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanImageLabel: {
    color: palette.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  scanLine: {
    backgroundColor: palette.accent,
    height: 2,
  },
  successTitle: {
    color: palette.success,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  warnText: {
    color: palette.warn,
    fontSize: 12,
    lineHeight: 18,
  },
});
