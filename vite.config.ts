/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // A configured client ID makes onboarding's sign-in button reachable in tests.
    env: {
      VITE_GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    },
  },
})
