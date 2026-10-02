/**
 * Env-gated Sentry browser init.
 * No-op when `VITE_SENTRY_DSN` is unset — app keeps working on structured logs alone.
 */

import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry(): void {
    if (initialized) return;
    const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
    if (!dsn || typeof dsn !== 'string' || !dsn.startsWith('http')) {
        return;
    }

    try {
        Sentry.init({
            dsn,
            environment: import.meta.env.MODE || 'production',
            // Keep volume low — funnel analytics go through /api/error-log;
            // Sentry is for errors + optional breadcrumbs.
            tracesSampleRate: 0,
            sendDefaultPii: false,
            beforeSend(event) {
                // Drop accidental PII-ish extras if any slip through
                if (event.extra) {
                    delete (event.extra as Record<string, unknown>).email;
                    delete (event.extra as Record<string, unknown>).imageData;
                    delete (event.extra as Record<string, unknown>).rawText;
                }
                return event;
            },
        });
        // Expose for observability.ts sentryEmit (and any legacy global callers)
        (globalThis as unknown as { Sentry: typeof Sentry }).Sentry = Sentry;
        initialized = true;
        if (import.meta.env.DEV) {
            console.info('[sentry] initialized (VITE_SENTRY_DSN set)');
        }
    } catch (err) {
        console.warn('[sentry] init failed', err);
    }
}

export function isSentryEnabled(): boolean {
    return initialized;
}

export { Sentry };
