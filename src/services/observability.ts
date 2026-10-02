/**
 * Lightweight observability for Cura.Tor.
 *
 * - Always emits structured console logs (JSON lines) for local / Vercel log drains.
 * - POSTs to `/api/error-log` so server-side aggregation (and optional Sentry) can pick them up.
 * - If `VITE_SENTRY_DSN` is set, `initSentry()` loads `@sentry/react` and errors forward there.
 * - Product funnel analytics reuse the same intake via `trackEvent` (info-level, no alerts).
 */

export type ObservabilityLevel = 'debug' | 'info' | 'warn' | 'error';

/** Error / ops event names */
export type ObservabilityOpsEventName =
  | 'scan_failure'
  | 'gemini_429'
  | 'gemini_5xx'
  | 'gemini_retry'
  | 'client_error'
  | 'unhandled_rejection'
  | 'custom';

/** Signup → first scan → upgrade funnel */
export type FunnelEventName =
  | 'signup'
  | 'first_scan'
  | 'upgrade_intent'
  | 'upgrade_success';

export type ObservabilityEventName = ObservabilityOpsEventName | FunnelEventName;

const FUNNEL_EVENTS: ReadonlySet<string> = new Set([
  'signup',
  'first_scan',
  'upgrade_intent',
  'upgrade_success',
]);

export function isFunnelEvent(name: string): boolean {
  return FUNNEL_EVENTS.has(name);
}

export interface ObservabilityEvent {
  name: ObservabilityEventName;
  level?: ObservabilityLevel;
  message: string;
  /** scan | log-sheet | multi-card | qr | other */
  flow?: string;
  status?: number;
  reason?: string;
  attempt?: number;
  /** Free-form, avoid PII / raw card images */
  context?: Record<string, unknown>;
  stack?: string;
  timestamp?: string;
}

const ENDPOINT = '/api/error-log';

function levelFor(event: ObservabilityEvent): ObservabilityLevel {
  if (event.level) return event.level;
  if (isFunnelEvent(event.name)) return 'info';
  if (event.name === 'gemini_retry') return 'warn';
  if (event.name === 'client_error' || event.name === 'scan_failure') return 'error';
  if (event.name === 'gemini_429' || event.name === 'gemini_5xx') return 'error';
  return 'info';
}

function toPayload(event: ObservabilityEvent): ObservabilityEvent {
  return {
    ...event,
    level: levelFor(event),
    timestamp: event.timestamp || new Date().toISOString(),
  };
}

function consoleEmit(payload: ObservabilityEvent): void {
  const line = { src: 'cura.tor', ...payload };
  const serialized = JSON.stringify(line);
  const level = payload.level || 'info';
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else if (level === 'debug') console.debug(serialized);
  else console.info(serialized);
}

function sentryEmit(payload: ObservabilityEvent): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = (globalThis as unknown as {
    Sentry?: {
      captureException?: (err: Error, ctx?: unknown) => void;
      captureMessage?: (msg: string, ctx?: unknown) => void;
      addBreadcrumb?: (crumb: unknown) => void;
    };
  }).Sentry;
  if (!Sentry) return;

  try {
    // Funnel / info events → breadcrumb only (don't create Sentry issues)
    if (isFunnelEvent(payload.name) || payload.level === 'info' || payload.level === 'debug') {
      Sentry.addBreadcrumb?.({
        category: 'analytics',
        message: payload.name,
        level: 'info',
        data: {
          flow: payload.flow,
          ...payload.context,
        },
      });
      return;
    }

    if (payload.stack || payload.name === 'client_error' || payload.level === 'error') {
      const err = payload.stack
        ? Object.assign(new Error(payload.message), { stack: payload.stack })
        : new Error(payload.message);
      Sentry.captureException?.(err, {
        tags: { event_name: payload.name, flow: payload.flow || 'unknown' },
        extra: payload,
      });
      return;
    }

    Sentry.captureMessage?.(payload.message, {
      level: payload.level === 'warn' ? 'warning' : 'error',
      tags: { event_name: payload.name, flow: payload.flow || 'unknown' },
      extra: payload,
    });
  } catch {
    // never let telemetry break the app
  }
}

async function postEvent(payload: ObservabilityEvent): Promise<void> {
  try {
    // fire-and-forget; keepalive helps on page unload
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // swallow — observability must not throw into product flows
  }
}

/** Report a structured event (scan failures, Gemini 429/5xx, UI crashes, …). */
export function reportEvent(event: ObservabilityEvent): void {
  const payload = toPayload(event);
  consoleEmit(payload);
  sentryEmit(payload);
  void postEvent(payload);
}

/**
 * Product analytics funnel helper.
 * Reuses `/api/error-log` at info level (no alert noise). Avoid PII in context.
 */
export function trackEvent(
  name: FunnelEventName,
  context?: Record<string, unknown>
): void {
  reportEvent({
    name,
    level: 'info',
    message: name,
    context: {
      source: 'analytics',
      ...context,
    },
  });
}

/** Fire once per uid+event (localStorage). Returns true if this call should emit. */
export function trackEventOnce(
  name: FunnelEventName,
  uid: string,
  context?: Record<string, unknown>
): boolean {
  if (!uid) return false;
  const key = `analytics_${name}_${uid}`;
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
  } catch {
    // private mode — still emit; may duplicate
  }
  trackEvent(name, context);
  return true;
}

/** Classify Gemini/HTTP failures from OCR flows. */
export function reportGeminiHttpError(opts: {
  flow: string;
  status: number;
  message: string;
  reason?: string;
  attempt?: number;
  final?: boolean;
}): void {
  const { status, final } = opts;
  if (!final && (status === 429 || status >= 500)) {
    reportEvent({
      name: 'gemini_retry',
      level: 'warn',
      message: opts.message,
      flow: opts.flow,
      status,
      reason: opts.reason,
      attempt: opts.attempt,
    });
    return;
  }
  if (status === 429) {
    reportEvent({
      name: 'gemini_429',
      message: opts.message,
      flow: opts.flow,
      status,
      reason: opts.reason,
      attempt: opts.attempt,
    });
    return;
  }
  if (status >= 500) {
    reportEvent({
      name: 'gemini_5xx',
      message: opts.message,
      flow: opts.flow,
      status,
      reason: opts.reason,
      attempt: opts.attempt,
    });
    return;
  }
  reportEvent({
    name: 'scan_failure',
    message: opts.message,
    flow: opts.flow,
    status,
    reason: opts.reason,
    attempt: opts.attempt,
  });
}

export function reportScanFailure(opts: {
  flow: string;
  message: string;
  status?: number;
  reason?: string;
  context?: Record<string, unknown>;
}): void {
  reportEvent({
    name: 'scan_failure',
    message: opts.message,
    flow: opts.flow,
    status: opts.status,
    reason: opts.reason,
    context: opts.context,
  });
}

export function reportClientError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));
  reportEvent({
    name: 'client_error',
    message: err.message,
    stack: err.stack,
    context,
  });
}
