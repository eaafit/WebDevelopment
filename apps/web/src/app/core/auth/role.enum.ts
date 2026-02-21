export enum Role {
  Guest = 'guest',
  Notary = 'notary',
  Applicant = 'applicant',
  Administrator = 'administrator',
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.Guest]: 'Гость',
  [Role.Notary]: 'Нотариус',
  [Role.Applicant]: 'Заявитель',
  [Role.Administrator]: 'Администратор',
};
