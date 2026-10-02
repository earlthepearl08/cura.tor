import type { Page, Route } from '@playwright/test';

const MOCK_CARD_JSON = JSON.stringify([
    {
        name: 'Jane Doe',
        position: 'Sales Manager',
        company: 'Acme Corp',
        phone: ['+63 917 123 4567'],
        email: ['jane.doe@acme.example'],
        address: 'Makati City, PH',
        notes: '',
    },
]);

/** Gemini-shaped response consumed by ocrService.parseMultiCards / processImage */
function geminiFixtureBody(text: string) {
    return JSON.stringify({
        candidates: [
            {
                content: {
                    parts: [{ text }],
                },
            },
        ],
    });
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
    await route.fulfill({
        status,
        contentType: 'application/json',
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

/**
 * Mock Gemini/OCR/Stripe/Firebase identity network so CI never hits live APIs.
 */
export async function installApiMocks(page: Page) {
    await page.route('**/api/gemini', async (route) => {
        await fulfillJson(route, geminiFixtureBody(MOCK_CARD_JSON));
    });

    await page.route('**/api/ocr', async (route) => {
        await fulfillJson(route, {
            textAnnotations: [{ description: 'Jane Doe\nAcme Corp\njane.doe@acme.example' }],
            fullTextAnnotation: {
                text: 'Jane Doe\nAcme Corp\njane.doe@acme.example',
            },
        });
    });

    await page.route('**/api/create-checkout', async (route) => {
        await fulfillJson(route, { error: 'Stripe mocked in e2e' }, 503);
    });

    await page.route('**/api/create-portal', async (route) => {
        await fulfillJson(route, { error: 'Stripe mocked in e2e' }, 503);
    });

    await page.route('**/api/stripe-webhook', async (route) => {
        await fulfillJson(route, { received: true });
    });

    // Firebase Auth / Firestore REST — noop so missing keys don't hang the UI
    await page.route('**/identitytoolkit.googleapis.com/**', async (route) => {
        await fulfillJson(route, {});
    });
    await page.route('**/securetoken.googleapis.com/**', async (route) => {
        await fulfillJson(route, {});
    });
    await page.route('**/firestore.googleapis.com/**', async (route) => {
        await fulfillJson(route, {});
    });
}

export { MOCK_CARD_JSON };
