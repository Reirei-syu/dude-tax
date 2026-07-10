/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    // esbuild minify needs approved build scripts on some pnpm setups; oxc is fine
    minify: 'oxc',
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
