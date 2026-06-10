import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CapturedAnswer } from '../services/gradingService';

type CameraCaptureProps = {
  manualAnswer: string;
  onCapture: (answer: CapturedAnswer) => void;
};

export function CameraCapture({ manualAnswer, onCapture }: CameraCaptureProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.placeholder}>
        <Text style={styles.title}>ネイティブカメラ準備中</Text>
        <Text style={styles.copy}>
          実機版ではカメラ/写真ライブラリのネイティブアダプタをここに接続します。
        </Text>
      </View>
      <Pressable
        onPress={() =>
          onCapture({
            manualAnswer,
            ocrText: manualAnswer,
          })
        }
        style={styles.button}>
        <Text style={styles.buttonText}>手動入力で採点へ進む</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  copy: {
    color: '#c9ced8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  placeholder: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 2,
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    padding: 18,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  wrap: {
    flex: 1,
    gap: 14,
    padding: 18,
  },
});
