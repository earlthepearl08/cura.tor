import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4173);
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;

/**
 * Playwright smoke config for CI-friendly happy paths.
 * App is started with dummy Firebase client env (no real project required).
 * Gemini/OCR/Stripe are mocked in the specs via page.route.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    timeout: 60_000,
    expect: { timeout: 15_000 },
    use: {
        baseURL: BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            ...process.env,
            // Dummy Firebase client config — Auth is bypassed via E2E mock flag
            VITE_FIREBASE_API_KEY: 'e2e-fake-api-key',
            VITE_FIREBASE_AUTH_DOMAIN: 'e2e-curator.firebaseapp.com',
            VITE_FIREBASE_PROJECT_ID: 'e2e-curator',
            VITE_FIREBASE_STORAGE_BUCKET: 'e2e-curator.appspot.com',
            VITE_FIREBASE_MESSAGING_SENDER_ID: '0',
            VITE_FIREBASE_APP_ID: '1:0:web:e2e',
            VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_e2e',
            VITE_STRIPE_PIONEER_MONTHLY_PRICE_ID: 'price_e2e_pioneer_m',
            VITE_STRIPE_PIONEER_YEARLY_PRICE_ID: 'price_e2e_pioneer_y',
            VITE_STRIPE_PRO_MONTHLY_PRICE_ID: 'price_e2e_pro_m',
            VITE_STRIPE_PRO_YEARLY_PRICE_ID: 'price_e2e_pro_y',
        },
    },
});
