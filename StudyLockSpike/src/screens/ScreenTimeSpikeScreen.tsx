import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ScreenTimeAuthorizationStatus,
  ScreenTimeModule,
} from '../native/ScreenTimeModule';

type TimeParts = {
  hour: string;
  minute: string;
};

const parseTimeParts = (value: TimeParts) => ({
  hour: Number.parseInt(value.hour, 10),
  minute: Number.parseInt(value.minute, 10),
});

export function ScreenTimeSpikeScreen() {
  const [authorizationStatus, setAuthorizationStatus] =
    useState<ScreenTimeAuthorizationStatus>('unknown');
  const [hasSelection, setHasSelection] = useState(false);
  const [startTime, setStartTime] = useState<TimeParts>({
    hour: '21',
    minute: '00',
  });
  const [endTime, setEndTime] = useState<TimeParts>({
    hour: '22',
    minute: '00',
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const appendLog = useCallback((message: string) => {
    setLogs(current => [`${new Date().toLocaleTimeString()} ${message}`, ...current]);
  }, []);

  const runAction = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      setError(null);
      try {
        const result = await action();
        appendLog(`${label}: ${String(result)}`);
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : JSON.stringify(caught);
        setError(message);
        appendLog(`${label}: ERROR`);
      }
    },
    [appendLog],
  );

  const refreshState = useCallback(async () => {
    await runAction('状態更新', async () => {
      const [status, selected] = await Promise.all([
        ScreenTimeModule.getAuthorizationStatus(),
        ScreenTimeModule.hasFamilyActivitySelection(),
      ]);
      setAuthorizationStatus(status);
      setHasSelection(selected);
      return `authorization=${status}, selection=${selected}`;
    });
  }, [runAction]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const requestAuthorization = () =>
    runAction('スクリーンタイム連携を許可する', async () => {
      const result = await ScreenTimeModule.requestAuthorization();
      setAuthorizationStatus(await ScreenTimeModule.getAuthorizationStatus());
      return result;
    });

  const presentPicker = () =>
    runAction('制限するアプリを選ぶ', async () => {
      const result = await ScreenTimeModule.presentFamilyActivityPicker();
      setHasSelection(await ScreenTimeModule.hasFamilyActivitySelection());
      return result;
    });

  const startImmediateShield = () =>
    runAction('今すぐブロック', () => ScreenTimeModule.startImmediateShield());

  const stopImmediateShield = () =>
    runAction('ブロック解除', () => ScreenTimeModule.stopImmediateShield());

  const startScheduledShield = () =>
    runAction('スケジュールブロック開始', () => {
      const start = parseTimeParts(startTime);
      const end = parseTimeParts(endTime);
      return ScreenTimeModule.startScheduledShield(
        start.hour,
        start.minute,
        end.hour,
        end.minute,
      );
    });

  const stopScheduledShield = () =>
    runAction('スケジュール停止', () => ScreenTimeModule.stopScheduledShield());

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', default: undefined })}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Screen Time Spike</Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            権限状態: {authorizationStatus}
          </Text>
          <Text style={styles.statusText}>
            選択済み: {hasSelection ? 'あり' : 'なし'}
          </Text>
        </View>

        <View style={styles.buttons}>
          <Button
            title="状態を更新"
            onPress={refreshState}
          />
          <Button
            title="スクリーンタイム連携を許可する"
            onPress={requestAuthorization}
          />
          <Button
            title="制限するアプリを選ぶ"
            onPress={presentPicker}
          />
          <Button
            title="今すぐブロック"
            onPress={startImmediateShield}
          />
          <Button
            title="ブロック解除"
            onPress={stopImmediateShield}
          />
        </View>

        <Text style={styles.sectionTitle}>開始時刻</Text>
        <View style={styles.timeRow}>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={hour => setStartTime(current => ({ ...current, hour }))}
            style={styles.timeInput}
            value={startTime.hour}
          />
          <Text style={styles.colon}>:</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={minute =>
              setStartTime(current => ({ ...current, minute }))
            }
            style={styles.timeInput}
            value={startTime.minute}
          />
        </View>

        <Text style={styles.sectionTitle}>終了時刻</Text>
        <View style={styles.timeRow}>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={hour => setEndTime(current => ({ ...current, hour }))}
            style={styles.timeInput}
            value={endTime.hour}
          />
          <Text style={styles.colon}>:</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={2}
            onChangeText={minute => setEndTime(current => ({ ...current, minute }))}
            style={styles.timeInput}
            value={endTime.minute}
          />
        </View>

        <View style={styles.buttons}>
          <Button
            title="スケジュールブロック開始"
            onPress={startScheduledShield}
          />
          <Button
            title="スケジュール停止"
            onPress={stopScheduledShield}
          />
        </View>

        {error ? <Text style={styles.error}>エラー: {error}</Text> : null}

        <Text style={styles.sectionTitle}>実行結果ログ</Text>
        <View style={styles.logBox}>
          {logs.length === 0 ? (
            <Text style={styles.logText}>ログはまだありません</Text>
          ) : (
            logs.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.logText}>
                {line}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  content: {
    gap: 14,
    padding: 20,
    paddingTop: 64,
  },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
  },
  statusBox: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    padding: 12,
  },
  statusText: {
    color: '#111827',
    fontSize: 16,
  },
  buttons: {
    gap: 10,
  },
  sectionTitle: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  timeInput: {
    backgroundColor: '#ffffff',
    borderColor: '#9ca3af',
    borderRadius: 6,
    borderWidth: 1,
    color: '#111827',
    fontSize: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
    width: 72,
  },
  colon: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '600',
  },
  error: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    color: '#991b1b',
    padding: 12,
  },
  logBox: {
    backgroundColor: '#111827',
    borderRadius: 8,
    gap: 6,
    minHeight: 160,
    padding: 12,
  },
  logText: {
    color: '#f9fafb',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
  },
});
