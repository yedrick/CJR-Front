// Configuración tipada leída desde los archivos .env.testing / .env.production

const bool = (v: string | undefined, fallback = false) => (v === undefined || v === '' ? fallback : v === 'true');
const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v === undefined || v === '' || Number.isNaN(n) ? fallback : n;
};

const raw = import.meta.env;

export const env = {
  appEnv: (raw.VITE_APP_ENV || (raw.PROD ? 'production' : 'testing')) as 'testing' | 'production',
  appName: raw.VITE_APP_NAME || 'CJN Campamentos',
  useMockApi: bool(raw.VITE_USE_MOCK_API, true),
  apiUrl: (raw.VITE_API_URL || '').replace(/\/$/, ''),
  apiTimeoutMs: num(raw.VITE_API_TIMEOUT_MS, 15000),
  mock: {
    latencyMs: num(raw.VITE_MOCK_LATENCY_MS, 300),
    errorRate: Math.min(100, Math.max(0, num(raw.VITE_MOCK_ERROR_RATE, 0))),
    jwtSecret: raw.VITE_MOCK_JWT_SECRET || 'cjn-mock-secret',
    accessTokenTtlMin: num(raw.VITE_MOCK_ACCESS_TOKEN_TTL_MIN, 15),
  },
  showDemoAccounts: bool(raw.VITE_SHOW_DEMO_ACCOUNTS, false),
  enablePwa: bool(raw.VITE_ENABLE_PWA, true),
  notificationsPollMs: num(raw.VITE_NOTIFICATIONS_POLL_MS, 30000),
  vapidPublicKey: raw.VITE_VAPID_PUBLIC_KEY || '',
} as const;

export const isTesting = env.appEnv === 'testing';
