/**
 * Создаёт заявку через тот же RPC, что и фронт, без UI.
 * Цепочка на бэкенде: createAssessment → audit (assessment.created) → notifications (notary/admin).
 *
 * Запуск из корня репозитория (API должен слушать PORT из .env, по умолчанию 3000):
 *   npx ts-node --project scripts/tsconfig.json scripts/trigger-assessment-for-notifications.ts
 *
 * Переменные (опционально): TRIGGER_API_BASE, TRIGGER_APPLICANT_EMAIL, TRIGGER_APPLICANT_PASSWORD
 */
import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-node';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { AssessmentService, AuthService } from '../libs/shared/api-contracts/src/index';

config({ path: resolve(__dirname, '..', '.env') });

const baseUrl = (process.env['TRIGGER_API_BASE'] ?? `http://127.0.0.1:${process.env['PORT'] ?? '3000'}`).replace(
  /\/$/,
  '',
);

const email =
  process.env['TRIGGER_APPLICANT_EMAIL'] ?? 'seed-user-000@seed.local';
const password = process.env['TRIGGER_APPLICANT_PASSWORD'] ?? 'SeedPass123!';

function authTransport(token: string | undefined) {
  return createConnectTransport({
    baseUrl,
    httpVersion: '1.1',
    interceptors: [
      (next) => async (req) => {
        if (token) {
          req.header.set('Authorization', `Bearer ${token}`);
        }
        return next(req);
      },
    ],
  });
}

async function main(): Promise<void> {
  const anon = createClient(AuthService, authTransport(undefined));
  const loginRes = await anon.login({ email, password });
  const token = loginRes.result?.accessToken;
  const userId = loginRes.result?.user?.id;
  if (!token || !userId) {
    throw new Error('Login failed: no token or user id');
  }

  const assessmentClient = createClient(AssessmentService, authTransport(token));
  const created = await assessmentClient.createAssessment({
    userId,
    address: 'Проверка уведомлений (скрипт scripts/trigger-assessment-for-notifications.ts)',
    description: 'Создано без UI для теста in-app уведомлений.',
  });

  const id = created.assessment?.id;
  if (!id) {
    throw new Error('createAssessment returned no assessment id');
  }

  // eslint-disable-next-line no-console
  console.log(`OK: assessment ${id} — зайдите нотариусом/админом во вкладку «Уведомления» или проверьте таблицы audit_logs / notifications.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
