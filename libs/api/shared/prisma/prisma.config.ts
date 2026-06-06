import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { loadProjectEnv } from './load-env';
import path from 'path'; // <- Добавили импорт

loadProjectEnv();

const isGenerateCommand = process.argv.some((arg) => arg === 'generate');
const databaseUrl = process.env['DATABASE_URL'] ?? (
  isGenerateCommand ? 'postgresql://prisma:prisma@localhost:5432/prisma_generate' : undefined
);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
  // Используем path.resolve для генерации корректного пути
  schema: path.resolve(__dirname, 'schema.prisma'), 
  migrations: {
    path: path.resolve(__dirname, 'migrations'),
    seed: 'ts-node --project tsconfig.seed.json --transpile-only seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
