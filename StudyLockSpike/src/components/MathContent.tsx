import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { splitMathContent } from '../lib/mathMarkup';

type MathContentProps = {
  value: string;
  tone?: 'body' | 'problem' | 'compact';
};

export function MathContent({ tone = 'body', value }: MathContentProps) {
  return (
    <View style={styles.wrap}>
      {splitMathContent(value).map((block, index) =>
        block.kind === 'math' ? (
          <Text key={`${block.kind}-${index}`} style={[styles.math, styles[tone]]}>
            {block.value}
          </Text>
        ) : (
          <Text key={`${block.kind}-${index}`} style={[styles.text, styles[tone]]}>
            {block.value}
          </Text>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  compact: {
    fontSize: 12,
    lineHeight: 18,
  },
  math: {
    backgroundColor: '#f7f8fb',
    borderColor: '#e2e4ea',
    borderRadius: 8,
    borderWidth: 1,
    color: '#1b1e26',
    fontFamily: 'monospace',
    fontWeight: '700',
    padding: 10,
  },
  problem: {
    fontSize: 19,
    lineHeight: 29,
  },
  text: {
    color: '#1b1e26',
    fontWeight: '600',
  },
  wrap: {
    gap: 10,
  },
});
