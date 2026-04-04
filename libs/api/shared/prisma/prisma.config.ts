import { defineConfig, env } from 'prisma/config';
import { loadPrismaEnv } from './load-env';

loadPrismaEnv();

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
