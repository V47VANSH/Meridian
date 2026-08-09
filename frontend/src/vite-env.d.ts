/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base path or absolute URL. Defaults to "/api" (see vite.config.ts proxy). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
