import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { TokenStore } from './token-store';
import { UserRole } from './token-store';

// ─── Guard: только аутентификация (любая роль) ───────────────────────────────

export const authGuard: CanActivateFn = (_route, _state) => {
  const tokenStore = inject(TokenStore);
  const router     = inject(Router);

  if (tokenStore.getAccessToken() || tokenStore.hasSession()) return true;
  return router.createUrlTree(['/auth']);
};

// ─── Guard factory: конкретные роли ──────────────────────────────────────────

export function roleGuard(...allowedRoles: UserRole[]): CanActivateFn {
  return (_route, _state) => {
    const tokenStore = inject(TokenStore);
    const router     = inject(Router);

    if (!tokenStore.getAccessToken() && !tokenStore.hasSession()) {
      return router.createUrlTree(['/auth']);
    }

    const userRole = tokenStore.role();
    if (userRole !== null && allowedRoles.includes(userRole)) return true;

    return router.createUrlTree(['/']);
  };
}
