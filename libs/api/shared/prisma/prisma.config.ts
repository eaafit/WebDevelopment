import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { loadProjectEnv } from './load-env';

loadProjectEnv();

const isGenerateCommand = process.argv.some((arg) => arg === 'generate');
const generateOnlyDatabaseUrl = 'postgresql://prisma:prisma@localhost:5432/prisma_generate';
const databaseUrl = process.env['DATABASE_URL'] ?? (
  isGenerateCommand ? generateOnlyDatabaseUrl : undefined
);

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
    url: databaseUrl,
  },
});
