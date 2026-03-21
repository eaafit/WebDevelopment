// Роли теперь определены в token-store.ts и выровнены с бэкендом.
// Этот файл оставлен для обратной совместимости — реэкспортирует из token-store.

export { UserRole, UserRole as Role, USER_ROLE_HOME as ROLE_HOME } from './token-store';
export type { AuthUser } from './token-store';

// Метки для UI (только для отображения)
import { UserRole } from './token-store';
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Applicant]: 'Заявитель',
  [UserRole.Notary]:    'Нотариус',
  [UserRole.Admin]:     'Администратор',
};
