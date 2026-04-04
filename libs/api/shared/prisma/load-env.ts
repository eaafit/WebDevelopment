import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function loadPrismaEnv(): void {
  const workspaceRoot = findWorkspaceRoot();
  const workspaceEnvPath = workspaceRoot ? join(workspaceRoot, '.env') : undefined;
  const fallbackCandidates = dedupe([
    workspaceRoot ? join(workspaceRoot, 'libs/api/shared/prisma/.env') : undefined,
    join(process.cwd(), '.env'),
  ]);

  if (workspaceEnvPath) {
    loadEnvFile(workspaceEnvPath, { override: true });
  }

  for (const envPath of fallbackCandidates) {
    loadEnvFile(envPath, { override: false });
  }
}

function findWorkspaceRoot(): string | undefined {
  const queue = dedupe([process.cwd(), __dirname]);

  for (const startDir of queue) {
    let current = resolve(startDir);

    while (true) {
      if (existsSync(join(current, 'nx.json')) || existsSync(join(current, 'pnpm-workspace.yaml'))) {
        return current;
      }

      const parent = dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return undefined;
}

function loadEnvFile(envPath: string, options: { override: boolean }): void {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || (!options.override && process.env[key] !== undefined)) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function dedupe(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
