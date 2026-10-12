/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

// `vite build --mode artifact` produces one self-contained HTML file (hash routing, offline data).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'artifact' ? [react(), viteSingleFile()] : [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: mode === 'artifact' ? { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 5000 } : {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          vendor: ['@tanstack/react-query', '@tanstack/react-table', '@tanstack/react-virtual', 'zustand', 'framer-motion', 'cmdk'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
