import { defineConfig, env } from 'prisma/config';

// Do not import `dotenv/config` here: the Docker `migrate` one-shot container only
// mounts this directory (no node_modules). Load secrets via process env / compose `env_file`.
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
