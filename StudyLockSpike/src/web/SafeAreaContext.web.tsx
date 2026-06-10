import React from 'react';
import { StyleSheet, View } from 'react-native';

type SafeAreaProviderProps = {
  children: React.ReactNode;
};

export function SafeAreaProvider({ children }: SafeAreaProviderProps) {
  return <View style={styles.provider}>{children}</View>;
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
  },
});
