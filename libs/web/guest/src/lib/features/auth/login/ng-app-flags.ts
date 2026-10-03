/**
 * Build-time flag from Angular `define` in `apps/web/project.json` (web app build only).
 * If the name is not injected (e.g. Jest), defaults to **false** — same as production.
 */
declare let NG_APP_SHOW_TEST_ACCOUNTS: boolean | undefined;

export function isNgAppShowTestAccountsEnabled(): boolean {
  if (typeof NG_APP_SHOW_TEST_ACCOUNTS === 'undefined') {
    return false;
  }
  return NG_APP_SHOW_TEST_ACCOUNTS;
}
