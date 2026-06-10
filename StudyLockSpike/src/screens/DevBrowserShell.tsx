import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  DevTextInput,
  LearningAppScreen,
  LearningPreviewState,
  LearningScreenId,
} from './LearningAppScreen';
import { GeneratedProblem, GenerateProblemRequest } from '../api/genStudyApi';
import { learningScreenOptions } from './learningScreenOptions';

const defaultApiUrl =
  globalThis.__GEN_STUDY_API_URL__ ??
  'https://gen-study-api.onrender.com/generate';

const defaultApiToken = globalThis.__GEN_STUDY_API_TOKEN__ ?? '';

const initialPreview: LearningPreviewState = {
  locked: false,
  mastered: 3,
  required: 8,
  screen: 'home',
  showApiPanel: true,
  total: 10,
};

const initialRequest: GenerateProblemRequest = {
  level: 'University of Tokyo',
  subject: 'math',
  topic: 'Probability Recurrence Relations',
};

const initialScreenFromUrl = (): LearningScreenId => {
  const requested = new URLSearchParams(globalThis.location?.search).get(
    'screen',
  );
  const match = learningScreenOptions.find(option => option.id === requested);
  return match?.id ?? 'home';
};

export function DevBrowserShell() {
  const [preview, setPreview] = useState<LearningPreviewState>({
    ...initialPreview,
    screen: initialScreenFromUrl(),
  });
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [apiToken, setApiToken] = useState(defaultApiToken);
  const [request, setRequest] = useState<GenerateProblemRequest>(initialRequest);
  const [lastProblem, setLastProblem] = useState<GeneratedProblem | null>(null);

  const apiConfig = useMemo(
    () => ({
      endpoint: apiUrl,
      token: apiToken,
    }),
    [apiToken, apiUrl],
  );

  const updatePreview = <Key extends keyof LearningPreviewState>(
    key: Key,
    value: LearningPreviewState[Key],
  ) => {
    setPreview(current => ({ ...current, [key]: value }));
  };

  const updateRequest = <Key extends keyof GenerateProblemRequest>(
    key: Key,
    value: GenerateProblemRequest[Key],
  ) => {
    setRequest(current => ({ ...current, [key]: value }));
  };

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.dashboard}>
        <Text style={styles.eyebrow}>Dev Browser</Text>
        <Text style={styles.title}>学習アプリ調整</Text>
        <Text style={styles.copy}>
          React Native本体UIを左の設定で切り替え、iPhoneへ入れずにブラウザで挙動を確認します。
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>画面</Text>
          <View style={styles.segmentGrid}>
            {learningScreenOptions.map(option => (
              <Pressable
                key={option.id}
                onPress={() => updatePreview('screen', option.id)}
                style={[
                  styles.segment,
                  preview.screen === option.id && styles.segmentActive,
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    preview.screen === option.id && styles.segmentTextActive,
                  ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>状態</Text>
          <NumberControl
            label="マスター数"
            max={preview.total}
            min={0}
            onChange={value => updatePreview('mastered', value)}
            value={preview.mastered}
          />
          <NumberControl
            label="総問題数"
            max={20}
            min={1}
            onChange={value => updatePreview('total', value)}
            value={preview.total}
          />
          <NumberControl
            label="解除ライン"
            max={preview.total}
            min={1}
            onChange={value => updatePreview('required', value)}
            value={preview.required}
          />
          <Toggle
            label="ロック表示"
            onChange={value => updatePreview('locked', value)}
            value={preview.locked}
          />
          <Toggle
            label="API説明パネル"
            onChange={value => updatePreview('showApiPanel', value)}
            value={preview.showApiPanel}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>問題生成API</Text>
          <DevTextInput label="API URL" onChangeText={setApiUrl} value={apiUrl} />
          <View style={styles.field}>
            <Text style={styles.label}>Bearer Token</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setApiToken}
              secureTextEntry
              style={styles.input}
              value={apiToken}
            />
          </View>
          <DevTextInput
            label="Subject"
            onChangeText={value => updateRequest('subject', value)}
            value={request.subject}
          />
          <DevTextInput
            label="Level"
            onChangeText={value => updateRequest('level', value)}
            value={request.level}
          />
          <DevTextInput
            label="Topic"
            onChangeText={value => updateRequest('topic', value)}
            value={request.topic}
          />
          <Text style={styles.hint}>
            Tokenは `.env.local` の `VITE_GEN_STUDY_API_TOKEN` でも指定できます。
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OCR / AI採点</Text>
          <Text style={styles.copy}>
            紙答案はブラウザで撮影またはアップロードできます。現在は手動入力をOCR候補としてローカルAIシミュレーターに渡し、将来はMathpixなどのSTEM OCRとAI採点APIへ差し替えます。
          </Text>
        </View>

        {lastProblem ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>直近の生成結果</Text>
            <Text style={styles.resultTitle}>{lastProblem.title}</Text>
            <Text style={styles.resultText} numberOfLines={6}>
              {lastProblem.problem}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.stage}>
        <View style={styles.phoneShell}>
          <View style={styles.notch} />
          <View style={styles.phoneScreen}>
            <LearningAppScreen
              apiConfig={apiConfig}
              generateRequest={request}
              onGeneratedProblem={setLastProblem}
              onNavigate={(screen: LearningScreenId) =>
                updatePreview('screen', screen)
              }
              preview={preview}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function NumberControl({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  const update = (nextValue: number) => {
    onChange(Math.min(Math.max(nextValue, min), max));
  };

  return (
    <View style={styles.controlRow}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => update(value - 1)} style={styles.stepButton}>
          <Text style={styles.stepText}>-</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable onPress={() => update(value + 1)} style={styles.stepButton}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.controlRow}>
      <Text style={styles.controlLabel}>{label}</Text>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controlLabel: {
    color: '#1f2937',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  controlRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  copy: {
    color: '#596171',
    fontSize: 13,
    lineHeight: 20,
  },
  dashboard: {
    gap: 18,
    padding: 22,
  },
  eyebrow: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  field: {
    gap: 6,
  },
  hint: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#d8dbe4',
    borderRadius: 8,
    borderWidth: 1,
    color: '#1f2937',
    fontSize: 13,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  label: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  notch: {
    alignSelf: 'center',
    backgroundColor: '#11131a',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    height: 24,
    position: 'absolute',
    top: 12,
    width: 108,
    zIndex: 2,
  },
  phoneScreen: {
    backgroundColor: '#f1f2f5',
    borderRadius: 30,
    flex: 1,
    overflow: 'hidden',
  },
  phoneShell: {
    backgroundColor: '#ffffff',
    borderColor: '#c4c8d2',
    borderRadius: 40,
    borderWidth: 2,
    height: 760,
    maxHeight: '92%',
    padding: 9,
    boxShadow: '0 16px 28px rgba(30, 34, 48, 0.22)',
    width: 372,
  },
  resultText: {
    color: '#596171',
    fontSize: 12,
    lineHeight: 18,
  },
  resultTitle: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '900',
  },
  section: {
    backgroundColor: '#f7f8fb',
    borderColor: '#e2e4ea',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '900',
  },
  segment: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e4ea',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 8,
  },
  segmentActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  segmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentText: {
    color: '#596171',
    fontSize: 12,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#ffffff',
  },
  shell: {
    backgroundColor: '#e9eaee',
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },
  stage: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 420,
    padding: 24,
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: '#f1f2f5',
    height: 30,
    justifyContent: 'center',
    width: 32,
  },
  stepText: {
    color: '#4f46e5',
    fontSize: 18,
    fontWeight: '900',
  },
  stepValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '900',
    minWidth: 34,
    textAlign: 'center',
  },
  stepper: {
    alignItems: 'center',
    borderColor: '#d8dbe4',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '900',
  },
  toggle: {
    backgroundColor: '#d3d6dd',
    borderRadius: 999,
    height: 26,
    padding: 3,
    width: 46,
  },
  toggleKnob: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    height: 20,
    width: 20,
  },
  toggleKnobOn: {
    transform: [{ translateX: 20 }],
  },
  toggleOn: {
    backgroundColor: '#4f46e5',
  },
});
