import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

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
