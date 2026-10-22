/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'testing' | 'production';
  readonly VITE_APP_NAME: string;
  readonly VITE_USE_MOCK_API: string;
  readonly VITE_API_URL: string;
  readonly VITE_API_TIMEOUT_MS: string;
  readonly VITE_MOCK_LATENCY_MS: string;
  readonly VITE_MOCK_ERROR_RATE: string;
  readonly VITE_MOCK_JWT_SECRET: string;
  readonly VITE_MOCK_ACCESS_TOKEN_TTL_MIN: string;
  readonly VITE_SHOW_DEMO_ACCOUNTS: string;
  readonly VITE_ENABLE_PWA: string;
  readonly VITE_NOTIFICATIONS_POLL_MS: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
