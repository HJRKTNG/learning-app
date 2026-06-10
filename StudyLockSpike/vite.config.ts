import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: 'react-native-safe-area-context',
        replacement: '/src/web/SafeAreaContext.web.tsx',
      },
      { find: 'react-native', replacement: 'react-native-web' },
    ],
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.tsx',
      '.ts',
      '.web.jsx',
      '.web.js',
      '.jsx',
      '.js',
    ],
  },
});
