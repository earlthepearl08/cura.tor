/**
 * Runtime flag for Playwright smoke tests.
 * Enable via VITE_E2E_MOCK_AUTH=true (build/dev) or localStorage key
 * `cura_e2e_mock_auth=1` (set by Playwright before navigation).
 *
 * Never enabled in production builds unless an operator deliberately sets
 * the Vite env — do not ship that flag to Vercel production.
 */
export const E2E_MOCK_AUTH_STORAGE_KEY = 'cura_e2e_mock_auth';

export function isE2EMockAuthEnabled(): boolean {
    if (import.meta.env.VITE_E2E_MOCK_AUTH === 'true') return true;
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(E2E_MOCK_AUTH_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}
