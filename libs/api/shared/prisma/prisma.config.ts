import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { loadProjectEnv } from './load-env';

loadProjectEnv();

const databaseUrl = process.env['DATABASE_URL'];
const isGenerateCommand = process.argv.some((arg) => arg === 'generate');
const generateOnlyDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/notary?schema=public';

if (!databaseUrl && !isGenerateCommand) {
  throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
  schema: path.resolve(__dirname, 'schema.prisma'),
  migrations: {
    path: path.resolve(__dirname, 'migrations'),
    seed: 'ts-node --project tsconfig.seed.json --transpile-only seed.ts',
  },
  datasource: {
    url: databaseUrl ?? generateOnlyDatabaseUrl,
  },
});
