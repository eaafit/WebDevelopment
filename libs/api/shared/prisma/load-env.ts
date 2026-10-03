import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function loadProjectEnv(): void {
  const candidates = [
    join(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '..', '..', '..', '.env'),
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      config({ path: envPath });
    }
  }
}
