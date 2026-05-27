import { defineConfig, env } from 'prisma/config';
import { loadProjectEnv } from './load-env';

loadProjectEnv();

// Root `.env` is loaded by `loadProjectEnv` when Prisma runs from `libs/api/shared/prisma`.
// In Docker one-shot migrate jobs, pass secrets via `environment` / `env_file` as usual.
export default defineConfig({
  schema: 'schema.prisma',
  migrations: {
    path: 'migrations',
    seed: 'ts-node --project tsconfig.seed.json --transpile-only seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
