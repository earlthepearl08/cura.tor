import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { enableE2EMockAuth, disableServiceWorkers } from './helpers/auth';
import { installApiMocks } from './helpers/apiMocks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_CARD = path.join(__dirname, 'fixtures', 'sample-card.png');

test.describe('Happy path: auth → scan → save → export', () => {
    test.beforeEach(async ({ page }) => {
        await disableServiceWorkers(page);
        await enableE2EMockAuth(page);
        await installApiMocks(page);
    });

    test('mocked upload OCR saves a contact and exports CSV', async ({ page }) => {
        // Home lives at /app after Phase A public landing took over /
        await page.goto('/app');

        // Auth mock should land on Home (not /auth)
        await expect(page).not.toHaveURL(/\/auth/);
        await expect(page).toHaveURL(/\/app/);
        await expect(page.getByRole('link', { name: /Upload/i })).toBeVisible();

        await page.getByRole('link', { name: /Upload/i }).click();
        await expect(page).toHaveURL(/\/upload/);
        await expect(page.getByRole('heading', { name: /Upload Cards/i })).toBeVisible();

        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(SAMPLE_CARD);

        await expect(page.getByRole('button', { name: /Process All/i })).toBeVisible();
        await page.getByRole('button', { name: /Process All/i }).click();

        // Mocked Gemini → completed queue item
        await expect(page.getByText('Jane Doe')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole('button', { name: /Save All 1 Contact/i })).toBeVisible();

        await page.getByRole('button', { name: /Save All 1 Contact/i }).click();
        await expect(page).toHaveURL(/\/contacts/);
        await expect(page.getByText(/Showing 1 of 1 Contacts/i)).toBeVisible();

        // Folder groups start collapsed — expand to assert the saved contact
        await page.getByRole('button', { name: /Uncategorized \(1\)/i }).click();
        await expect(page.getByText('Jane Doe')).toBeVisible();
        await expect(page.getByText('Acme Corp')).toBeVisible();

        await page.getByRole('button', { name: 'Export contacts' }).click();
        await expect(page.getByRole('button', { name: /Export as CSV/i })).toBeVisible();

        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: /Export as CSV/i }).click(),
        ]);

        expect(download.suggestedFilename()).toMatch(/^contacts_export_\d+\.csv$/);
    });
});
