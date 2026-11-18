import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/components/**/*.test.jsx'],
    setupFiles: ['tests/components/setup.js'],
    clearMocks: true,
    restoreMocks: true,
  },
});
