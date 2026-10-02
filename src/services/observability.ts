/**
 * Lightweight observability for Cura.Tor.
 *
 * - Always emits structured console logs (JSON lines) for local / Vercel log drains.
 * - POSTs to `/api/error-log` so server-side aggregation (and optional Sentry) can pick them up.
 * - If `VITE_SENTRY_DSN` is set and a global `Sentry` is present, forwards there too
 *   (Sentry-ready stub — no SDK hard dependency yet).
 */

export type ObservabilityLevel = 'debug' | 'info' | 'warn' | 'error';

export type ObservabilityEventName =
  | 'scan_failure'
  | 'gemini_429'
  | 'gemini_5xx'
  | 'gemini_retry'
  | 'client_error'
  | 'unhandled_rejection'
  | 'custom';

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
  const Sentry = (globalThis as unknown as { Sentry?: { captureException?: Function; captureMessage?: Function } }).Sentry;
  if (!Sentry) return;
  try {
    const err = payload.stack
      ? Object.assign(new Error(payload.message), { stack: payload.stack })
      : new Error(payload.message);
    if (typeof Sentry.captureException === 'function') {
      Sentry.captureException(err, { extra: payload });
    } else if (typeof Sentry.captureMessage === 'function') {
      Sentry.captureMessage(payload.message, { level: payload.level, extra: payload });
    }
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
