import type { Page } from '@playwright/test';

/** Must match `src/e2e/mockAuthFlag.ts` — duplicated so Playwright Node doesn't import Vite modules. */
const E2E_MOCK_AUTH_STORAGE_KEY = 'cura_e2e_mock_auth';

/** Seed Pro-tier mock auth before the app boots (see AuthContext). */
export async function enableE2EMockAuth(page: Page) {
    await page.addInitScript((key: string) => {
        localStorage.setItem(key, '1');
    }, E2E_MOCK_AUTH_STORAGE_KEY);
}

/** Avoid PWA service worker caching interfering with route mocks. */
export async function disableServiceWorkers(page: Page) {
    await page.addInitScript(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((r) => r.unregister());
            });
        }
    });
}
