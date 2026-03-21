import { Injectable, signal, computed } from '@angular/core';

// ─── Роли — выровнены с бэкендом (числовые значения UserRole proto enum) ─────

export enum UserRole {
  Applicant = 1,
  Notary    = 2,
  Admin     = 3,
}

export const USER_ROLE_HOME: Record<UserRole, string> = {
  [UserRole.Applicant]: '/applicant',
  [UserRole.Notary]:    '/notary',
  [UserRole.Admin]:     '/admin',
};

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phoneNumber: string;
  isActive: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(payload: JwtPayload): boolean {
  return payload.exp < Math.floor(Date.now() / 1000);
}

export function roleFromPayload(raw: string): UserRole {
  const n = Number(raw);
  if (n === 2) return UserRole.Notary;
  if (n === 3) return UserRole.Admin;
  return UserRole.Applicant;
}

// ─── TokenStore ──────────────────────────────────────────────────────────────
// Единственный источник правды о токенах в приложении.
// Живёт в @notary-portal/ui чтобы избежать циклических зависимостей:
//   ui (TokenStore, guards, transport) ← guest (AuthService, Login)
//   ui (TokenStore, guards, transport) ← app.routes, app.config

const RT_KEY = 'rt';

@Injectable({ providedIn: 'root' })
export class TokenStore {
  private _accessToken: string | null = null;

  private readonly _user = signal<AuthUser | null>(null);

  readonly user       = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly role       = computed(() => this._user()?.role ?? null);

  setTokens(accessToken: string, refreshToken: string, rpcUser: any): void {
    this._accessToken = accessToken;
    this.persistRefreshToken(refreshToken);

    const p = parseJwtPayload(accessToken);
    this._user.set({
      id:          rpcUser?.id          ?? p?.sub   ?? '',
      email:       rpcUser?.email       ?? p?.email ?? '',
      fullName:    rpcUser?.fullName     ?? '',
      role:        roleFromPayload(String(rpcUser?.role ?? p?.role ?? '1')),
      phoneNumber: rpcUser?.phoneNumber  ?? '',
      isActive:    rpcUser?.isActive     ?? true,
    });
  }

  getAccessToken(): string | null {
    if (!this._accessToken) return null;
    const p = parseJwtPayload(this._accessToken);
    if (!p || isTokenExpired(p)) { this._accessToken = null; return null; }
    return this._accessToken;
  }

  getRefreshToken(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(RT_KEY);
  }

  hasSession(): boolean {
    return this.getRefreshToken() !== null;
  }

  clear(): void {
    this._accessToken = null;
    this._user.set(null);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(RT_KEY);
  }

  private persistRefreshToken(rt: string): void {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(RT_KEY, rt);
  }
}
