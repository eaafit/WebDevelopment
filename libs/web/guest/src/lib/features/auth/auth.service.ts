import { Injectable, signal, computed } from '@angular/core';
import { Role } from './role.enum';

const STORAGE_KEY = 'app_current_role';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentRole = signal<Role | null>(this.readStoredRole());

  readonly isLoggedIn = computed(() => this.currentRole() !== null);
  readonly role = this.currentRole.asReadonly();

  login(role: Role): void {
    this.currentRole.set(role);
    sessionStorage.setItem(STORAGE_KEY, role);
  }

  logout(): void {
    this.currentRole.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  isLoggedInValue(): boolean {
    return this.currentRole() !== null;
  }

  getCurrentRole(): Role | null {
    return this.currentRole();
  }

  hasRole(role: Role): boolean {
    return this.currentRole() === role;
  }

  private readStoredRole(): Role | null {
    if (typeof sessionStorage === 'undefined') return null;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const valid = Object.values(Role) as string[];
    return valid.includes(stored) ? (stored as Role) : null;
  }
}
