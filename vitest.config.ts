import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'api/**/*.{test,spec}.{ts,tsx}',
            'tests/**/*.{test,spec}.{ts,tsx}',
        ],
        globals: false,
        css: false,
        restoreMocks: true,
        clearMocks: true,
    },
});
