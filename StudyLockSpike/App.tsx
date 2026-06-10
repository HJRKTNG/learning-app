import React from 'react';
import { Platform, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DevBrowserShell } from './src/screens/DevBrowserShell';
import { LearningAppScreen } from './src/screens/LearningAppScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {Platform.OS === 'web' ? <DevBrowserShell /> : <LearningAppScreen />}
    </SafeAreaProvider>
  );
}

export default App;
