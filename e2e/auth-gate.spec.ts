import { test, expect } from '@playwright/test';
import { disableServiceWorkers } from './helpers/auth';
import { installApiMocks } from './helpers/apiMocks';

test.describe('Auth gate (unauthenticated)', () => {
    test.beforeEach(async ({ page }) => {
        await disableServiceWorkers(page);
        await installApiMocks(page);
    });

    test('public landing stays public without auth', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveURL(/\/$/);
        await expect(page).not.toHaveURL(/\/auth/);
        // Brand-forward public marketing surface (Phase A landing)
        await expect(page.getByRole('link', { name: /Log in|Sign in/i }).first()).toBeVisible();
    });

    test('protected /app redirects to /auth', async ({ page }) => {
        await page.goto('/app');
        await expect(page).toHaveURL(/\/auth/);
        // Mode control is a tab after a11y pass; submit "Log in" appears once email form is open
        await expect(page.getByRole('tab', { name: /Log in/i })).toBeVisible();
        await expect(page.getByAltText('Cura.tor').first()).toBeVisible();
    });

    test('/legal stays public without auth', async ({ page }) => {
        await page.goto('/legal');
        await expect(page).toHaveURL(/\/legal/);
        // Legal page should not bounce to auth
        await expect(page).not.toHaveURL(/\/auth/);
    });
});
